
import { GoogleGenAI, GenerateContentResponse, Type } from "@google/genai";
import { 
    AnalysisResult, 
    SupportedLanguage, 
    UserSolutionAnalysis, 
    LanguageDisplayNames,
    ExampleDifficulty,
    ExampleCodeData,
    PracticeMaterial,
    AssessmentStatus,
    ChatMessage,
    DebugResult,
    ProjectAnalysis,
    ProjectFile,
    DependencyAnalysis,
    DependencyInfo
} from '../types';

export interface GeminiRequestConfig {
    model: string;
    temperature: number;
    topP: number;
    systemInstruction: string;
}

const DIFFICULTY_GUIDE = `
Here is a guide to what each difficulty level means for code examples and practice problems:
- **Easy**: A very simple, concise example or problem (ideally under 15 lines of code) focused on the absolute core of the concept, using basic syntax. Perfect for a beginner seeing the concept for the first time.
- **Intermediate**: A more practical example or problem that might combine the concept with another common feature, handle a simple edge case, or require a bit more logic. It represents a common, real-world use case.
- **Hard**: A complex example or problem showcasing an advanced use case, performance considerations, integration with other advanced features, or solving a more challenging problem that requires a deeper understanding.
`;

const VISUAL_FLOW_INSTRUCTIONS = `
- **visualExecutionFlow**: Generate a DETAILED, step-by-step trace of the code's execution, as if you were a debugger. Each step in the array represents a single executable line of code.
    - **Trace every line:** Do not skip lines. Represent the execution of each meaningful line as a distinct step. The first step should be before any code runs, showing initial variable states if any.
    - **Loops:** For any loop construct (for, while, etc.), you MUST show the state before the loop, the check for the first two iterations, the body of the first two iterations, the check for the final iteration, the body of the final iteration, and the state after the loop terminates.
    - **Conditionals:** Show the evaluation of the conditional expression (e.g., \`if x > 5\`) as one step, and then the execution of the corresponding branch (if/else) as subsequent steps.
    - **Function Calls:** Include a step for the function call itself, steps for the execution inside the function, and a step showing the return from the function with the return value impacting the caller's scope.
    - **Variable State:** The 'variablesState' for each step MUST accurately reflect the state of all relevant variables *after* the line for that step has been executed.
    - **Console Output:** Every time a print or console log occurs, it MUST be its own separate step. The 'consoleOutput' field MUST contain the exact string that is printed, **including the trailing newline character ('\\n')** that functions like Python's \`print()\` add by default. If a function prints multiple lines, each line's output (including its newline) must be a separate step.
    - **Line Numbers:** The 'lineNumber' MUST be accurate and correspond to the line in the code being analyzed. For conceptual steps that don't map to a specific line (e.g., "Function returns"), you MUST OMIT the 'lineNumber' field entirely.
    - **VariablesState JSON:** The 'variablesState' field MUST be a valid, properly escaped JSON string.
        - **Example for simple variables**: For Python variables \`x = 10\` and \`status = "active"\`, the string should be \`"{\\"x\\": 10, \\"status\\": \\"active\\"}"\`.
        - **Example for objects/classes**: When a variable is a custom class instance, you MUST serialize its attributes into a JSON object within the string. For example, if a Python \`Task\` object has attributes \`title\` and \`completed\`, represent it as \`"{\\"task\\": {\\"title\\": \\"My Task\\", \\"completed\\": false}}"\`.
        - **CRITICAL**: Do NOT use native object string representations like Python's \`str()\` or \`repr()\`. Only use valid JSON constructs (double quotes for keys and strings, numbers, booleans, null, arrays, and objects).
        - If no variables are in scope, provide an empty object string: \`"{}"\`.
`;

const API_KEY = process.env.API_KEY;
const API_TIMEOUT_MS = 180000; // 180 seconds

let ai: GoogleGenAI | null = null;
if (API_KEY) {
  ai = new GoogleGenAI({ apiKey: API_KEY });
} else {
  console.error("API_KEY environment variable not found. Gemini API calls will fail. Ensure it's set in your execution environment.");
}

const displayNameToLangEnum: { [key: string]: SupportedLanguage } =
    Object.entries(LanguageDisplayNames).reduce((acc, [key, value]) => {
        const langKey = key as SupportedLanguage;
        const lowerValue = value.toLowerCase();
        acc[lowerValue] = langKey;
        if (lowerValue === 'c++') acc['cpp'] = langKey;
        if (lowerValue === 'javascript') acc['js'] = langKey;
        if (lowerValue === 'typescript') acc['ts'] = langKey;
        if (lowerValue === 'shell script') {
            acc['bash'] = langKey;
            acc['shell'] = langKey;
            acc['sh'] = langKey;
        }
        return acc;
    }, {} as { [key: string]: SupportedLanguage });


const promiseWithTimeout = <T>(
  promise: Promise<T>,
  ms: number,
  timeoutError = new Error("AI request timed out. Please try again.")
): Promise<T> => {
  let timer: number | undefined; 
  const timeoutPromise = new Promise<T>((_, reject) => {
    timer = window.setTimeout(() => reject(timeoutError), ms);
  });
  return Promise.race([promise, timeoutPromise]).finally(() => {
    if (timer) window.clearTimeout(timer);
  });
};

