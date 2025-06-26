
import { GoogleGenAI, GenerateContentResponse } from "@google/genai";
import { 
    AnalysisResult, 
    SupportedLanguage, 
    UserSolutionAnalysis, 
    LanguageDisplayNames,
    ExampleDifficulty,
    ExampleCodeData,
    PracticeMaterial 
} from '../types';

const API_KEY = process.env.API_KEY;
const API_TIMEOUT_MS = 45000; // 45 seconds

let ai: GoogleGenAI | null = null;
if (API_KEY) {
  ai = new GoogleGenAI({ apiKey: API_KEY });
} else {
  console.error("API_KEY environment variable not found. Gemini API calls will fail. Ensure it's set in your execution environment.");
}

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
        let dataToValidate = JSON.parse(jsonStr); 

        // If AI returns an array of objects, take the first one.
        // This is a common pattern observed with some model responses.
        if (Array.isArray(dataToValidate) && dataToValidate.length > 0) {
            dataToValidate = dataToValidate[0]; 
        } else if (Array.isArray(dataToValidate) && dataToValidate.length === 0) {
            console.error("AI response is an empty array.");
            throw new Error("AI returned an empty array response.");
        }
        
        const checkResult = fieldCheck(dataToValidate); 
        if (checkResult === true) {
            return dataToValidate as T; 
        } else {
            // Log the object that failed validation for easier debugging
            console.error("AI response validation failed:", checkResult, "Validated object (or first element if array):", dataToValidate);
            throw new Error(`AI response validation failed: ${checkResult}. The AI might be unable to process the request as expected. Check console for the actual validated object.`);
        }
    } catch (e) {
        console.error("Failed to parse or validate JSON response from AI:", e);
        console.error("Raw response text (after any sanitization):", jsonStr);
        if (e instanceof Error && e.message.startsWith("AI response validation failed:")) {
            throw e; // Re-throw specific validation errors
        }
        if (e instanceof SyntaxError) {
             throw new Error(`AI returned malformed JSON. ${e.message}. Raw (excerpt): ${jsonStr.substring(0,200)}...`);
        }
        throw new Error(`AI returned an invalid response format or failed validation. Please try again. Raw (excerpt): ${responseText.substring(0,200)}...`);
    }
};

const analysisResultFieldCheck = (parsed: any): true | string => {
    if (typeof parsed !== 'object' || parsed === null) return "Parsed JSON is not an object.";
    if (!parsed.topicExplanation) return "Missing 'topicExplanation' object";
    if (typeof parsed.topicExplanation.coreConcepts !== 'string') return "Field 'topicExplanation.coreConcepts' is not a string";
    if (typeof parsed.topicExplanation.lineByLineBreakdown !== 'string') return "Field 'topicExplanation.lineByLineBreakdown' is not a string";
    if (typeof parsed.topicExplanation.executionFlowAndDataTransformation !== 'string') return "Field 'topicExplanation.executionFlowAndDataTransformation' is not a string";
    
    if (typeof parsed.exampleCode !== 'string') return "Field 'exampleCode' is not a string";
    if (typeof parsed.exampleCodeOutput !== 'string') return "Field 'exampleCodeOutput' is not a string";
    
    if (typeof parsed.practiceSection !== 'object' || parsed.practiceSection === null) return "Missing 'practiceSection' object";
    if (typeof parsed.practiceSection.questionText !== 'string') return "Field 'practiceSection.questionText' is not a string";
    
    // Updated for new instruction structure
    if (typeof parsed.practiceSection.initialInstructions !== 'string') return "Field 'practiceSection.initialInstructions' is not a string"; 
    
    if (typeof parsed.practiceSection.solutionCode !== 'string') return "Field 'practiceSection.solutionCode' is not a string";
    if (typeof parsed.practiceSection.solutionOutput !== 'string') return "Field 'practiceSection.solutionOutput' is not a string";
    
    return true;
};

