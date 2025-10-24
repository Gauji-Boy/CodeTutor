import { GoogleGenAI, GenerateContentResponse } from "@google/genai";
import { 
    AnalysisResult, 
    SupportedLanguage, 
    UserSolutionAnalysis, 
    LanguageDisplayNames,
    ExampleDifficulty,
    ExampleCodeData,
    PracticeMaterial,
    LineByLineExplanation,
    AssessmentStatus,
    BlockExplanation,
    ChatMessage,
    PracticeContext,
    VisualFlowStep,
    DebugResult,
    ProjectAnalysis,
    ProjectFile,
    DependencyAnalysis,
    DependencyInfo
} from '../types';

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
        // Add common aliases
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


// Utility function to add timeout to promises
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
    responseText: string, 
    fieldCheck: (parsed: any) => true | string 
): T => {
    let jsonStr = responseText.trim();
    
    const fenceRegex = /^```(?:json)?\s*\n?(.*?)\n?\s*```$/s;
    const match = jsonStr.match(fenceRegex);
    if (match && match[1]) {
        jsonStr = match[1].trim();
    }

    try {
        const parsedJson = JSON.parse(jsonStr);
        let dataToValidate = parsedJson;

        // Determine if the validator expects an array by testing it with an empty array.
        // An array-validator should pass, while an object-validator should fail.
        const validatorExpectsArray = fieldCheck([]) === true;

        if (Array.isArray(dataToValidate)) {
            if (!validatorExpectsArray) {
                // The validator wants an object, but we received an array.
                if (dataToValidate.length === 1) {
                    // This is likely the AI wrapping a single object response in an array, so we unwrap it.
                    dataToValidate = dataToValidate[0];
                } else if (dataToValidate.length === 0) {
                    // An empty array is not a valid object.
                    throw new Error("AI returned an empty array, but an object was expected.");
                }
                // If length > 1 and an object is expected, it will fail the final validation, which is correct.
            }
            // If the validator *does* expect an array, we do nothing here and let it pass to the final validation.
        }
        
        // Pre-validation normalization for common AI response inconsistencies, especially for code fields.
        const normalizeCodeField = (obj: any, fieldName: string) => {
            if (obj && typeof obj === 'object' && !Array.isArray(obj) && obj.hasOwnProperty(fieldName)) {
                const codeField = obj[fieldName];
                
                // Case 1: AI returns an object like { "code": "..." } or { "exampleCode": "..." }
                if (typeof codeField === 'object' && codeField !== null && !Array.isArray(codeField)) {
                    if (typeof codeField.code === 'string') {
                        obj[fieldName] = codeField.code; // Handles { "code": "..." }
                        return; // Normalization done
                    }
                    if (typeof codeField[fieldName] === 'string') {
                        obj[fieldName] = codeField[fieldName]; // Handles { "exampleCode": "..." for field 'exampleCode'
                        return; // Normalization done
                    }
                }
                // Case 2: AI returns an array of code lines.
                else if (Array.isArray(codeField) && codeField.every((item: any) => typeof item === 'string')) {
                    obj[fieldName] = codeField.join('\n');
                }
            }
        };

        // Normalize top-level and nested code fields before validation.
        normalizeCodeField(dataToValidate, 'exampleCode');
        if (dataToValidate && dataToValidate.practiceContext) {
            if(dataToValidate.practiceContext.generatedQuestion) {
                 normalizeCodeField(dataToValidate.practiceContext.generatedQuestion, 'solutionCode');
            }
            if(dataToValidate.practiceContext.userCodeAsPractice) {
                 normalizeCodeField(dataToValidate.practiceContext.userCodeAsPractice, 'solutionCode');
            }
        } else {
             // If this is a direct practice material response, normalize its solutionCode
            normalizeCodeField(dataToValidate, 'solutionCode');
        }


        const checkResult = fieldCheck(dataToValidate); 
        if (checkResult === true) {
            return dataToValidate as T; 
        } else {
            // Log the object that failed validation for easier debugging
            console.error("AI response validation failed:", checkResult, "Validated object (original parsed):", parsedJson);
            throw new Error(`AI response validation failed: ${checkResult}. The AI might be unable to process the request as expected. Check console for the actual validated object.`);
        }
    } catch (e) {
        console.error("Failed to parse or validate JSON response from AI:", e);
        console.error("Raw response text (after any sanitization):", jsonStr);
        if (e instanceof Error && (e.message.startsWith("AI response validation failed:") || e.message.startsWith("AI returned"))) {
            throw e; // Re-throw specific validation errors
        }
        if (e instanceof SyntaxError) {
             throw new Error(`AI returned malformed JSON. ${e.message}. Raw (excerpt): ${jsonStr.substring(0,200)}...`);
        }
        throw new Error(`AI returned an invalid response format or failed validation. Please try again. Raw (excerpt): ${responseText.substring(0,200)}...`);
    }
};

const criticalJsonFormattingRules = `
CRITICAL JSON FORMATTING RULES:
- The entire response MUST be a single, valid JSON object.
- All keys and string values must be enclosed in double quotes (").
- All special characters inside string values MUST be correctly escaped for JSON.
  - Double quotes (") must be escaped as \\". For example, a code snippet like \`print("hello")\` MUST be represented in a JSON string as \`"print(\\"hello\\")"\`. This is CRITICAL for fields containing code.
  - Backslashes (\\) must be escaped as \\\\. For example, a Windows path \`"C:\\Users\\Test"\` MUST be represented as \`"C:\\\\Users\\\\Test"\`.
  - Newlines must be escaped as \\n.
- To prevent encoding errors, avoid using complex multi-byte emojis (e.g., 💰, 🍒, 7️⃣). Use simple text representations like "(jackpot)", "(cherry)", or "(seven)" instead.
- No trailing commas in objects or arrays.
- All keys within a single JSON object must be unique.
Adhere to these rules strictly to prevent JSON parsing errors.
`;