const parseJsonFromAiResponse = <T>(
    responseText: string | undefined, 
    fieldCheck: (parsed: any) => true | string 
): T => {
    if (typeof responseText !== 'string' || !responseText.trim()) {
        throw new Error("AI response was empty or invalid. This could be due to safety settings blocking the response, or an internal AI error. Please try modifying your request.");
    }
    let jsonStr = responseText.trim();
    
    const fenceRegex = /^```(?:json)?\s*\n?(.*?)\n?\s*```$/s;
    const match = jsonStr.match(fenceRegex);
    if (match && match[1]) {
        jsonStr = match[1].trim();
    }

    try {
        const parsedJson = JSON.parse(jsonStr);
        const checkResult = fieldCheck(parsedJson); 
        if (checkResult === true) {
            return parsedJson as T; 
        } else {
            console.error("AI response validation failed:", checkResult, "Validated object:", parsedJson);
            throw new Error(`AI response validation failed: ${checkResult}. The AI might be unable to process the request as expected. Check console for the actual validated object.`);
        }
    } catch (e) {
        console.error("Failed to parse or validate JSON response from AI:", e);
        console.error("Raw response text:", jsonStr);
        if (e instanceof Error && e.message.startsWith("AI response validation failed:")) {
            throw e; 
        }
        if (e instanceof SyntaxError) {
             throw new Error(`AI returned malformed JSON. ${e.message}. Raw (excerpt): ${jsonStr.substring(0,200)}...`);
        }
        throw new Error(`AI returned an invalid response format or failed validation. Please try again. Raw (excerpt): ${responseText.substring(0,200)}...`);
    }
};

const handleApiError = (error: unknown, defaultMessage: string): Error => {
    console.error("Error calling Gemini API:", error);
    if (error instanceof Error && typeof error.message === 'string') {
        if (error.message.includes("API key not valid") || error.message.includes("API_KEY_INVALID")) {
            return new Error("Invalid API Key: The provided API key is not valid. Please check your configuration.");
        }
        if (error.message.toLowerCase().includes("quota")) {
            return new Error("API Quota Exceeded: Your usage limits may have been reached. Please check your Google AI Studio dashboard for details.");
        }
        if (error.message.includes("500") || error.message.includes("503") || error.message.toLowerCase().includes("server error") || error.message.toLowerCase().includes("rpc failed")) {
            return new Error("AI Server Error: The service is currently experiencing issues. This is likely a temporary problem on the AI provider's side. Please try again in a few moments. If the problem persists, consider simplifying your request or trying a different AI model in the settings.");
        }
        if (error.message.startsWith("AI response validation failed:") || error.message.startsWith("AI returned malformed JSON.") || error.message.startsWith("AI request timed out") || error.message.startsWith("AI response was empty")) {
            return error;
        }
    }
    return new Error(defaultMessage);
};

const projectAnalysisFieldCheck = (parsed: any): true | string => {
    if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) return "Parsed JSON is not an object.";
    if (typeof parsed.overview !== 'string') return "Field 'overview' is not a string";
    if (!Array.isArray(parsed.fileBreakdown)) return "Field 'fileBreakdown' is not an array";
    const isBreakdownValid = parsed.fileBreakdown.every((item: any) =>
        typeof item === 'object' && item !== null &&
        typeof item.path === 'string' &&
        typeof item.description === 'string'
    );
    if (!isBreakdownValid) return "One or more elements in 'fileBreakdown' have an invalid structure.";
    return true;
};

const dependencyAnalysisFieldCheck = (parsed: any): true | string => {
    if (!Array.isArray(parsed)) return "Response is not an array.";
    const isValid = parsed.every((item: any) =>
        typeof item === 'object' && item !== null &&
        typeof item.name === 'string' &&
        typeof item.description === 'string'
    );
    if (!isValid) return "One or more elements in dependency array have an invalid structure.";
    return true;
};

const dependencyInfoFieldCheck = (parsed: any): true | string => {
    if (!Array.isArray(parsed)) return "Response is not an array.";
    const isValid = parsed.every((item: any) =>
        typeof item === 'object' && item !== null &&
        typeof item.modulePath === 'string' &&
        typeof item.description === 'string' &&
        Array.isArray(item.imports) &&
        Array.isArray(item.importedBy)
    );
    if (!isValid) return "One or more elements in dependency info array have an invalid structure.";
    return true;
};

export const generateReadmeWithGemini = async (files: ProjectFile[], overview: string, projectName: string, config: GeminiRequestConfig): Promise<string> => {
    if (!ai) throw new Error("Gemini AI client is not initialized.");
    
    const MAX_CONTENT_LENGTH = 100000;
    const filePaths = files.map(f => f.path).join('\n');
    let contentSample = `Project Overview: ${overview}\n\n`;
    const keyFiles = files.filter(f => f.path.includes('package.json') || f.path.includes('main.') || f.path.includes('index.') || f.path.includes('app.') || f.path.includes('src/App'));
    for (const file of keyFiles) {
        contentSample += `\n--- File: ${file.path} ---\n${file.content.substring(0, 2000)}\n`;
    }
    if (contentSample.length > MAX_CONTENT_LENGTH) {
        contentSample = contentSample.substring(0, MAX_CONTENT_LENGTH) + "\n... (content truncated)";
    }

    const prompt = `
You are a technical writer creating a README.md file for a software project.
Project Name: ${projectName}
File Structure:
${filePaths}

Key File Contents & Overview:
${contentSample}

Based on all the provided information, generate a comprehensive and well-formatted README.md file in Markdown format.
The README should include the following sections:
- A short, clear title for the project.
- A one-paragraph summary of the project's purpose.
- A "Key Features" section (as a bulleted list).
- A "Technologies Used" section (as a bulleted list).
- A "Getting Started" section with generic instructions for installation and running the project locally (e.g., \`npm install\`, \`npm run dev\`).

Respond ONLY with the raw Markdown text for the README.md file. Do not include any other text, explanations, or code fences around the entire response.
`;
    try {
        const response = await promiseWithTimeout<GenerateContentResponse>(
            ai.models.generateContent({
                model: config.model,
                contents: prompt,
                config: { temperature: config.temperature, topP: config.topP }
            }),
            API_TIMEOUT_MS
        );
        const text = response.text;
        if (typeof text !== 'string') {
            throw new Error("AI response for README was empty. This might be due to safety settings or an internal error.");
        }
        return text;
    } catch (error) {
        throw handleApiError(error, "Failed to generate README from AI.");
    }
};