const userSolutionAnalysisFieldCheck = (parsed: any): true | string => {
    if (typeof parsed !== 'object' || parsed === null) return "Parsed JSON is not an object.";
    if (typeof parsed.predictedOutput !== 'string') return "Field 'predictedOutput' is not a string";
    if (typeof parsed.feedback !== 'string') return "Field 'feedback' is not a string";
    // isCorrect is optional, but if present, must be boolean
    if (parsed.hasOwnProperty('isCorrect') && typeof parsed.isCorrect !== 'boolean') {
        return "Optional field 'isCorrect' is present but not a boolean";
    }
    return true;
};

const moreInstructionsResponseFieldCheck = (parsed: any): true | string => {
    if (typeof parsed !== 'object' || parsed === null) return "Parsed JSON is not an object.";
    if (!Array.isArray(parsed.newInstructionSteps)) return "Field 'newInstructionSteps' is not an array";
    if (parsed.newInstructionSteps.some((step: any) => typeof step !== 'string')) return "Not all elements in 'newInstructionSteps' are strings";
    if (typeof parsed.hasMoreLevels !== 'boolean') return "Field 'hasMoreLevels' is not a boolean";
    return true;
};


const exampleCodeDataFieldCheck = (parsed: any): true | string => {
    if (typeof parsed !== 'object' || parsed === null) return "Parsed JSON is not an object.";
    if (typeof parsed.exampleCode !== 'string') return "Field 'exampleCode' is not a string";
    if (typeof parsed.exampleCodeOutput !== 'string') return "Field 'exampleCodeOutput' is not a string";
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

const handleApiError = (error: unknown, defaultMessage: string): Error => {
    console.error("Error calling Gemini API:", error);
    if (error instanceof Error) {
        if (error.message.includes("API key not valid") || error.message.includes("API_KEY_INVALID")) {
            return new Error("Invalid API Key. Check configuration.");
        }
        if (error.message.toLowerCase().includes("quota")) {
            return new Error("API quota exceeded. Try again later.");
        }
        // Specific errors from parseJsonFromAiResponse or promiseWithTimeout should be re-thrown
        if (error.message.startsWith("AI response validation failed:") || error.message.startsWith("AI returned malformed JSON.") || error.message.startsWith("AI request timed out")) {
            return error;
        }
    }
    return new Error(defaultMessage);
};

export const analyzeCodeWithGemini = async (
    codeContent: string,
    language: SupportedLanguage,
    initialDifficulty: ExampleDifficulty // Added this parameter
): Promise<AnalysisResult> => {
    if (!ai) throw new Error("Gemini AI client is not initialized. Ensure API_KEY is set.");
    if (language === SupportedLanguage.UNKNOWN) throw new Error("Cannot analyze code for an unknown language.");

    const languageName = LanguageDisplayNames[language];
    const difficultyGuidance = getDifficultyGuidance(languageName, initialDifficulty);

    const prompt = `
You are an expert programming tutor. Analyze the following ${languageName} code.
The user's primary goal is to understand the main programming concepts demonstrated in THEIR SUBMITTED CODE.

Provide your analysis in a JSON format. The top-level JSON object must contain the following exact keys: "topicExplanation", "exampleCode", "exampleCodeOutput", "practiceSection".

The value for the "topicExplanation" key MUST be a JSON object structured as follows, with string values for each key:
{
    "coreConcepts": "[Provide a comprehensive and detailed explanation of THE MAIN PROGRAMMING CONCEPT(S) DEMONSTRATED IN THE USER'S UPLOADED CODE. Begin with a concise, high-level overview. The primary focus must be on the user's code functionality, its structure, and its logic. This should be tailored to the user's code, easy for a learner to understand, cover key aspects, and can be multiple paragraphs if necessary. Ensure this is a single JSON string value.]",
    "lineByLineBreakdown": "[Provide a detailed, sequential explanation of each significant line or block of the user's code. Clarify what each part of the code does. If the code is very long, focus on the most illustrative or complex sections. Ensure this is a single JSON string value.]",
    "executionFlowAndDataTransformation": "[Explain how the user's code executes step-by-step. Detail the flow of control, how variables change, and how data is transformed throughout the program's lifecycle. Ensure this is a single JSON string value.]"
}

The "exampleCode" and "exampleCodeOutput" keys MUST be direct, top-level properties of the main JSON object:
- "exampleCode": THIS MUST BE A STRING containing the '${initialDifficulty}' difficulty ${languageName} code example that clearly illustrates THE CORE CONCEPT(S) explained in "coreConcepts" (derived from user's code). This example must be different from the user's input code and should be ready to compile/run. ${difficultyGuidance} CRITICALLY IMPORTANT: The 'exampleCode' field MUST contain only pure, raw, runnable ${languageName} code, without any HTML, markdown, or other formatting/styling tags. Ensure all special characters in string literals within the code (like backslashes) are correctly escaped for ${languageName}.
- "exampleCodeOutput": THIS MUST BE A STRING representing the exact, expected output if the "exampleCode" (the string value from the "exampleCode" key) were executed. If no visible output, use "[No direct output produced by this example]". Do NOT nest this inside the "exampleCode" field.

Details for the "practiceSection" top-level key:
- "practiceSection": An object containing the practice material with the following string keys:
    - "questionText": A programming question related to THE EXPLAINED CONCEPT(S) that a learner can solve in ${languageName}.
    - "initialInstructions": A string containing the FIRST LEVEL of step-by-step instructions on how to approach and solve the "questionText". This initial level should adapt its detail based on the complexity of the question (simpler questions get fewer, higher-level steps; more complex questions get slightly more initial steps, still at a high level). Provide these as a multi-line string, with each step clearly articulated (use \\n for newlines within this string).
    - "solutionCode": The complete, correct, and runnable ${languageName} code that solves the questionText. This code MUST BE PURE ${languageName} CODE with no surrounding text, markdown, or explanations. Ensure all special characters in string literals within the code (like backslashes) are correctly escaped for ${languageName}.
    - "solutionOutput": The exact, expected output if the solutionCode were executed. If no visible output, use "[No direct output produced by this solution]".

IMPORTANT: All string values within the JSON structure itself (like explanations, instructions, code outputs) MUST be valid JSON strings. This means special characters like backslashes (\\), quotes (\"), and newlines (\\n) must be properly escaped within the JSON string literals. For example, if an explanation needs to include a literal backslash, it should appear as \\\\ in the JSON string.
CRITICALLY IMPORTANT: Ensure all keys within any single JSON object are unique. Duplicate keys within the same object are NOT ALLOWED and will result in an invalid JSON structure.

User's ${languageName} Code:
\`\`\`${language}
${codeContent}
\`\`\`

Respond ONLY with the valid JSON object described above. Ensure the JSON is well-formed and all string values are properly escaped for JSON.
`;

    try {
        const response = await promiseWithTimeout<GenerateContentResponse>(
            ai.models.generateContent({
                model: "gemini-2.5-flash-preview-04-17", // Ensure correct model
                contents: prompt,
                config: { responseMimeType: "application/json", temperature: 0.4 } // Temperature for analysis
            }),
            API_TIMEOUT_MS
        );
        const parsedResult = parseJsonFromAiResponse<AnalysisResult>(response.text, analysisResultFieldCheck);
        // console.log("Parsed Analysis Result from Gemini (Code):", parsedResult); // For debugging
        return parsedResult;
    } catch (error) {
        throw handleApiError(error, "Failed to get analysis from AI. Check network/API key, then try again.");
    }
};

export const analyzeConceptWithGemini = async (
    concept: string,
    language: SupportedLanguage,
    initialDifficulty: ExampleDifficulty // Added this parameter
): Promise<AnalysisResult> => {
    if (!ai) throw new Error("Gemini AI client is not initialized. Ensure API_KEY is set.");
    if (language === SupportedLanguage.UNKNOWN) throw new Error("Cannot analyze a concept for an unknown language context.");

    const languageName = LanguageDisplayNames[language];
    const difficultyGuidance = getDifficultyGuidance(languageName, initialDifficulty);

    const prompt = `
You are an expert programming tutor. A user wants to understand a specific programming concept.
The programming language context is ${languageName}.
The concept the user wants to understand is: "${concept}"

Provide your analysis in a JSON format. The top-level JSON object must contain the following exact keys: "topicExplanation", "exampleCode", "exampleCodeOutput", "practiceSection".

The value for the "topicExplanation" key MUST be a JSON object structured as follows, with string values for each key:
{
    "coreConcepts": "[Provide a comprehensive and detailed explanation of the core aspects of \\"${concept}\\" specifically within the context of the ${languageName} language. Begin with a concise, high-level overview. The primary focus must be on the concept's functionality, its typical structure or implementation patterns, and its underlying logic. This explanation should be thorough, cover key aspects, potential nuances, and be easy for a learner to understand. Ensure this is a single JSON string value.]",
    "lineByLineBreakdown": "[If the concept involves a typical code structure or pattern (e.g., a for loop, a class definition for OOP concepts), provide a breakdown of such a generic structure, explaining each part's role in the context of \\"${concept}\\". If not applicable, state \\"N/A or provide a relevant structural overview.\\". Ensure this is a single JSON string value.]",
    "executionFlowAndDataTransformation": "[Explain how a program utilizing this concept (\\"${concept}\\") would typically execute or how the concept manifests in execution. Describe how data is typically transformed or managed when this concept is applied. Ensure this is a single JSON string value.]"
}

The "exampleCode" and "exampleCodeOutput" keys MUST be direct, top-level properties of the main JSON object:
- "exampleCode": THIS MUST BE A STRING containing the '${initialDifficulty}' difficulty ${languageName} code example that clearly illustrates the core idea of THE USER'S CONCEPT ("${concept}"). This example must be ready to compile/run. ${difficultyGuidance} CRITICALLY IMPORTANT: The 'exampleCode' field MUST contain only pure, raw, runnable ${languageName} code. Ensure all special characters in string literals within the code (like backslashes) are correctly escaped for ${languageName}.
- "exampleCodeOutput": THIS MUST BE A STRING representing the exact, expected output if the "exampleCode" (the string value from the "exampleCode" key) were executed. If no visible output, use "[No direct output produced by this example definition]". Do NOT nest this inside the "exampleCode" field.

Details for the "practiceSection" top-level key:
- "practiceSection": An object containing the practice material with the following string keys:
    - "questionText": A relevant programming question related to THE USER'S CONCEPT ("${concept}") that a learner can solve using ${languageName}.
    - "initialInstructions": A string containing the FIRST LEVEL of step-by-step instructions on how to approach and solve the "questionText". This initial level should adapt its detail based on the complexity of the question (simpler questions get fewer, higher-level steps; more complex questions get slightly more initial steps, still at a high level). Provide these as a multi-line string, with each step clearly articulated (use \\n for newlines within this string).
    - "solutionCode": The complete, correct, and runnable ${languageName} code that solves the questionText. This code MUST BE PURE ${languageName} CODE with no surrounding text, markdown, or explanations. Ensure all special characters in string literals within the code (like backslashes) are correctly escaped for ${languageName}.
    - "solutionOutput": The exact, expected output if the solutionCode were executed. If no visible output, use "[No direct output produced by this solution]".

IMPORTANT: All string values within the JSON structure itself (like explanations, instructions, code outputs) MUST be valid JSON strings. This means special characters like backslashes (\\), quotes (\"), and newlines (\\n) must be properly escaped within the JSON string literals. For example, if an explanation needs to include a literal backslash, it should appear as \\\\ in the JSON string.
CRITICALLY IMPORTANT: Ensure all keys within any single JSON object are unique. Duplicate keys within the same object are NOT ALLOWED and will result in an invalid JSON structure.

Respond ONLY with the valid JSON object. Ensure the JSON is well-formed and all string values are properly escaped for JSON.
`;

    try {
        const response = await promiseWithTimeout<GenerateContentResponse>(
            ai.models.generateContent({
                model: "gemini-2.5-flash-preview-04-17", // Ensure correct model
                contents: prompt,
                config: { responseMimeType: "application/json", temperature: 0.45 } // Temperature for concept explanation
            }),
            API_TIMEOUT_MS
        );
        const parsedResult = parseJsonFromAiResponse<AnalysisResult>(response.text, analysisResultFieldCheck);
        // console.log("Parsed Analysis Result from Gemini (Concept):", parsedResult); // For debugging
        return parsedResult;
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
        : "The user has not seen any instructions yet beyond the initial set you provided (if this is for Level 2+).";

    const prompt = `
You are an expert programming tutor. The user is asking for more detailed instructions to solve a practice question.
The programming language is ${languageName}.
The practice question is: "${practiceQuestion}"

${instructionsContext}

Your task is to provide the *next level* of instructions (Level ${currentLevelNumber + 1}). This new level should offer more detailed and granular guidance than what has been provided so far. Focus on breaking down previous high-level steps, suggesting specific algorithms, functions, or methods, or detailing logic flow.
Do NOT repeat information already clearly provided in prior instruction steps unless it's essential for rephrasing or clarity in the new, more detailed context.

Respond ONLY with a valid JSON object with the following exact keys: "newInstructionSteps" and "hasMoreLevels".
- "newInstructionSteps": An array of strings. Each string in this array should be a single, clear step for this NEW (Level ${currentLevelNumber + 1}) set of instructions.
- "hasMoreLevels": A boolean value. Set to \`true\` if you believe even more detailed levels of instruction could be beneficial after this one. Set to \`false\` if this level is sufficiently detailed or if no further meaningful breakdown is possible or helpful.

Example JSON response if more levels are possible:
{
  "newInstructionSteps": [
    "Specifically, to achieve step X from the previous level, first declare a variable Y.",
    "Then, implement a loop that iterates Z times.",
    "Inside the loop, call function A with parameters B and C."
  ],
  "hasMoreLevels": true
}

Example JSON response if this is the most detailed level:
{
  "newInstructionSteps": [
    "Consider edge case 1: what if the input array is empty?",
    "Ensure your error handling for scenario Z is robust."
  ],
  "hasMoreLevels": false
}

If no further instructions are beneficial for this new level (e.g., previous level was already very detailed), "newInstructionSteps" can be an empty array or a single string like "No further specific breakdown beneficial at this point.", and "hasMoreLevels" should be false.

Ensure the JSON is well-formed and all string values are properly escaped for JSON.
`;

    try {
        const response = await promiseWithTimeout<GenerateContentResponse>(
            ai.models.generateContent({
                model: "gemini-2.5-flash-preview-04-17",
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

Provide your analysis in a JSON format with the following exact keys: "predictedOutput", "feedback", and "isCorrect" (boolean).

- "predictedOutput": A string representing the exact, predicted output if the user's code were executed. If the code would produce no visible output or result in an error, state that clearly (e.g., "[No direct output]" or "[Error: Division by zero]").
- "isCorrect": A boolean value.
  - Set to true ONLY IF the user's code accurately and fully solves the problem as described by "${practiceQuestionText}". Consider if they followed the general approach outlined in the instructions (if available and revealed to them), but prioritize correctness of the solution to the "questionText".
  - Set to false if the user's code fails to solve the "questionText" correctly, contains errors, or is incomplete.
- "feedback": Constructive feedback on the user's solution.
  - If "isCorrect" is true, briefly acknowledge its correctness. You may also point out any best practices or alternative approaches if relevant.
  - If "isCorrect" is false, your feedback should clearly explain WHAT is incorrect or missing in relation to the "questionText". Be encouraging and suggest improvements. You may reference the provided instruction steps if the user missed key guidance.

IMPORTANT: All string values within the JSON structure itself (like feedback and predictedOutput) MUST be valid JSON strings. This means special characters like backslashes (\\), quotes (\"), and newlines (\\n) must be properly escaped within the JSON string literals.
CRITICALLY IMPORTANT: Ensure all keys within any single JSON object are unique. Duplicate keys within the same object are NOT ALLOWED and will result in an invalid JSON structure.

Respond ONLY with the valid JSON object described above, without any additional explanations or surrounding text. Ensure the JSON is well-formed and all string values are properly escaped for JSON.
`;
    try {
        const response = await promiseWithTimeout<GenerateContentResponse>(
            ai.models.generateContent({
                model: "gemini-2.5-flash-preview-04-17", // Ensure correct model
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
- "exampleCode": Self-contained ${languageName} code for "${topicCoreConcepts}" at "${difficulty}" level. MUST be only pure, raw, runnable code. Ensure all special characters in string literals within the code (like backslashes) are correctly escaped for ${languageName}.
- "exampleCodeOutput": Exact expected output. If none, use "[No direct output produced by this example]".

IMPORTANT: All string values within the JSON structure itself (like exampleCodeOutput) MUST be valid JSON strings. This means special characters like backslashes (\\), quotes (\"), and newlines (\\n) must be properly escaped within the JSON string literals.
CRITICALLY IMPORTANT: Ensure all keys within any single JSON object are unique. Duplicate keys within the same object are NOT ALLOWED and will result in an invalid JSON structure.

Respond ONLY with the valid JSON object. Ensure all string values are properly escaped for JSON.
`;
    try {
        const response = await promiseWithTimeout<GenerateContentResponse>(
            ai.models.generateContent({
                model: "gemini-2.5-flash-preview-04-17", // Ensure correct model
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

// New function to handle follow-up questions from the user
export const askFollowUpQuestionWithGemini = async (
    userQuestion: string, 
    fullExplanationContext: string, // Concatenated coreConcepts, lineByLine, executionFlow
    language: SupportedLanguage,
    originalInputContext: string, // The original code or concept string user provided
    inputType: 'code' | 'concept' // To tailor the context slightly
): Promise<string> => {
    if (!ai) throw new Error("Gemini AI client is not initialized. Ensure API_KEY is set.");
    
    const languageName = LanguageDisplayNames[language] || "the specified language";
    const contextType = inputType === 'code' ? "the user's code snippet" : "the user's concept";

    const prompt = `
You are an expert programming tutor acting as a helpful AI assistant.
The user is asking a follow-up question related to a topic you previously explained.

Context:
- Programming Language: ${languageName}
- Original Input Type: ${contextType}
- Original User Input: 
  \`\`\`
  ${originalInputContext}
  \`\`\`
- Your Previous Explanation (covering core concepts, line-by-line breakdown, and execution flow): 
  """
  ${fullExplanationContext}
  """

User's Follow-up Question: "${userQuestion}"

Please answer the user's follow-up question directly, clearly, and comprehensively. 
Focus specifically on their question while keeping the provided context (original input, your prior explanation) in mind.
Your answer should be plain text, suitable for direct display. Do not use JSON.
Be concise but thorough. If the question is ambiguous, try to provide the most helpful interpretation.
Format your answer with appropriate line breaks for readability. Use markdown for simple formatting like **bold** or *italics* if it enhances clarity, but avoid complex markdown like tables or code blocks unless absolutely necessary for the answer.
Ensure that any special characters like backslashes are appropriately represented for plain text display (e.g., a literal backslash should just be a backslash).
`;

    try {
        const response = await promiseWithTimeout<GenerateContentResponse>(
            ai.models.generateContent({
                model: "gemini-2.5-flash-preview-04-17",
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