const handleApiError = (error: unknown, defaultMessage: string): Error => {
    console.error("Error calling Gemini API:", error);
    if (error instanceof Error) {
        if (error.message.includes("API key not valid") || error.message.includes("API_KEY_INVALID")) {
            return new Error("Invalid API Key: The provided API key is not valid. Please check your .env file and ensure the key is correct, then restart your application if it's running locally.");
        }
        if (error.message.toLowerCase().includes("quota")) {
            return new Error("API Quota Exceeded: The free tier for the Gemini API has usage limits which may have been reached. This can be a daily or monthly limit tied to your account or project. Please check your Google AI Studio dashboard for quota details and try again later.");
        }
        // Specific errors from parseJsonFromAiResponse or promiseWithTimeout should be re-thrown
        if (error.message.startsWith("AI response validation failed:") || error.message.startsWith("AI returned malformed JSON.") || error.message.startsWith("AI request timed out")) {
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

export const generateReadmeWithGemini = async (files: ProjectFile[], overview: string, projectName: string): Promise<string> => {
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
                model: "gemini-2.5-flash",
                contents: prompt,
                config: { temperature: 0.5 }
            }),
            API_TIMEOUT_MS
        );
        return response.text;
    } catch (error) {
        throw handleApiError(error, "Failed to generate README from AI.");
    }
};

export const analyzeDependenciesWithGemini = async (packageJsonContent: string): Promise<DependencyAnalysis[]> => {
    if (!ai) throw new Error("Gemini AI client is not initialized.");
    
    let dependencies: any = {};
    try {
        const parsed = JSON.parse(packageJsonContent);
        dependencies = { ...parsed.dependencies, ...parsed.devDependencies };
        if (Object.keys(dependencies).length === 0) {
            return []; // No dependencies to analyze
        }
    } catch(e) {
        throw new Error("Invalid package.json format.");
    }

    const prompt = `
You are a software dependency analyst.
The user has provided the dependencies from a package.json file. For each dependency, provide a concise, one-sentence explanation of its purpose in a typical web project.

Respond ONLY with a valid JSON array of objects. Each object must have two keys: "name" (the package name) and "description" (the one-sentence explanation).

Example format:
[
  { "name": "react", "description": "A JavaScript library for building user interfaces." },
  { "name": "tailwindcss", "description": "A utility-first CSS framework for rapid UI development." }
]

Dependencies to analyze:
${JSON.stringify(dependencies, null, 2)}

${criticalJsonFormattingRules}
`;
    try {
        const response = await promiseWithTimeout<GenerateContentResponse>(
            ai.models.generateContent({
                model: "gemini-2.5-flash",
                contents: prompt,
                config: { responseMimeType: "application/json", temperature: 0.1 }
            }),
            API_TIMEOUT_MS
        );
        return parseJsonFromAiResponse<DependencyAnalysis[]>(response.text, dependencyAnalysisFieldCheck);
    } catch (error) {
        throw handleApiError(error, "Failed to analyze dependencies from AI.");
    }
};

export const getProjectDependenciesWithGemini = async (files: ProjectFile[]): Promise<DependencyInfo[]> => {
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
- "importedBy": An array of strings, listing the file paths (within the aproject) that import or require this module.

Focus only on internal project dependencies (local file imports), not external libraries (e.g., 'react', 'express'). If a module has no internal imports or is not imported by any other file, use an empty array [].

File Contents:
${fileContents}

${criticalJsonFormattingRules}

Respond ONLY with the valid JSON array as described above.
`;
    try {
        const response = await promiseWithTimeout<GenerateContentResponse>(
            ai.models.generateContent({
                model: "gemini-2.5-flash",
                contents: prompt,
                config: { responseMimeType: "application/json", temperature: 0.2 }
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
    filePaths: string[]
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
Use your knowledge of the project's structure to infer where code related to their question might be.
You can reference specific file paths in your answer.
Your answer should be plain text, suitable for direct display. Do not use JSON.
`;

    try {
        const response = await promiseWithTimeout<GenerateContentResponse>(
            ai.models.generateContent({
                model: "gemini-2.5-flash",
                contents: prompt,
                config: { temperature: 0.6 }
            }),
            API_TIMEOUT_MS
        );
        return response.text;
    } catch (error) {
        throw handleApiError(error, "Failed to get an answer for your project-wide question.");
    }
};