export const analyzeDependenciesWithGemini = async (packageJsonContent: string, config: GeminiRequestConfig): Promise<DependencyAnalysis[]> => {
    if (!ai) throw new Error("Gemini AI client is not initialized.");
    
    let dependencies: any = {};
    try {
        const parsed = JSON.parse(packageJsonContent);
        dependencies = { ...parsed.dependencies, ...parsed.devDependencies };
        if (Object.keys(dependencies).length === 0) {
            return [];
        }
    } catch(e) {
        throw new Error("Invalid package.json format.");
    }

    const prompt = `
You are a software dependency analyst.
The user has provided the dependencies from a package.json file. For each dependency, provide a concise, one-sentence explanation of its purpose in a typical web project.

Respond ONLY with a valid JSON array of objects. Each object must have two keys: "name" (the package name) and "description" (the one-sentence explanation).

Dependencies to analyze:
${JSON.stringify(dependencies, null, 2)}
`;
    try {
        const response = await promiseWithTimeout<GenerateContentResponse>(
            ai.models.generateContent({
                model: config.model,
                contents: prompt,
                config: { 
                    responseMimeType: "application/json", 
                    temperature: config.temperature,
                    topP: config.topP,
                    responseSchema: {
                        type: Type.ARRAY,
                        items: {
                            type: Type.OBJECT,
                            properties: {
                                name: { type: Type.STRING },
                                description: { type: Type.STRING }
                            },
                            required: ['name', 'description']
                        }
                    }
                }
            }),
            API_TIMEOUT_MS
        );
        return parseJsonFromAiResponse<DependencyAnalysis[]>(response.text, dependencyAnalysisFieldCheck);
    } catch (error) {
        throw handleApiError(error, "Failed to analyze dependencies from AI.");
    }
};

export const getProjectDependenciesWithGemini = async (files: ProjectFile[], config: GeminiRequestConfig): Promise<DependencyInfo[]> => {
    if (!ai) throw new Error("Gemini AI client is not initialized.");

    const MAX_FILES_FOR_CONTEXT = 75;
    const filesForContext = files.length > MAX_FILES_FOR_CONTEXT ? files.slice(0, MAX_FILES_FOR_CONTEXT) : files;

    const fileContents = filesForContext.map(f => `
---
File: ${f.path}
---
${f.content.substring(0, 3000)}
---
`).join('\n\n');

    const prompt = `
You are a software architect analyzing project dependencies.
Based on the provided file contents, identify the 5-7 most important modules/files that form the core architecture of this project.

For each of these key modules, provide an analysis of its relationships with other files within the project. Your output MUST be a JSON array of objects.

Each object in the array represents one key module and MUST have the following keys:
- "modulePath": The full path of the key module file.
- "description": A concise, one-sentence summary of this module's role in the project.
- "imports": An array of strings, listing the file paths (within the project) that this module imports or requires.
- "importedBy": An array of strings, listing the file paths (within aproject) that import or require this module.

Focus only on internal project dependencies (local file imports), not external libraries (e.g., 'react', 'express'). If a module has no internal imports or is not imported by any other file, use an empty array [].

File Contents:
${fileContents}
`;
    try {
        const response = await promiseWithTimeout<GenerateContentResponse>(
            ai.models.generateContent({
                model: config.model,
                contents: prompt,
                config: { 
                    responseMimeType: "application/json", 
                    temperature: config.temperature,
                    topP: config.topP,
                    responseSchema: {
                        type: Type.ARRAY,
                        items: {
                            type: Type.OBJECT,
                            properties: {
                                modulePath: { type: Type.STRING },
                                description: { type: Type.STRING },
                                imports: { type: Type.ARRAY, items: { type: Type.STRING } },
                                importedBy: { type: Type.ARRAY, items: { type: Type.STRING } }
                            },
                            required: ['modulePath', 'description', 'imports', 'importedBy']
                        }
                    }
                }
            }),
            API_TIMEOUT_MS
        );
        return parseJsonFromAiResponse<DependencyInfo[]>(response.text, dependencyInfoFieldCheck);
    } catch (error) {
        throw handleApiError(error, "Failed to generate architecture report from AI.");
    }
};

export const askProjectFollowUpWithGemini = async (
    latestUserQuestion: string, 
    chatHistory: ChatMessage[],
    projectOverview: string,
    filePaths: string[],
    config: GeminiRequestConfig
): Promise<string> => {
    if (!ai) throw new Error("Gemini AI client is not initialized.");

    const conversationHistoryString = chatHistory
        .map(message => `${message.role === 'user' ? 'User' : 'AI'}: ${message.content}`)
        .join('\n');
    
    const projectContext = `
Project Overview: ${projectOverview}
File Structure:
${filePaths.join('\n')}
    `;

    const prompt = `
You are an expert software architect acting as a project-wide conversational assistant.
You have the context of an entire project, including its overview and file structure.

Project Context:
${projectContext}

Conversation History:
${conversationHistoryString}

The user has a new question:
User: "${latestUserQuestion}"

Please provide a clear, concise, and helpful answer to the user's LATEST question.
Your answer should be plain text, suitable for direct display. Do not use JSON.
`;

    try {
        const response = await promiseWithTimeout<GenerateContentResponse>(
            ai.models.generateContent({
                model: config.model,
                contents: prompt,
                config: { temperature: config.temperature, topP: config.topP }
            }),
            API_TIMEOUT_MS
        );
        const text = response.text;
        if (typeof text !== 'string') {
            throw new Error("AI response was empty. Please try rephrasing your question.");
        }
        return text;
    } catch (error) {
        throw handleApiError(error, "Failed to get an answer for your project-wide question.");
    }
};

export const analyzeProjectWithGemini = async (
    files: ProjectFile[],
    projectName: string,
    config: GeminiRequestConfig
): Promise<ProjectAnalysis> => {
    if (!ai) throw new Error("Gemini AI client is not initialized. Ensure API_KEY is set.");

    const MAX_PATHS_LENGTH = 100000;
    const filePaths = files.map(f => f.path);
    let filePathsString = filePaths.join('\n');
    if (filePathsString.length > MAX_PATHS_LENGTH) {
        filePathsString = filePathsString.substring(0, MAX_PATHS_LENGTH) + "\n... (file list truncated)";
    }

    const prompt = `
You are an expert software architect. A user has uploaded a project named "${projectName}".
Based on the file structure provided below, please provide a high-level analysis of the project.

File Structure:
\`\`\`
${filePathsString}
\`\`\`

Provide your analysis ONLY as a valid JSON object with the following exact keys: "overview" and "fileBreakdown".
- "overview": A single paragraph explaining the project's likely purpose, architecture, and technology stack.
- "fileBreakdown": An array of objects, where each object represents a file. Each object MUST have keys: "path" and "description".
`;

    try {
        const geminiConfig: any = {
            responseMimeType: "application/json",
            temperature: config.temperature,
            topP: config.topP,
            responseSchema: {
                type: Type.OBJECT,
                properties: {
                    overview: { type: Type.STRING },
                    fileBreakdown: {
                        type: Type.ARRAY,
                        items: {
                            type: Type.OBJECT,
                            properties: {
                                path: { type: Type.STRING },
                                description: { type: Type.STRING }
                            },
                            required: ['path', 'description']
                        }
                    }
                },
                required: ['overview', 'fileBreakdown']
            }
        };
        if (config.systemInstruction) {
            geminiConfig.systemInstruction = config.systemInstruction;
        }
        
        const response = await promiseWithTimeout<GenerateContentResponse>(
            ai.models.generateContent({
                model: config.model,
                contents: prompt,
                config: geminiConfig
            }),
            API_TIMEOUT_MS
        );
        return parseJsonFromAiResponse<ProjectAnalysis>(response.text, projectAnalysisFieldCheck);
    } catch (error) {
        throw handleApiError(error, "Failed to get project analysis from AI. The project might be too large or an API error occurred.");
    }
};

const analysisResultFieldCheck = (parsed: any): true | string => {
    if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) return "Parsed JSON is not an object.";
    if (!parsed.topicExplanation) return "Missing 'topicExplanation' object";
    if (typeof parsed.exampleCode !== 'string') return "Field 'exampleCode' is not a string";
    if (typeof parsed.exampleCodeOutput !== 'string') return "Field 'exampleCodeOutput' is not a string";
    if (typeof parsed.practiceContext !== 'object' || parsed.practiceContext === null) return "Missing 'practiceContext' object";
    return true;
};

const practiceMaterialFieldCheck = (parsed: any): true | string => {
    if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) return "Parsed JSON is not an object.";
    if (typeof parsed.title !== 'string') return "Field 'title' is not a string";
    if (typeof parsed.questionText !== 'string') return "Field 'questionText' is not a string";
    if (!Array.isArray(parsed.normalInstructionsLevel1)) return "Field 'normalInstructionsLevel1' is not an array";
    if (!Array.isArray(parsed.lineByLineInstructions)) return "Field 'lineByLineInstructions' is not an array";
    if (typeof parsed.solutionCode !== 'string') return "Field 'solutionCode' is not a string";
    if (typeof parsed.solutionOutput !== 'string') return "Field 'solutionOutput' is not a string";
    return true;
};

const userSolutionAnalysisFieldCheck = (parsed: any): true | string => {
    if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) return "Parsed JSON is not an object.";
    if (typeof parsed.predictedOutput !== 'string') return "Field 'predictedOutput' is not a string";
    if (typeof parsed.feedback !== 'string') return "Field 'feedback' is not a string";
    if (parsed.hasOwnProperty('isCorrect') && typeof parsed.isCorrect !== 'boolean') {
        return "Optional field 'isCorrect' is present but not a boolean";
    }
    const validStatuses: AssessmentStatus[] = ['correct', 'partially_correct', 'incorrect', 'syntax_error', 'unrelated'];
    if (parsed.hasOwnProperty('assessmentStatus') && !validStatuses.includes(parsed.assessmentStatus)) {
        return `Optional field 'assessmentStatus' has an invalid value: ${parsed.assessmentStatus}`;
    }
    return true;
};

const moreInstructionsResponseFieldCheck = (parsed: any): true | string => {
    if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) return "Parsed JSON is not an object.";
    if (!Array.isArray(parsed.newInstructionSteps)) return "Field 'newInstructionSteps' is not an array";
    if (typeof parsed.hasMoreLevels !== 'boolean') return "Field 'hasMoreLevels' is not a boolean";
    return true;
};

const exampleCodeDataFieldCheck = (parsed: any): true | string => {
    if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) return "Parsed JSON is not an object.";
    if (typeof parsed.exampleCode !== 'string') return "Field 'exampleCode' is not a string";
    if (typeof parsed.exampleCodeOutput !== 'string') return "Field 'exampleCodeOutput' is not a string";
    return true;
};

const debugResultFieldCheck = (parsed: any): true | string => {
    if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) return "Parsed JSON is not an object.";
    if (typeof parsed.summary !== 'string') return "Field 'summary' is not a string";
    if (typeof parsed.correctedCode !== 'string') return "Field 'correctedCode' is not a string";
    if (!Array.isArray(parsed.errorAnalysis)) return "Field 'errorAnalysis' is not an array";
    return true;
};

const fileToGenerativePart = async (file: File): Promise<{ inlineData: { data: string; mimeType: string; } }> => {
    const base64EncodedDataPromise = new Promise<string>((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve((reader.result as string).split(',')[1]);
      reader.readAsDataURL(file);
    });
    return {
      inlineData: {
        data: await base64EncodedDataPromise,
        mimeType: file.type,
      },
    };
};