export const analyzeProjectWithGemini = async (
    files: ProjectFile[],
    projectName: string
): Promise<ProjectAnalysis> => {
    if (!ai) throw new Error("Gemini AI client is not initialized. Ensure API_KEY is set.");

    const MAX_PATHS_LENGTH = 100000; // A safe limit for the file paths part of the prompt
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

- "overview": A single paragraph explaining the project's likely purpose, architecture, and technology stack based on the file paths.
- "fileBreakdown": An array of objects, where each object represents a file from the list. Each object MUST have the following keys:
  - "path": The full path of the file, copied exactly from the input list.
  - "description": A concise, one-sentence description of the file's likely purpose within the project.

${criticalJsonFormattingRules}

Respond ONLY with the valid JSON object described above.
`;

    try {
        const response = await promiseWithTimeout<GenerateContentResponse>(
            ai.models.generateContent({
                model: "gemini-2.5-flash",
                contents: prompt,
                config: { responseMimeType: "application/json", temperature: 0.3 }
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
    if (typeof parsed.topicExplanation.coreConcepts !== 'string') return "Field 'topicExplanation.coreConcepts' is not a string";
    
    if (!Array.isArray(parsed.topicExplanation.blockByBlockBreakdown)) return "Field 'topicExplanation.blockByBlockBreakdown' is not an array";
    if (parsed.topicExplanation.blockByBlockBreakdown.length > 0) {
        const isValid = parsed.topicExplanation.blockByBlockBreakdown.every((item: any) => 
            typeof item === 'object' && item !== null && typeof item.codeBlock === 'string' && typeof item.explanation === 'string'
        );
        if (!isValid) return "Elements in 'blockByBlockBreakdown' array do not have the required '{codeBlock: string, explanation: string}' structure.";
    }

    if (!Array.isArray(parsed.topicExplanation.lineByLineBreakdown)) return "Field 'topicExplanation.lineByLineBreakdown' is not an array";
    if (parsed.topicExplanation.lineByLineBreakdown.length > 0) {
        const isValid = parsed.topicExplanation.lineByLineBreakdown.every((item: any) => 
            typeof item === 'object' && item !== null && typeof item.code === 'string' && typeof item.explanation === 'string'
        );
        if (!isValid) return "Elements in 'lineByLineBreakdown' array do not have the required '{code: string, explanation: string}' structure.";
    }

    if (typeof parsed.topicExplanation.executionFlowAndDataTransformation !== 'string') return "Field 'topicExplanation.executionFlowAndDataTransformation' is not a string";
    
    // New validation for visualExecutionFlow
    if (!Array.isArray(parsed.topicExplanation.visualExecutionFlow)) return "Field 'topicExplanation.visualExecutionFlow' is not an array";
    if (parsed.topicExplanation.visualExecutionFlow.length > 0) {
        const isStepValid = (step: any): boolean => 
            typeof step === 'object' && step !== null &&
            (typeof step.lineNumber === 'number' || step.lineNumber === null) &&
            typeof step.explanation === 'string' &&
            typeof step.variablesState === 'object' && step.variablesState !== null;
        if (!parsed.topicExplanation.visualExecutionFlow.every(isStepValid)) {
            return "Elements in 'visualExecutionFlow' array do not have the required '{lineNumber: number|null, explanation: string, variablesState: object}' structure.";
        }
    }

    if (typeof parsed.exampleCode !== 'string') return "Field 'exampleCode' is not a string";
    if (typeof parsed.exampleCodeOutput !== 'string') return "Field 'exampleCodeOutput' is not a string";
    
    if (typeof parsed.practiceContext !== 'object' || parsed.practiceContext === null) return "Missing 'practiceContext' object";

    if (typeof parsed.practiceContext.generatedQuestion !== 'object' || parsed.practiceContext.generatedQuestion === null) return "Missing 'practiceContext.generatedQuestion' object";
    const generatedCheck = practiceMaterialFieldCheck(parsed.practiceContext.generatedQuestion);
    if (generatedCheck !== true) return `Validation failed inside 'practiceContext.generatedQuestion': ${generatedCheck}`;

    if (typeof parsed.practiceContext.userCodeAsPractice !== 'object' || parsed.practiceContext.userCodeAsPractice === null) return "Missing 'practiceContext.userCodeAsPractice' object";
    const userCodeCheck = practiceMaterialFieldCheck(parsed.practiceContext.userCodeAsPractice);
    if (userCodeCheck !== true) return `Validation failed inside 'practiceContext.userCodeAsPractice': ${userCodeCheck}`;
    
    return true;
};

const practiceMaterialFieldCheck = (parsed: any): true | string => {
    if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) return "Parsed JSON is not an object.";
    if (typeof parsed.title !== 'string') return "Field 'title' is not a string";
    if (typeof parsed.questionText !== 'string') return "Field 'questionText' is not a string";
    
    if (!Array.isArray(parsed.normalInstructionsLevel1)) return "Field 'normalInstructionsLevel1' is not an array";
    if (parsed.normalInstructionsLevel1.some((s: any) => typeof s !== 'string')) return "Not all elements in 'normalInstructionsLevel1' are strings";

    if (!Array.isArray(parsed.lineByLineInstructions)) return "Field 'lineByLineInstructions' is not an array";
    if (parsed.lineByLineInstructions.some((s: any) => typeof s !== 'string')) return "Not all elements in 'lineByLineInstructions' are strings";
    
    if (typeof parsed.solutionCode !== 'string') return "Field 'solutionCode' is not a string";
    if (typeof parsed.solutionOutput !== 'string') return "Field 'solutionOutput' is not a string";
    
    return true;
};

const userSolutionAnalysisFieldCheck = (parsed: any): true | string => {
    if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) return "Parsed JSON is not an object.";
    if (typeof parsed.predictedOutput !== 'string') return "Field 'predictedOutput' is not a string";
    if (typeof parsed.feedback !== 'string') return "Field 'feedback' is not a string";
    
    // isCorrect is optional, but if present, must be boolean
    if (parsed.hasOwnProperty('isCorrect') && typeof parsed.isCorrect !== 'boolean') {
        return "Optional field 'isCorrect' is present but not a boolean";
    }

    // New check for assessmentStatus
    const validStatuses: AssessmentStatus[] = ['correct', 'partially_correct', 'incorrect', 'syntax_error', 'unrelated'];
    if (parsed.hasOwnProperty('assessmentStatus') && !validStatuses.includes(parsed.assessmentStatus)) {
        return `Optional field 'assessmentStatus' has an invalid value: ${parsed.assessmentStatus}`;
    }
    return true;
};

const moreInstructionsResponseFieldCheck = (parsed: any): true | string => {
    if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) return "Parsed JSON is not an object.";
    if (!Array.isArray(parsed.newInstructionSteps)) return "Field 'newInstructionSteps' is not an array";
    if (parsed.newInstructionSteps.some((step: any) => typeof step !== 'string')) return "Not all elements in 'newInstructionSteps' are strings";
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
    const validErrorTypes = ['Syntax', 'Logic', 'Best Practice', 'Other'];
    const areErrorsValid = parsed.errorAnalysis.every((item: any) => 
        typeof item === 'object' && item !== null &&
        (typeof item.errorLine === 'number' || item.errorLine === null || item.errorLine === undefined) &&
        typeof item.erroneousCode === 'string' &&
        typeof item.explanation === 'string' &&
        typeof item.suggestedFix === 'string' &&
        validErrorTypes.includes(item.errorType)
    );
    if (!areErrorsValid) return "One or more elements in 'errorAnalysis' array have an invalid structure or 'errorType'.";

    return true;
};

const getDifficultyGuidance = (languageName: string, difficulty: ExampleDifficulty): string => {
    switch (difficulty) {
        case 'easy':
            return `Provide only raw, runnable ${languageName} code. Focus on basic syntax and a single, fundamental aspect of the concept, minimal logic, very short and concise.`;
        case 'intermediate':
            return `Provide only raw, runnable ${languageName} code. Incorporate common patterns, perhaps simple conditional logic or loops, demonstrates practical application of the concept, moderate length.`;
        case 'hard':
            return `Provide only raw, runnable ${languageName} code. Involve more advanced features, combine the concept with other related ideas, introduce a slightly more complex problem-solving scenario, or utilize data structures beyond simple lists/arrays. Can be longer and more detailed.`;
        default:
            return `Provide only raw, runnable ${languageName} code. Incorporate common patterns, perhaps simple conditional logic or loops, demonstrates practical application of the concept, moderate length.`; // Default to intermediate if somehow an unknown difficulty is passed
    }
};

const getPracticeQuestionDifficultyGuidance = (languageName: string, difficulty: ExampleDifficulty): string => {
    switch (difficulty) {
        case 'easy':
            return `The practice question should be 'easy'. It should test a single, fundamental aspect of the concept, require minimal logic, and be solvable in just a few lines of ${languageName} code.`;
        case 'intermediate':
            return `The practice question should be 'intermediate'. It should require combining the core concept with basic logic (like a simple loop or conditional statement) and be a practical, common-use case problem.`;
        case 'hard':
            return `The practice question should be 'hard'. It should require more complex logic, handling edge cases, or combining multiple concepts. The solution might involve a small algorithm or a more complex data structure.`;
        default:
            return `The practice question should be 'intermediate'.`;
    }
};

const getPracticeMaterialDefinition = (isForUserCode: boolean = false, languageName: string, difficultyGuidance: string) => {
    const titleInstruction = `
- "title": A descriptive, context-rich title summarizing the problem's real-world goal. **Title Rules**: AVOID literal commands (e.g., "Check if Number is Positive"). INSTEAD, use an engaging, purpose-driven title (e.g., "Validate User Input Number"). For finding a price range, AVOID "Find Price Range Difference"; INSTEAD, use "Calculate Market Price Spread" or "Analyze Stock Price Volatility".
`.trim();

    const baseDefinition = `
- "questionText": [QUESTION_TEXT_INSTRUCTION]
- "normalInstructionsLevel1": An array of strings with 3-5 high-level, conceptual steps (Level 1) for solving the task. DO NOT give away the full solution or specific implementation details in these initial steps.
- "lineByLineInstructions": An array of strings. Each string is a granular step guiding the user to build the solution line-by-line WITHOUT showing the code. For example: "1. Declare a function 'main' that returns an integer.", "2. Inside main, use 'std::cout' to print 'Hello World'.".
- "solutionCode": [SOLUTION_CODE_INSTRUCTION]
- "solutionOutput": [SOLUTION_OUTPUT_INSTRUCTION]
`;

    if (isForUserCode) {
        return `
- "title": "Reconstruct Your Code"
${baseDefinition
    .replace("[QUESTION_TEXT_INSTRUCTION]", "A directive for the user, such as: \"Now, try to reconstruct the code you originally provided, using the instructions below as a guide.\"")
    .replace("[SOLUTION_CODE_INSTRUCTION]", `The user's original code, copied EXACTLY.`)
    .replace("[SOLUTION_OUTPUT_INSTRUCTION]", `The predicted output of the user's original code.`)}
`;
    } else {
         return `
${titleInstruction}
${baseDefinition
    .replace("[QUESTION_TEXT_INSTRUCTION]", `${difficultyGuidance} This should be a new, related practice question for the user to solve.`)
    .replace("[SOLUTION_CODE_INSTRUCTION]", `The complete, runnable code solution for this new, generated "questionText".`)
    .replace("[SOLUTION_OUTPUT_INSTRUCTION]", `The exact output of the generated "solutionCode".`)}
`;
    }
};

export const analyzeCodeWithGemini = async (
    codeContent: string,
    language: SupportedLanguage,
    initialDifficulty: ExampleDifficulty,
    practiceDifficulty: ExampleDifficulty
): Promise<AnalysisResult> => {
    if (!ai) throw new Error("Gemini AI client is not initialized. Ensure API_KEY is set.");

    const isDetectingLanguage = language === SupportedLanguage.UNKNOWN;
    let prompt: string;
    let fieldCheck: (parsed: any) => true | string;

    const languageNameForPrompt = isDetectingLanguage ? 'the detected language' : LanguageDisplayNames[language];
    const practiceDifficultyGuidance = getPracticeQuestionDifficultyGuidance(languageNameForPrompt, practiceDifficulty);

    const topicExplanationInstructions = `
- "topicExplanation": A JSON object analyzing the user's code, structured with the exact keys: "coreConcepts", "blockByBlockBreakdown", "lineByLineBreakdown", "executionFlowAndDataTransformation", and "visualExecutionFlow".
  - "coreConcepts": A comprehensive explanation of the main concepts in the user's code.
  - "blockByBlockBreakdown": An array of objects. Each object MUST have a "codeBlock" key (a string containing a logical part of the user's code) and an "explanation" key (a string explaining that block).
  - "lineByLineBreakdown": An array of objects. Each object MUST have a "code" key (a single line or small group of related lines from the user's code) and an "explanation" key. Do NOT explain comments or blank lines.
  - "executionFlowAndDataTransformation": A text-based step-by-step explanation of how the code executes from start to finish.
  - "visualExecutionFlow": An array of objects for a visual player. Each object MUST have keys: "lineNumber" (the 1-indexed line number being executed, or null for setup/end), "explanation" (A clear, user-friendly explanation of what is happening at this line of code. It MUST NOT be pseudo-code, but a descriptive sentence in plain language explaining the action and its purpose. For example: "The loop starts, initializing the counter 'i' to 0."), and "variablesState" (a JSON object showing the values of key variables at this step). This should trace the program from start to finish. If no variables exist or the state is unchanged, use an empty object {}.
`;

    const practiceContextInstructions = `
Details for the "practiceContext" top-level key. It MUST be an object with TWO keys: "generatedQuestion" and "userCodeAsPractice".

1. "generatedQuestion" object definition:
${getPracticeMaterialDefinition(false, languageNameForPrompt, practiceDifficultyGuidance)}

2. "userCodeAsPractice" object definition:
${getPracticeMaterialDefinition(true, languageNameForPrompt, '')}
`;

    if (isDetectingLanguage) {
        const validLanguages = Object.values(LanguageDisplayNames)
            .filter(name => name !== LanguageDisplayNames.unknown)
            .map(name => `"${name}"`)
            .join(', ');

        prompt = `
You are an expert programming tutor.
First, identify the programming language of the following code snippet.
Then, analyze the code according to the identified language.

Provide your analysis in a JSON format. The top-level JSON object must contain the following exact keys: "detectedLanguage", "topicExplanation", "exampleCode", "exampleCodeOutput", "practiceContext".

- "detectedLanguage": A string representing the identified programming language. The value MUST be one of the following: ${validLanguages}.
${topicExplanationInstructions}
- "exampleCode": A STRING containing a '${initialDifficulty}' difficulty code example in the DETECTED language, illustrating the core concepts. This must be pure, runnable code.
- "exampleCodeOutput": A STRING representing the exact output of "exampleCode".
- "practiceContext": An object structured as described below.

${practiceContextInstructions}
${criticalJsonFormattingRules}

User's Code Snippet to analyze:
\`\`\`
${codeContent}
\`\`\`

Respond ONLY with the valid JSON object described above.
`;
        fieldCheck = (parsed: any): true | string => {
            if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) return "Parsed JSON is not an object.";
            if (typeof parsed.detectedLanguage !== 'string') return "Field 'detectedLanguage' is not a string";
            const langEnum = displayNameToLangEnum[parsed.detectedLanguage.toLowerCase()];
            if (!langEnum) return `Detected language '${parsed.detectedLanguage}' is not supported or recognized.`;
            return analysisResultFieldCheck(parsed);
        };
    } else {
        const languageName = LanguageDisplayNames[language];
        const difficultyGuidance = getDifficultyGuidance(languageName, initialDifficulty);

        prompt = `
You are an expert programming tutor. Analyze the following ${languageName} code.
The user's primary goal is to understand the main programming concepts demonstrated in THEIR SUBMITTED CODE.

Provide your analysis in a JSON format. The top-level JSON object must contain the following exact keys: "topicExplanation", "exampleCode", "exampleCodeOutput", "practiceContext".

${topicExplanationInstructions}
- "exampleCode": A STRING containing a '${initialDifficulty}' difficulty ${languageName} code example illustrating the core concepts. ${difficultyGuidance} This must be pure, runnable code.
- "exampleCodeOutput": A STRING representing the exact, expected output of "exampleCode".
- "practiceContext": An object structured as described below.

${practiceContextInstructions}
${criticalJsonFormattingRules}

User's ${languageName} Code:
\`\`\`${language}
${codeContent}
\`\`\`

Respond ONLY with the valid JSON object described above.
`;
        fieldCheck = analysisResultFieldCheck;
    }

    try {
        const response = await promiseWithTimeout<GenerateContentResponse>(
            ai.models.generateContent({
                model: "gemini-2.5-flash",
                contents: prompt,
                config: { responseMimeType: "application/json", temperature: 0.4 }
            }),
            API_TIMEOUT_MS
        );
        const parsedResult = parseJsonFromAiResponse<AnalysisResult>(response.text, fieldCheck);
        
        if (isDetectingLanguage && (parsedResult as any).detectedLanguage) {
             const langStr = ((parsedResult as any).detectedLanguage as string).toLowerCase();
             const detectedEnum = displayNameToLangEnum[langStr] || SupportedLanguage.UNKNOWN;
             if (detectedEnum === SupportedLanguage.UNKNOWN) {
                 console.warn(`AI returned an unmappable language: '${langStr}'. Falling back to UNKNOWN.`);
             }
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
    practiceDifficulty: ExampleDifficulty
): Promise<AnalysisResult> => {
    if (!ai) throw new Error("Gemini AI client is not initialized. Ensure API_KEY is set.");
    if (language === SupportedLanguage.UNKNOWN) throw new Error("Cannot analyze a concept for an unknown language context.");

    const languageName = LanguageDisplayNames[language];
    const exampleDifficultyGuidance = getDifficultyGuidance(languageName, initialDifficulty);
    const practiceDifficultyGuidance = getPracticeQuestionDifficultyGuidance(languageName, practiceDifficulty);

    const topicExplanationForConceptInstructions = `
- "topicExplanation": A JSON object explaining the concept in ${languageName}, with the following exact keys: "coreConcepts", "blockByBlockBreakdown", "lineByLineBreakdown", "executionFlowAndDataTransformation", and "visualExecutionFlow".
  - "coreConcepts": A comprehensive explanation of the core aspects of "${concept}".
  - "blockByBlockBreakdown": An array of objects demonstrating the concept's generic structure. Each object MUST have a "codeBlock" key (a generic code block showing the concept) and an "explanation" key.
  - "lineByLineBreakdown": An array of objects providing a generic line-by-line example. Each object MUST have a "code" key and an "explanation" key.
  - "executionFlowAndDataTransformation": A text-based explanation of how the concept typically controls program flow.
  - "visualExecutionFlow": An array of objects tracing the execution of the main "exampleCode" you provide below. Each object MUST have keys: "lineNumber" (1-indexed line number from "exampleCode"), "explanation" (A clear, user-friendly explanation of what is happening at this line of code. It MUST NOT be pseudo-code, but a descriptive sentence in plain language explaining the action and its purpose. For example: "The loop starts, initializing the counter 'i' to 0."), and "variablesState" (a JSON object showing key variable values).
`;

    const practiceContextInstructions = `
Details for the "practiceContext" top-level key. It MUST be an object with TWO keys: "generatedQuestion" and "userCodeAsPractice".

1. "generatedQuestion" object definition:
${getPracticeMaterialDefinition(false, languageName, practiceDifficultyGuidance)}

2. "userCodeAsPractice" object definition:
This object should provide a challenge for the user to reconstruct the main example code you provide.
- "title": "Reconstruct the Example"
- "questionText": "Your goal is to reconstruct the 'exampleCode' provided above. Use the instructions below as a guide."
- "normalInstructionsLevel1": An array of strings with 3-5 high-level steps for reconstructing the 'exampleCode'.
- "lineByLineInstructions": An array of strings with granular steps for building the 'exampleCode'.
- "solutionCode": The code from the "exampleCode" key, copied EXACTLY here.
- "solutionOutput": The output from the "exampleCodeOutput" key, copied EXACTLY here.
`;

    const prompt = `
You are an expert programming tutor. A user wants to understand a specific programming concept.
The programming language context is ${languageName}.
The concept the user wants to understand is: "${concept}"

Provide your analysis in a JSON format. The top-level JSON object must contain the following exact keys: "topicExplanation", "exampleCode", "exampleCodeOutput", "practiceContext".

${topicExplanationForConceptInstructions}
- "exampleCode": A STRING containing a '${initialDifficulty}' difficulty ${languageName} code example illustrating "${concept}". ${exampleDifficultyGuidance} This must be pure, runnable code.
- "exampleCodeOutput": A STRING representing the exact output of "exampleCode".
- "practiceContext": An object structured as described below.

${practiceContextInstructions}
${criticalJsonFormattingRules}

Respond ONLY with the valid JSON object described above.
`;

    try {
        const response = await promiseWithTimeout<GenerateContentResponse>(
            ai.models.generateContent({
                model: "gemini-2.5-flash",
                contents: prompt,
                config: { responseMimeType: "application/json", temperature: 0.45 }
            }),
            API_TIMEOUT_MS
        );
        return parseJsonFromAiResponse<AnalysisResult>(response.text, analysisResultFieldCheck);
    } catch (error) {
        throw handleApiError(error, "Failed to get concept analysis from AI. Check network/API key, then try again.");
    }
};


export const getMoreInstructionsFromGemini = async (
    practiceQuestion: string,
    currentInstructionsSoFar: string[], // All instruction steps shown to user so far
    language: SupportedLanguage,
    currentLevelNumber: number // e.g., 1 for initial, 2 after first "More" click, so requesting level currentLevelNumber + 1
): Promise<{ newInstructionSteps: string[], hasMoreLevels: boolean }> => {
    if (!ai) throw new Error("Gemini AI client is not initialized. Ensure API_KEY is set.");

    const languageName = LanguageDisplayNames[language];
    const instructionsContext = currentInstructionsSoFar.length > 0 
        ? `The user has already seen these instruction steps (for levels 1 to ${currentLevelNumber}):\n${currentInstructionsSoFar.join('\n')}`
        : "The user has not seen any instructions yet beyond the initial set you provided.";

    // Requesting Level 3 (index 2) is the last guaranteed level. AI can decide if more are needed.
    const isRequestingFinalMandatoryLevel = currentLevelNumber === 2; 

    const hasMoreLevelsInstruction = isRequestingFinalMandatoryLevel 
        ? "The system requires at least 3 levels of instructions. After this level, you may determine if more levels are needed. Set 'hasMoreLevels' to 'false' ONLY if this level provides the most granular detail possible and no further breakdown is useful."
        : "Set 'hasMoreLevels' to 'true' if you believe you can provide at least one more level of even more detailed instructions after this one. Set it to 'false' if this level is sufficiently detailed or no further meaningful breakdown is possible.";

    const prompt = `
You are an expert programming tutor providing progressive hints. Your task is to provide the *next level* of detail for solving a practice problem.

Context:
- Programming Language: ${languageName}
- Practice Question: "${practiceQuestion}"
- Instructions provided so far (up to Level ${currentLevelNumber}):
${instructionsContext}

Your Task:
Generate **ONLY the instructions for Level ${currentLevelNumber + 1}**. This next level must be an **incrementally more detailed breakdown** of the previous level's steps. Offer more specific algorithmic guidance, function suggestions, or logic flow details.
- **DO NOT** provide a full solution.
- **DO NOT** provide an overwhelmingly long explanation. The increase in detail MUST be gradual.
- **DO NOT** repeat instructions from previous levels unless it's to provide a more granular breakdown of that specific step.

For a simple problem, 3-4 levels might be sufficient. For a complex problem, more levels are appropriate.

Respond ONLY with a valid JSON object with the following exact keys: "newInstructionSteps" and "hasMoreLevels".

- "newInstructionSteps": An array of strings, where each string is a clear, concise step for Level ${currentLevelNumber + 1}. If you determine that no further useful breakdown is possible (e.g., the previous level was already highly detailed), return an empty array or a single string explaining that the maximum detail has been reached.
- "hasMoreLevels": A boolean value. ${hasMoreLevelsInstruction}

${criticalJsonFormattingRules}

Respond ONLY with the valid JSON object described above.
`;

    try {
        const response = await promiseWithTimeout<GenerateContentResponse>(
            ai.models.generateContent({
                model: "gemini-2.5-flash",
                contents: prompt,
                config: { responseMimeType: "application/json", temperature: 0.35 } // Lower temp for more deterministic instructions
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
    topicCoreConcepts: string, // Context about the general topic
    instructionsProvidedToUser: string[] // All instruction steps shown so far
): Promise<UserSolutionAnalysis> => {
    if (!ai) throw new Error("Gemini AI client is not initialized. Ensure API_KEY is set.");
    if (language === SupportedLanguage.UNKNOWN) throw new Error("Cannot analyze solution for an unknown language.");

    const languageName = LanguageDisplayNames[language];

    let instructionsContext = "The user had access to the following instruction steps if they chose to reveal them:\n";
    if (instructionsProvidedToUser && instructionsProvidedToUser.length > 0) {
        instructionsContext += instructionsProvidedToUser.join("\n") + "\n\n";
    } else {
        instructionsContext += "No specific multi-level instructions were provided or revealed for this question beyond the question text itself and potentially an initial set.\n";
    }

    const prompt = `
You are an expert programming tutor. The user is attempting to solve a practice question.
The programming language is ${languageName}.
The core topic being practiced is related to: "${topicCoreConcepts}"
The practice question was: "${practiceQuestionText}"

${instructionsContext}

Here is the user's submitted code:
\`\`\`${language}
${userCode}
\`\`\`

Analyze the user's solution. Your primary task is to determine if the user's code CORRECTLY AND COMPLETELY SOLVES the practice question ("${practiceQuestionText}").

Provide your analysis in a JSON format with the following exact keys: "predictedOutput", "feedback", "isCorrect", and "assessmentStatus".

- "predictedOutput": A string representing the exact, predicted output if the user's code were executed. If the code would produce no visible output or result in an error, state that clearly (e.g., "[No direct output]" or "[Error: Division by zero]").
- "isCorrect": A boolean value. Set to true ONLY IF the assessmentStatus is 'correct'. Set to false otherwise.
- "assessmentStatus": A string value indicating the solution's status. It MUST be one of the following exact values:
  - "correct": The solution is completely correct and solves the problem efficiently and accurately.
  - "partially_correct": The solution is on the right track but has minor logical errors, misses edge cases, or could be significantly improved.
  - "incorrect": The solution is fundamentally wrong, does not solve the problem, or has major logical flaws.
  - "syntax_error": The code contains syntax errors and would not compile or run. The "predictedOutput" should reflect this (e.g., "[Syntax Error]").
  - "unrelated": The solution does not seem to be an attempt to solve the given practice question.
- "feedback": Constructive feedback on the user's solution.
  - Your feedback should clearly explain your reasoning for the chosen "assessmentStatus".
  - If "isCorrect" is true, briefly acknowledge its correctness. You may also point out any best practices or alternative approaches if relevant.
  - If it's anything other than "correct", your feedback should clearly explain WHAT is wrong, missing, or could be improved in relation to the "questionText". Be encouraging and suggest improvements.

${criticalJsonFormattingRules}

Respond ONLY with the valid JSON object described above.
`;
    try {
        const response = await promiseWithTimeout<GenerateContentResponse>(
            ai.models.generateContent({
                model: "gemini-2.5-flash", // Ensure correct model
                contents: prompt,
                config: { responseMimeType: "application/json", temperature: 0.3 } // Lower temp for more focused feedback
            }),
            API_TIMEOUT_MS
        );
        return parseJsonFromAiResponse<UserSolutionAnalysis>(response.text, userSolutionAnalysisFieldCheck);
    } catch (error) {
       throw handleApiError(error, "Failed to get feedback for your solution. Check network/API key, then try again.");
    }
};

export const getExampleByDifficulty = async (
    topicCoreConcepts: string, // Use core concepts of the main topic for context
    language: SupportedLanguage, 
    difficulty: ExampleDifficulty
): Promise<ExampleCodeData> => {
    if (!ai) throw new Error("Gemini AI client is not initialized. Ensure API_KEY is set.");
    if (language === SupportedLanguage.UNKNOWN) throw new Error("Cannot generate example for an unknown language.");

    const languageName = LanguageDisplayNames[language];
    const difficultyGuidanceText = getDifficultyGuidance(languageName, difficulty);
    const prompt = `
You are an expert programming tutor.
Core Concept: "${topicCoreConcepts}". Language: ${languageName}. Requested difficulty: "${difficulty}".
Guidance for "${difficulty}": ${difficultyGuidanceText}
Provide ONLY a JSON object with keys: "exampleCode", "exampleCodeOutput".
- "exampleCode": Self-contained ${languageName} code for "${topicCoreConcepts}" at "${difficulty}" level. This value MUST be a raw JSON string, NOT a JSON object. The string must contain only pure, raw, runnable code. Ensure all special characters in string literals within the code (like backslashes) are correctly escaped for ${languageName}.
- "exampleCodeOutput": Exact expected output. If none, use "[No direct output produced by this example]".

${criticalJsonFormattingRules}

Respond ONLY with the valid JSON object described above.
`;
    try {
        const response = await promiseWithTimeout<GenerateContentResponse>(
            ai.models.generateContent({
                model: "gemini-2.5-flash", // Ensure correct model
                contents: prompt,
                config: { responseMimeType: "application/json", temperature: 0.6 } // Slightly higher temp for more varied examples
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
    difficulty: ExampleDifficulty
): Promise<PracticeMaterial> => {
    if (!ai) throw new Error("Gemini AI client is not initialized. Ensure API_KEY is set.");
    if (language === SupportedLanguage.UNKNOWN) throw new Error("Cannot generate practice question for an unknown language.");

    const languageName = LanguageDisplayNames[language];
    const difficultyGuidance = getPracticeQuestionDifficultyGuidance(languageName, difficulty);
    
    const practiceSectionDefinition = `
The response must be a JSON object representing the practice material, with the following keys:
- "title": A descriptive, context-rich title summarizing the problem's real-world goal. **Title Rules**: AVOID literal commands (e.g., "Check if Number is Positive"). INSTEAD, use an engaging, purpose-driven title (e.g., "Validate User Input Number"). For finding a price range, AVOID "Find Price Range Difference"; INSTEAD, use "Calculate Market Price Spread" or "Analyze Stock Price Volatility".
- "questionText": A practice question related to the core concept.
- "normalInstructionsLevel1": An array of strings with 3-5 high-level, conceptual steps (Level 1).
- "lineByLineInstructions": An array of strings. Each string is a granular step guiding the user to build the solution line-by-line WITHOUT showing the code.
- "solutionCode": The complete, runnable code solution for the "questionText".
- "solutionOutput": The exact output of the "solutionCode".
`;

    const prompt = `
You are an expert programming tutor. Your task is to generate a new practice question based on a given topic and difficulty.

Context:
- Core Concept: "${topicCoreConcepts}"
- Language: ${languageName}
- Requested Difficulty: "${difficulty}"

Task Details:
- ${difficultyGuidance}
- Generate a complete practice package as a JSON object.

JSON Object Structure:
${practiceSectionDefinition}
${criticalJsonFormattingRules}

Respond ONLY with the valid JSON object described above.
`;

    try {
        const response = await promiseWithTimeout<GenerateContentResponse>(
            ai.models.generateContent({
                model: "gemini-2.5-flash",
                contents: prompt,
                config: { responseMimeType: "application/json", temperature: 0.5 }
            }),
            API_TIMEOUT_MS
        );
        return parseJsonFromAiResponse<PracticeMaterial>(response.text, practiceMaterialFieldCheck);
    } catch (error) {
        throw handleApiError(error, `Failed to generate ${difficulty} practice question from AI. Try again.`);
    }
};

// Updated function to handle multi-turn conversational chat
export const askFollowUpQuestionWithGemini = async (
    latestUserQuestion: string, 
    chatHistory: ChatMessage[],
    fullExplanationContext: string,
    language: SupportedLanguage,
    originalInputContext: string,
    inputType: 'code' | 'concept'
): Promise<string> => {
    if (!ai) throw new Error("Gemini AI client is not initialized. Ensure API_KEY is set.");
    
    const languageName = LanguageDisplayNames[language] || "the specified language";
    const contextType = inputType === 'code' ? "the user's code snippet" : "the user's concept";

    // Build the conversation history string for the prompt
    const conversationHistoryString = chatHistory
        .map(message => `${message.role === 'user' ? 'User' : 'AI'}: ${message.content}`)
        .join('\n');

    const prompt = `
You are an expert programming tutor continuing a session with a student.
The user is asking a follow-up question related to a topic you previously explained.

Here is the full context of the current session:
- Programming Language: ${languageName}
- Original Input Type: ${contextType}
- Original User Input:
  \`\`\`
  ${originalInputContext}
  \`\`\`
- Your Previous Full Explanation (covering core concepts, line-by-line breakdown, and execution flow): 
  """
  ${fullExplanationContext}
  """

Here is the conversation so far:
${conversationHistoryString}

Now, the user has sent a new message:
User: "${latestUserQuestion}"

Please provide a clear, concise, and helpful answer to the user's LATEST message, keeping all of the above context (the initial analysis AND the entire conversation history) in mind.
Answer ONLY the new message.
Your answer should be plain text, suitable for direct display. Do not use JSON.
Be concise but thorough. If the question is ambiguous, try to provide the most helpful interpretation.
Format your answer with appropriate line breaks for readability. Use markdown for simple formatting like **bold** or *italics* if it enhances clarity, but avoid complex markdown.
`;

    try {
        const response = await promiseWithTimeout<GenerateContentResponse>(
            ai.models.generateContent({
                model: "gemini-2.5-flash",
                contents: prompt,
                config: { temperature: 0.55 } // Moderate temperature for helpful, creative answers
            }),
            API_TIMEOUT_MS
        );
        return response.text; // Return plain text answer
    } catch (error) {
        throw handleApiError(error, "Failed to get an answer from AI for your follow-up question. Please try again.");
    }
};

export const executeCodeWithGemini = async (
    code: string,
    language: SupportedLanguage
): Promise<string> => {
    if (!ai) {
        throw new Error("Gemini AI client is not initialized. Check API_KEY configuration.");
    }
    if (language === SupportedLanguage.UNKNOWN) {
        throw new Error("Cannot execute code for an unknown language.");
    }

    const languageName = LanguageDisplayNames[language];

    const prompt = `
You are a sandboxed code execution environment.
Your task is to execute the provided ${languageName} code and return ONLY the standard output (stdout).

- If the code executes successfully and produces output, return ONLY that output.
- If the code executes successfully but produces NO output, return a clear message like "[No output produced]".
- If the code contains syntax errors or would cause a runtime error, return ONLY the error message that the language's compiler or interpreter would produce.
- Do not add any of your own explanations, commentary, or formatting like backticks. Your response should be the raw, direct result of the execution attempt.

Code to execute:
\`\`\`${language}
${code}
\`\`\`
`;

    try {
        const response = await promiseWithTimeout<GenerateContentResponse>(
            ai.models.generateContent({
                model: "gemini-2.5-flash",
                contents: prompt,
                config: {
                    temperature: 0.0, // We want deterministic output
                }
            }),
            API_TIMEOUT_MS
        );
        
        return response.text;

    } catch (error) {
        throw handleApiError(error, "Failed to get execution result from AI. Please try again.");
    }
};

export const debugCodeWithGemini = async (
    brokenCode: string,
    language: SupportedLanguage
): Promise<DebugResult> => {
    if (!ai) throw new Error("Gemini AI client is not initialized. Ensure API_KEY is set.");

    const isDetectingLanguage = language === SupportedLanguage.UNKNOWN;
    const languageName = isDetectingLanguage ? 'the detected programming language' : LanguageDisplayNames[language];

    const validLanguages = Object.values(LanguageDisplayNames)
        .filter(name => name !== LanguageDisplayNames.unknown)
        .map(name => `"${name}"`)
        .join(', ');

    const languageDetectionInstruction = isDetectingLanguage 
        ? `- "detectedLanguage": A string representing the identified language. It MUST be one of: ${validLanguages}.`
        : '';
    const topLevelKeys = isDetectingLanguage ? `"detectedLanguage", "summary", "errorAnalysis", "correctedCode"` : `"summary", "errorAnalysis", "correctedCode"`;


    const prompt = `
You are an expert code debugger. A user has submitted a piece of code with errors.
Your task is to identify all syntax and logical errors, explain them clearly, and provide the fully corrected code.
${isDetectingLanguage ? 'First, you MUST detect the programming language of the code.' : `The programming language is ${languageName}.`}

User's code to debug:
\`\`\`
${brokenCode}
\`\`\`

Provide your response ONLY as a valid JSON object with the following exact keys: ${topLevelKeys}.

${languageDetectionInstruction}
- "summary": A brief, one-paragraph summary of the main issues found in the code (e.g., "The code has a syntax error due to a missing semicolon and a logical error where the loop condition is incorrect, causing it to terminate prematurely.").
- "errorAnalysis": An array of JSON objects, where each object represents a single identified error. Each object MUST have the following keys:
  - "errorLine": An integer representing the 1-indexed line number where the error occurs. Can be null if the error is general.
  - "erroneousCode": A string containing the exact line(s) of code that are incorrect.
  - "errorType": A string that MUST be one of: "Syntax", "Logic", "Best Practice", "Other".
  - "explanation": A clear, beginner-friendly explanation of why this is an error.
  - "suggestedFix": A string containing the corrected version of the code line(s).
- "correctedCode": A string containing the complete, runnable version of the user's code with all errors fixed.

${criticalJsonFormattingRules}

Respond ONLY with the valid JSON object described above.
`;
    
    const fieldCheck = (parsed: any): true | string => {
        if (isDetectingLanguage) {
            if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) return "Parsed JSON is not an object.";
            if (typeof parsed.detectedLanguage !== 'string') return "Field 'detectedLanguage' is not a string";
            const langEnum = displayNameToLangEnum[parsed.detectedLanguage.toLowerCase()];
            if (!langEnum) return `Detected language '${parsed.detectedLanguage}' is not supported or recognized.`;
        }
        return debugResultFieldCheck(parsed);
    };

    try {
        const response = await promiseWithTimeout<GenerateContentResponse>(
            ai.models.generateContent({
                model: "gemini-2.5-flash",
                contents: prompt,
                config: { responseMimeType: "application/json", temperature: 0.2 } // Low temp for factual debugging
            }),
            API_TIMEOUT_MS
        );
        const parsedResult = parseJsonFromAiResponse<DebugResult>(response.text, fieldCheck);
        
        if (isDetectingLanguage && (parsedResult as any).detectedLanguage) {
             const langStr = ((parsedResult as any).detectedLanguage as string).toLowerCase();
             const detectedEnum = displayNameToLangEnum[langStr] || SupportedLanguage.UNKNOWN;
             if (detectedEnum === SupportedLanguage.UNKNOWN) {
                 console.warn(`AI returned an unmappable language for debugging: '${langStr}'.`);
             }
             parsedResult.detectedLanguage = detectedEnum;
        }
        return parsedResult;

    } catch (error) {
        throw handleApiError(error, "Failed to get debugging analysis from AI. Please try again.");
    }
};