export const extractCodeFromImageWithGemini = async (
    imageFile: File,
    config: GeminiRequestConfig
): Promise<string> => {
    if (!ai) throw new Error("Gemini AI client is not initialized. Ensure API_KEY is set.");
    if (!imageFile.type.startsWith("image/")) {
        throw new Error("Invalid file type. Please upload an image.");
    }

    const imagePart = await fileToGenerativePart(imageFile);

    const prompt = `
Analyze the provided image and extract any and all code present within it.
Return ONLY the raw, extracted code. Do NOT include any explanations, introductory text, or markdown formatting (like \`\`\`) around the code.
If no code is found, return an empty string.
`;
    
    try {
        const response = await promiseWithTimeout<GenerateContentResponse>(
            ai.models.generateContent({
                model: config.model,
                contents: { parts: [imagePart, { text: prompt }] },
                config: { temperature: 0.1 }
            }),
            API_TIMEOUT_MS
        );
        
        const text = response.text;
        if (typeof text !== 'string' || text.trim() === "") {
             throw new Error("AI could not detect any code in the image. Please try a different image.");
        }
        
        let extractedCode = text.trim();
        const fenceRegex = /^```(?:\w+)?\s*\n?(.*?)\n?\s*```$/s;
        const match = extractedCode.match(fenceRegex);
        if (match && match[1]) {
            extractedCode = match[1].trim();
        }

        return extractedCode;

    } catch (error) {
        throw handleApiError(error, "Failed to extract code from image. The image may be unclear or an API error occurred.");
    }
};

const practiceMaterialSchema = {
    type: Type.OBJECT,
    properties: {
        title: { type: Type.STRING },
        questionText: { type: Type.STRING },
        normalInstructionsLevel1: { type: Type.ARRAY, items: { type: Type.STRING } },
        lineByLineInstructions: { type: Type.ARRAY, items: { type: Type.STRING } },
        solutionCode: { type: Type.STRING },
        solutionOutput: { type: Type.STRING },
    },
    required: ['title', 'questionText', 'normalInstructionsLevel1', 'lineByLineInstructions', 'solutionCode', 'solutionOutput']
};

const analysisResultSchema = {
    type: Type.OBJECT,
    properties: {
        topicExplanation: {
            type: Type.OBJECT,
            properties: {
                coreConcepts: {
                    type: Type.OBJECT,
                    properties: {
                        title: { type: Type.STRING },
                        explanation: { type: Type.STRING },
                        concepts: {
                            type: Type.ARRAY,
                            items: {
                                type: Type.OBJECT,
                                properties: {
                                    name: { type: Type.STRING },
                                    description: { type: Type.STRING },
                                    points: { type: Type.ARRAY, items: { type: Type.STRING } }
                                },
                                required: ['name', 'description']
                            }
                        }
                    },
                    required: ['title', 'explanation', 'concepts']
                },
                blockByBlockBreakdown: {
                    type: Type.ARRAY,
                    items: {
                        type: Type.OBJECT,
                        properties: { codeBlock: { type: Type.STRING }, explanation: { type: Type.STRING } },
                        required: ['codeBlock', 'explanation']
                    }
                },
                lineByLineBreakdown: {
                    type: Type.ARRAY,
                    items: {
                        type: Type.OBJECT,
                        properties: { code: { type: Type.STRING }, explanation: { type: Type.STRING } },
                        required: ['code', 'explanation']
                    }
                },
                executionFlowAndDataTransformation: { type: Type.STRING },
                visualExecutionFlow: {
                    type: Type.ARRAY,
                    items: {
                        type: Type.OBJECT,
                        properties: {
                            lineNumber: { type: Type.NUMBER },
                            explanation: { type: Type.STRING },
                            variablesState: {
                                type: Type.STRING,
                                description: "A JSON string representation of an object containing variable names as keys and their current values."
                            },
                            consoleOutput: { type: Type.STRING },
                            inputRequired: {
                                type: Type.OBJECT,
                                properties: {
                                    prompt: { type: Type.STRING },
                                    variableName: { type: Type.STRING }
                                },
                                required: ['prompt', 'variableName']
                            }
                        },
                        required: ['explanation', 'variablesState']
                    }
                }
            },
            required: ['coreConcepts', 'blockByBlockBreakdown', 'lineByLineBreakdown', 'executionFlowAndDataTransformation', 'visualExecutionFlow']
        },
        exampleCode: { type: Type.STRING },
        exampleCodeOutput: { type: Type.STRING },
        practiceContext: {
            type: Type.OBJECT,
            properties: {
                generatedQuestion: practiceMaterialSchema,
                userCodeAsPractice: practiceMaterialSchema
            },
            required: ['generatedQuestion', 'userCodeAsPractice']
        },
        detectedLanguage: { type: Type.STRING }
    },
    required: ['topicExplanation', 'exampleCode', 'exampleCodeOutput', 'practiceContext']
};


export const analyzeCodeWithGemini = async (
    codeContent: string,
    language: SupportedLanguage,
    initialDifficulty: ExampleDifficulty,
    practiceDifficulty: ExampleDifficulty,
    config: GeminiRequestConfig
): Promise<AnalysisResult> => {
    if (!ai) throw new Error("Gemini AI client is not initialized. Ensure API_KEY is set.");

    const isDetectingLanguage = language === SupportedLanguage.UNKNOWN;
    let prompt: string;
    const languageNameForPrompt = isDetectingLanguage ? 'the detected language' : LanguageDisplayNames[language];

    prompt = `
You are an expert programming tutor. Analyze the provided code.
${isDetectingLanguage ? 'First, identify the programming language.' : `The language is ${languageNameForPrompt}.`}
Provide a full analysis based on the user's code. Your response must be a JSON object matching the provided schema.

${DIFFICULTY_GUIDE}

Key Instructions for JSON fields:
- **topicExplanation**: This entire section MUST be a detailed analysis of the user's provided code.
- **exampleCode**: You MUST generate a NEW, DIFFERENT, and ALTERNATE code example that teaches the same core concepts found in the user's code. This new example's difficulty MUST match the requested '${initialDifficulty}' level, following the guide above. It MUST NOT be the same as the user's code.
- **practiceContext.generatedQuestion**: Generate a new practice problem for the user to solve. This problem's difficulty MUST match the requested '${practiceDifficulty}' level, following the guide above.
- **practiceContext.userCodeAsPractice**: Take the user's original code and frame it as a practice problem (e.g., create a suitable title and question text for it).
${VISUAL_FLOW_INSTRUCTIONS}

User's Code to analyze:
\`\`\`
${codeContent}
\`\`\`
Respond ONLY with a valid JSON object matching the provided schema.
`;
    
    try {
        const geminiConfig: any = {
            responseMimeType: "application/json",
            temperature: config.temperature,
            topP: config.topP,
            responseSchema: analysisResultSchema
        };
        if (config.systemInstruction) {
            geminiConfig.systemInstruction = config.systemInstruction;
        }

        const response = await promiseWithTimeout<GenerateContentResponse>(
            ai.models.generateContent({
                model: config.model,
                contents: prompt,
                config: geminiConfig
            }),
            API_TIMEOUT_MS
        );
        const parsedResult = parseJsonFromAiResponse<AnalysisResult>(response.text, analysisResultFieldCheck);
        
        if (parsedResult.topicExplanation?.visualExecutionFlow) {
            parsedResult.topicExplanation.visualExecutionFlow.forEach(step => {
                if (typeof (step as any).variablesState === 'string') {
                    try {
                        step.variablesState = JSON.parse((step as any).variablesState);
                    } catch (e) {
                        console.warn(`Could not parse variablesState string from AI: ${(step as any).variablesState}`, e);
                        step.variablesState = { parsing_error: "AI returned invalid JSON for variablesState." };
                    }
                }
            });
        }
        
        if (isDetectingLanguage && typeof (parsedResult as any).detectedLanguage === 'string') {
             const langStr = (parsedResult as any).detectedLanguage.toLowerCase();
             const detectedEnum = displayNameToLangEnum[langStr] || SupportedLanguage.UNKNOWN;
             parsedResult.detectedLanguage = detectedEnum;
        }
        return parsedResult;
    } catch (error) {
        throw handleApiError(error, "Failed to get analysis from AI. Check network/API key, then try again.");
    }
};

export const analyzeConceptWithGemini = async (
    concept: string,
    language: SupportedLanguage,
    initialDifficulty: ExampleDifficulty,
    practiceDifficulty: ExampleDifficulty,
    config: GeminiRequestConfig
): Promise<AnalysisResult> => {
    if (!ai) throw new Error("Gemini AI client is not initialized. Ensure API_KEY is set.");
    if (language === SupportedLanguage.UNKNOWN) throw new Error("Cannot analyze a concept for an unknown language context.");

    const languageName = LanguageDisplayNames[language];

    const prompt = `
You are an expert programming tutor. A user wants to understand: "${concept}" in ${languageName}.
Provide a full analysis. Your response MUST be a JSON object matching the provided schema.

${DIFFICULTY_GUIDE}

Key Instructions for JSON fields:
- **exampleCode**: You MUST generate a code example to explain the concept. This example's difficulty MUST match the requested '${initialDifficulty}' level, following the guide above. This example will be the basis for the rest of the analysis.
- **topicExplanation**: This entire section must be a detailed analysis of the code you generated for 'exampleCode'.
- **practiceContext.generatedQuestion**: Generate a new practice problem for the user to solve. This problem's difficulty MUST match the requested '${practiceDifficulty}' level, following the guide above.
- **practiceContext.userCodeAsPractice**: Since the user provided a concept and not code, you should create a simple "practice" item based on the example code you generated. Give it a title like "Review: ${concept}" and question text like "Review the code example that demonstrates ${concept}". Use the code from 'exampleCode' as the 'solutionCode'.
${VISUAL_FLOW_INSTRUCTIONS}

Respond ONLY with a valid JSON object matching the provided schema.
`;

    try {
        const geminiConfig: any = {
            responseMimeType: "application/json",
            temperature: config.temperature,
            topP: config.topP,
            responseSchema: analysisResultSchema
        };
        if (config.systemInstruction) {
            geminiConfig.systemInstruction = config.systemInstruction;
        }

        const response = await promiseWithTimeout<GenerateContentResponse>(
            ai.models.generateContent({
                model: config.model,
                contents: prompt,
                config: geminiConfig
            }),
            API_TIMEOUT_MS
        );
        
        const parsedResult = parseJsonFromAiResponse<AnalysisResult>(response.text, analysisResultFieldCheck);

        if (parsedResult.topicExplanation?.visualExecutionFlow) {
            parsedResult.topicExplanation.visualExecutionFlow.forEach(step => {
                if (typeof (step as any).variablesState === 'string') {
                    try {
                        step.variablesState = JSON.parse((step as any).variablesState);
                    } catch (e) {
                        console.warn(`Could not parse variablesState string from AI: ${(step as any).variablesState}`, e);
                        step.variablesState = { parsing_error: "AI returned invalid JSON for variablesState." };
                    }
                }
            });
        }
        
        return parsedResult;

    } catch (error) {
        throw handleApiError(error, "Failed to get concept analysis from AI. Check network/API key, then try again.");
    }
};


export const getMoreInstructionsFromGemini = async (
    practiceQuestion: string,
    currentInstructionsSoFar: string[],
    language: SupportedLanguage,
    currentLevelNumber: number,
    config: GeminiRequestConfig
): Promise<{ newInstructionSteps: string[], hasMoreLevels: boolean }> => {
    if (!ai) throw new Error("Gemini AI client is not initialized. Ensure API_KEY is set.");

    const languageName = LanguageDisplayNames[language];
    const instructionsContext = `Instructions provided so far:\n${currentInstructionsSoFar.join('\n')}`;

    const prompt = `
You are an expert programming tutor providing progressive hints for a practice problem.
Language: ${languageName}
Practice Question: "${practiceQuestion}"
${instructionsContext}
Your Task: Generate ONLY the instructions for the next level (${currentLevelNumber + 1}), which must be an incrementally more detailed breakdown of the previous level's steps.
Respond ONLY with a valid JSON object with keys: "newInstructionSteps" (array of strings) and "hasMoreLevels" (boolean).
`;

    try {
        const response = await promiseWithTimeout<GenerateContentResponse>(
            ai.models.generateContent({
                model: config.model,
                contents: prompt,
                config: { 
                    responseMimeType: "application/json", 
                    temperature: 0.35,
                    responseSchema: {
                        type: Type.OBJECT,
                        properties: {
                            newInstructionSteps: { type: Type.ARRAY, items: { type: Type.STRING } },
                            hasMoreLevels: { type: Type.BOOLEAN }
                        },
                        required: ['newInstructionSteps', 'hasMoreLevels']
                    }
                }
            }),
            API_TIMEOUT_MS
        );
        return parseJsonFromAiResponse<{ newInstructionSteps: string[], hasMoreLevels: boolean }>(response.text, moreInstructionsResponseFieldCheck);
    } catch (error) {
        throw handleApiError(error, "Failed to get more instructions from AI. Please try again.");
    }
};


export const checkUserSolutionWithGemini = async (
    userCode: string, 
    language: SupportedLanguage, 
    practiceQuestionText: string,
    topicCoreConcepts: string,
    instructionsProvidedToUser: string[],
    config: GeminiRequestConfig
): Promise<UserSolutionAnalysis> => {
    if (!ai) throw new Error("Gemini AI client is not initialized. Ensure API_KEY is set.");
    if (language === SupportedLanguage.UNKNOWN) throw new Error("Cannot analyze solution for an unknown language.");

    const languageName = LanguageDisplayNames[language];

    const prompt = `
You are an expert programming tutor. Analyze the user's submitted solution.
Language: ${languageName}
Topic: "${topicCoreConcepts}"
Practice Question: "${practiceQuestionText}"
User's Code:
\`\`\`${languageName.toLowerCase()}
${userCode}
\`\`\`
Analyze the user's solution and determine if it correctly solves the practice question.
Respond with a JSON object with keys: "predictedOutput", "feedback", "isCorrect", and "assessmentStatus".
- "assessmentStatus" MUST be one of: 'correct', 'partially_correct', 'incorrect', 'syntax_error', 'unrelated'.
- "isCorrect" must be a boolean, true only if assessmentStatus is 'correct'.
`;
    try {
        const response = await promiseWithTimeout<GenerateContentResponse>(
            ai.models.generateContent({
                model: config.model,
                contents: prompt,
                config: { 
                    responseMimeType: "application/json", 
                    temperature: config.temperature,
                    topP: config.topP,
                    responseSchema: {
                        type: Type.OBJECT,
                        properties: {
                            predictedOutput: { type: Type.STRING },
                            feedback: { type: Type.STRING },
                            isCorrect: { type: Type.BOOLEAN },
                            assessmentStatus: { type: Type.STRING }
                        },
                        required: ['predictedOutput', 'feedback', 'isCorrect', 'assessmentStatus']
                    }
                }
            }),
            API_TIMEOUT_MS
        );
        return parseJsonFromAiResponse<UserSolutionAnalysis>(response.text, userSolutionAnalysisFieldCheck);
    } catch (error) {
       throw handleApiError(error, "Failed to get feedback for your solution. Check network/API key, then try again.");
    }
};

export const getExampleByDifficulty = async (
    topicCoreConcepts: string,
    language: SupportedLanguage, 
    difficulty: ExampleDifficulty,
    config: GeminiRequestConfig
): Promise<ExampleCodeData> => {
    if (!ai) throw new Error("Gemini AI client is not initialized. Ensure API_KEY is set.");
    if (language === SupportedLanguage.UNKNOWN) throw new Error("Cannot generate example for an unknown language.");

    const languageName = LanguageDisplayNames[language];
    const prompt = `
You are an expert programming tutor tasked with generating a code example.
Concept: "${topicCoreConcepts}"
Language: ${languageName}
Requested Difficulty: "${difficulty}"

${DIFFICULTY_GUIDE}

Based on the requested difficulty ("${difficulty}"), generate a code example and its expected output.
Your response MUST be ONLY a valid JSON object with the keys "exampleCode" and "exampleCodeOutput". Do not include any other text or explanations.
`;
    try {
        const response = await promiseWithTimeout<GenerateContentResponse>(
            ai.models.generateContent({
                model: config.model,
                contents: prompt,
                config: { 
                    responseMimeType: "application/json",
                    temperature: config.temperature,
                    topP: config.topP,
                    responseSchema: {
                        type: Type.OBJECT,
                        properties: {
                            exampleCode: { type: Type.STRING },
                            exampleCodeOutput: { type: Type.STRING }
                        },
                        required: ['exampleCode', 'exampleCodeOutput']
                    }
                }
            }),
            API_TIMEOUT_MS
        );
        return parseJsonFromAiResponse<ExampleCodeData>(response.text, exampleCodeDataFieldCheck);
    } catch (error) {
        throw handleApiError(error, `Failed to generate ${difficulty} example from AI. Try again.`);
    }
};

export const getPracticeQuestionByDifficulty = async (
    topicCoreConcepts: string,
    language: SupportedLanguage,
    difficulty: ExampleDifficulty,
    config: GeminiRequestConfig
): Promise<PracticeMaterial> => {
    if (!ai) throw new Error("Gemini AI client is not initialized. Ensure API_KEY is set.");
    if (language === SupportedLanguage.UNKNOWN) throw new Error("Cannot generate practice question for an unknown language.");

    const languageName = LanguageDisplayNames[language];
    
    const prompt = `
You are an expert programming tutor. Generate a new practice question.
Concept: "${topicCoreConcepts}"
Language: ${languageName}
Requested Difficulty: "${difficulty}"

${DIFFICULTY_GUIDE}

Based on the requested difficulty ("${difficulty}"), generate a complete practice package as a JSON object matching the provided schema. The question should test the user's understanding of the concept at that difficulty level.
`;

    try {
        const response = await promiseWithTimeout<GenerateContentResponse>(
            ai.models.generateContent({
                model: config.model,
                contents: prompt,
                config: { 
                    responseMimeType: "application/json", 
                    temperature: config.temperature,
                    topP: config.topP,
                    responseSchema: practiceMaterialSchema
                }
            }),
            API_TIMEOUT_MS
        );
        return parseJsonFromAiResponse<PracticeMaterial>(response.text, practiceMaterialFieldCheck);
    } catch (error) {
        throw handleApiError(error, `Failed to generate ${difficulty} practice question from AI. Try again.`);
    }
};

export const askFollowUpQuestionWithGemini = async (
    latestUserQuestion: string, 
    chatHistory: ChatMessage[],
    fullExplanationContext: string,
    language: SupportedLanguage,
    originalInputContext: string,
    inputType: 'code' | 'concept',
    config: GeminiRequestConfig
): Promise<string> => {
    if (!ai) throw new Error("Gemini AI client is not initialized. Ensure API_KEY is set.");
    
    const conversationHistoryString = chatHistory
        .map(message => `${message.role === 'user' ? 'User' : 'AI'}: ${message.content}`)
        .join('\n');

    const prompt = `
You are a programming tutor continuing a session.
Full context of original analysis: """${fullExplanationContext}"""
Conversation so far:
${conversationHistoryString}
User's new question: "${latestUserQuestion}"
Provide a clear, concise answer to the user's LATEST message, keeping all prior context in mind.
Answer in plain text, not JSON.
`;

    try {
        const response = await promiseWithTimeout<GenerateContentResponse>(
            ai.models.generateContent({
                model: config.model,
                contents: prompt,
                config: { temperature: config.temperature, topP: config.topP }
            }),
            API_TIMEOUT_MS
        );
        const text = response.text;
        if (typeof text !== 'string') {
            throw new Error("AI response was empty. Please try rephrasing your question.");
        }
        return text;
    } catch (error) {
        throw handleApiError(error, "Failed to get an answer from AI for your follow-up question. Please try again.");
    }
};

export const executeCodeWithGemini = async (
    code: string,
    language: SupportedLanguage,
    config: GeminiRequestConfig
): Promise<string> => {
    if (!ai) throw new Error("Gemini AI client is not initialized. Check API_KEY configuration.");
    if (language === SupportedLanguage.UNKNOWN) throw new Error("Cannot execute code for an unknown language.");

    const languageName = LanguageDisplayNames[language];

    const prompt = `
Execute the provided ${languageName} code and return ONLY the raw standard output (stdout).
- If there is output, return only that output.
- If there is no output, return "[No output produced]".
- If there is an error, return ONLY the error message.
- Do not add any explanations or formatting.
Code:
\`\`\`${languageName.toLowerCase()}
${code}
\`\`\`
`;

    try {
        const response = await promiseWithTimeout<GenerateContentResponse>(
            ai.models.generateContent({
                model: config.model,
                contents: prompt,
                config: { temperature: 0.0 }
            }),
            API_TIMEOUT_MS
        );
        
        const text = response.text;
        if (typeof text !== 'string') {
            throw new Error("AI execution failed to produce a result. This might be due to safety settings or an internal error.");
        }
        return text;

    } catch (error) {
        throw handleApiError(error, "Failed to get execution result from AI. Please try again.");
    }
};

export const debugCodeWithGemini = async (
    brokenCode: string,
    language: SupportedLanguage,
    config: GeminiRequestConfig
): Promise<DebugResult> => {
    if (!ai) throw new Error("Gemini AI client is not initialized. Ensure API_KEY is set.");

    const isDetectingLanguage = language === SupportedLanguage.UNKNOWN;

    const prompt = `
You are an expert code debugger.
${isDetectingLanguage ? 'First, detect the programming language of the code.' : ''}
Then, identify all syntax and logical errors, explain them clearly, and provide the fully corrected code.
User's code to debug:
\`\`\`
${brokenCode}
\`\`\`
Provide your response ONLY as a valid JSON object matching the schema.
`;
    
    const fieldCheck = (parsed: any): true | string => {
        if (isDetectingLanguage) {
            if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) return "Parsed JSON is not an object.";
            if (parsed.hasOwnProperty('detectedLanguage') && typeof parsed.detectedLanguage !== 'string') {
                return "Optional field 'detectedLanguage' must be a string if present.";
            }
        }
        return debugResultFieldCheck(parsed);
    };

    try {
        const geminiConfig: any = {
            responseMimeType: "application/json",
            temperature: config.temperature,
            topP: config.topP,
            responseSchema: {
                type: Type.OBJECT,
                properties: {
                    detectedLanguage: { type: Type.STRING },
                    summary: { type: Type.STRING },
                    errorAnalysis: {
                        type: Type.ARRAY,
                        items: {
                            type: Type.OBJECT,
                            properties: {
                                errorLine: { type: Type.NUMBER },
                                erroneousCode: { type: Type.STRING },
                                errorType: { type: Type.STRING },
                                explanation: { type: Type.STRING },
                                suggestedFix: { type: Type.STRING }
                            },
                            required: ['erroneousCode', 'errorType', 'explanation', 'suggestedFix']
                        }
                    },
                    correctedCode: { type: Type.STRING }
                },
                required: ['summary', 'errorAnalysis', 'correctedCode']
            }
        };
        if (config.systemInstruction) {
            geminiConfig.systemInstruction = config.systemInstruction;
        }
        if (!isDetectingLanguage) {
            delete geminiConfig.responseSchema.properties.detectedLanguage;
        }


        const response = await promiseWithTimeout<GenerateContentResponse>(
            ai.models.generateContent({
                model: config.model,
                contents: prompt,
                config: geminiConfig
            }),
            API_TIMEOUT_MS
        );
        const parsedResult = parseJsonFromAiResponse<DebugResult>(response.text, fieldCheck);
        
        if (isDetectingLanguage && typeof (parsedResult as any).detectedLanguage === 'string') {
             const langStr = (parsedResult as any).detectedLanguage.toLowerCase();
             const detectedEnum = displayNameToLangEnum[langStr] || SupportedLanguage.UNKNOWN;
             parsedResult.detectedLanguage = detectedEnum;
        }
        return parsedResult;

    } catch (error) {
        throw handleApiError(error, "Failed to get debugging analysis from AI. Please try again.");
    }
};
