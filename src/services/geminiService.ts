
import { GoogleGenAI } from "@google/genai";
import { 
    AnalysisResult, 
    SupportedLanguage, 
    UserSolutionAnalysis, 
    LanguageDisplayNames,
    ExampleDifficulty,
    ExampleCodeData,
    // TopicExplanationParts, // Not directly used here, but part of AnalysisResult
    PracticeMaterial
} from '../types';

const API_KEY = process.env.API_KEY;

let ai: GoogleGenAI | null = null;
if (API_KEY) {
  ai = new GoogleGenAI({ apiKey: API_KEY });
} else {
  console.error("API_KEY environment variable not found. Gemini API calls will fail. Ensure it's set in your execution environment.");
}

const parseJsonFromAiResponse = <T>(
    responseText: string, 
    fieldCheck: (parsed: any) => true | string // Updated to return true or an error string
): T => {
    let jsonStr = responseText.trim();
    
    const fenceRegex = /^```(?:json)?\s*\n?(.*?)\n?\s*```$/s;
    const match = jsonStr.match(fenceRegex);
    if (match && match[1]) {
        jsonStr = match[1].trim();
    }

    try {
        // Attempt to fix common issues like unescaped backslashes not part of valid escape sequences
        // This regex looks for a backslash NOT followed by b, f, n, r, t, ", \, /, or u
        jsonStr = jsonStr.replace(/\\(?![bfnrt"\\\/u])/g, "\\\\");
    } catch(e) {
        console.warn("Attempted backslash sanitization failed, proceeding with original string:", e);
    }

    // Removed global replacement of \n, \r, \t as it was breaking JSON structure.
    // The Gemini API with responseMimeType: "application/json" should provide valid JSON,
    // including correct escaping of these characters *within* string values.

    try {
        let dataToValidate = JSON.parse(jsonStr); // Parse it first

        // Check if the parsed data is an array and has at least one element
        if (Array.isArray(dataToValidate) && dataToValidate.length > 0) {
            dataToValidate = dataToValidate[0]; // Use the first element for validation
        } else if (Array.isArray(dataToValidate) && dataToValidate.length === 0) {
            // Handle empty array case - this is an invalid response
            console.error("AI response is an empty array.");
            throw new Error("AI returned an empty array response.");
        }
        // If it's not an array, dataToValidate remains the parsed object.

        const checkResult = fieldCheck(dataToValidate); // Validate the (potentially modified) data
        if (checkResult === true) {
            return dataToValidate as T; // Return the (potentially modified) data
        } else {
            // checkResult is a string containing the specific error message
            console.error("AI response validation failed:", checkResult, "Validated object (or first element if array):", dataToValidate);
            throw new Error(`AI response validation failed: ${checkResult}. The AI might be unable to process the request as expected. Check console for the actual validated object.`);
        }
    } catch (e) {
        // This catches errors from JSON.parse or the error thrown above if fieldCheck fails
        console.error("Failed to parse or validate JSON response from AI:", e);
        console.error("Raw response text (after any sanitization):", jsonStr);
        if (e instanceof Error && e.message.startsWith("AI response validation failed:")) {
            throw e; // Re-throw the more specific error
        }
        // Provide a more specific error message if it's a SyntaxError from JSON.parse
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
    
    if (!Array.isArray(parsed.practiceSection.instructionLevels)) return "Field 'practiceSection.instructionLevels' is not an array";
    if (parsed.practiceSection.instructionLevels.length === 0) return "Field 'practiceSection.instructionLevels' array is empty";
    for (let i = 0; i < parsed.practiceSection.instructionLevels.length; i++) {
        if (typeof parsed.practiceSection.instructionLevels[i] !== 'string') {
            return `Element at index ${i} in 'practiceSection.instructionLevels' is not a string`;
        }
    }
    
    if (typeof parsed.practiceSection.solutionCode !== 'string') return "Field 'practiceSection.solutionCode' is not a string";
    if (typeof parsed.practiceSection.solutionOutput !== 'string') return "Field 'practiceSection.solutionOutput' is not a string";
    
    return true;
};

const userSolutionAnalysisFieldCheck = (parsed: any): true | string => {
    if (typeof parsed !== 'object' || parsed === null) return "Parsed JSON is not an object.";
    if (typeof parsed.predictedOutput !== 'string') return "Field 'predictedOutput' is not a string";
    if (typeof parsed.feedback !== 'string') return "Field 'feedback' is not a string";
    // isCorrect is optional, so no strict check for presence, but if present, check type
    if (parsed.hasOwnProperty('isCorrect') && typeof parsed.isCorrect !== 'boolean') {
        return "Optional field 'isCorrect' is present but not a boolean";
    }
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
            return `Provide only raw, runnable ${languageName} code. Incorporate common patterns, perhaps simple conditional logic or loops, demonstrates practical application of the concept, moderate length.`;
    }
};

export const analyzeCodeWithGemini = async (
    codeContent: string,
    language: SupportedLanguage,
    initialDifficulty: ExampleDifficulty
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
    - "instructionLevels": An array of strings. Each string in the array represents a distinct, progressively more detailed level of instruction for solving the "questionText".
        - Start with high-level conceptual steps for the first level (the first string in the array).
        - Subsequent strings (levels) should build upon the previous, offering more specific guidance, breaking down complex steps, suggesting functions/methods, or detailing logic flow.
        - Generate as many levels as you deem appropriate for the complexity of the "questionText" (typically 2-4 levels, but can be more or less based on complexity). Ensure this array always contains at least one string.
        - Each string (representing one instruction level) should be a multi-line text where each line within that string is a clear step (e.g., "Step 1: Define the main function.\\nStep 2: Initialize variables."). Use \\n for newlines within each instruction level string.
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
        const response = await ai.models.generateContent({
            model: "gemini-2.5-flash-preview-04-17", contents: prompt,
            config: { responseMimeType: "application/json", temperature: 0.4 }
        });
        const parsedResult = parseJsonFromAiResponse<AnalysisResult>(response.text, analysisResultFieldCheck);
        return parsedResult;
    } catch (error) {
        console.error("Error calling Gemini API for code analysis:", error);
        if (error instanceof Error && error.message) {
             if (error.message.includes("API key not valid") || error.message.includes("API_KEY_INVALID")) throw new Error("Invalid API Key. Check configuration.");
             if (error.message.toLowerCase().includes("quota")) throw new Error("API quota exceeded. Try again later.");
        }
        // If the error is from parseJsonFromAiResponse, it will be more specific. Otherwise, use a generic message.
        if (error instanceof Error && (error.message.startsWith("AI response validation failed:") || error.message.startsWith("AI returned malformed JSON."))) {
             throw error;
        }
        throw new Error("Failed to get analysis from AI. Check network/API key, then try again.");
    }
};

export const analyzeConceptWithGemini = async (
    concept: string,
    language: SupportedLanguage,
    initialDifficulty: ExampleDifficulty
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
    - "instructionLevels": An array of strings. Each string in the array represents a distinct, progressively more detailed level of instruction for solving the "questionText".
        - Start with high-level conceptual steps for the first level (the first string in the array).
        - Subsequent strings (levels) should build upon the previous, offering more specific guidance, breaking down complex steps, suggesting functions/methods, or detailing logic flow.
        - Generate as many levels as you deem appropriate for the complexity of the "questionText" (typically 2-4 levels, but can be more or less based on complexity). Ensure this array always contains at least one string.
        - Each string (representing one instruction level) should be a multi-line text where each line within that string is a clear step (e.g., "Step 1: Define the main function.\\nStep 2: Initialize variables."). Use \\n for newlines within each instruction level string.
    - "solutionCode": The complete, correct, and runnable ${languageName} code that solves the questionText. This code MUST BE PURE ${languageName} CODE with no surrounding text, markdown, or explanations. Ensure all special characters in string literals within the code (like backslashes) are correctly escaped for ${languageName}.
    - "solutionOutput": The exact, expected output if the solutionCode were executed. If no visible output, use "[No direct output produced by this solution]".

IMPORTANT: All string values within the JSON structure itself (like explanations, instructions, code outputs) MUST be valid JSON strings. This means special characters like backslashes (\\), quotes (\"), and newlines (\\n) must be properly escaped within the JSON string literals. For example, if an explanation needs to include a literal backslash, it should appear as \\\\ in the JSON string.
CRITICALLY IMPORTANT: Ensure all keys within any single JSON object are unique. Duplicate keys within the same object are NOT ALLOWED and will result in an invalid JSON structure.

Respond ONLY with the valid JSON object. Ensure the JSON is well-formed and all string values are properly escaped for JSON.
`;

    try {
        const response = await ai.models.generateContent({
            model: "gemini-2.5-flash-preview-04-17", contents: prompt,
            config: { responseMimeType: "application/json", temperature: 0.45 }
        });
        const parsedResult = parseJsonFromAiResponse<AnalysisResult>(response.text, analysisResultFieldCheck);
        return parsedResult;
    } catch (error) {
        console.error("Error calling Gemini API for concept analysis:", error);
         if (error instanceof Error && error.message) {
             if (error.message.includes("API key not valid") || error.message.includes("API_KEY_INVALID")) throw new Error("Invalid API Key. Check configuration.");
             if (error.message.toLowerCase().includes("quota")) throw new Error("API quota exceeded. Try again later.");
        }
        if (error instanceof Error && (error.message.startsWith("AI response validation failed:") || error.message.startsWith("AI returned malformed JSON."))) {
            throw error;
       }
        throw new Error("Failed to get concept analysis from AI. Check network/API key, then try again.");
    }
};


export const checkUserSolutionWithGemini = async (
    userCode: string, 
    language: SupportedLanguage, 
    practiceMaterial: PracticeMaterial,
    topicCoreConcepts: string 
): Promise<UserSolutionAnalysis> => {
    if (!ai) throw new Error("Gemini AI client is not initialized. Ensure API_KEY is set.");
    if (language === SupportedLanguage.UNKNOWN) throw new Error("Cannot analyze solution for an unknown language.");

    const languageName = LanguageDisplayNames[language];

    let instructionsContext = "The user had access to the following instruction levels if they chose to reveal them:\n";
    if (practiceMaterial.instructionLevels && practiceMaterial.instructionLevels.length > 0) {
        practiceMaterial.instructionLevels.forEach((levelContent, index) => {
            instructionsContext += `--- Level ${index + 1} Instructions ---\n${levelContent}\n\n`;
        });
    } else {
        instructionsContext += "No specific multi-level instructions were provided for this question beyond the question text itself.\n";
    }

    const prompt = `
You are an expert programming tutor. The user is attempting to solve a practice question.
The programming language is ${languageName}.
The core topic being practiced is related to: "${topicCoreConcepts}"
The practice question was: "${practiceMaterial.questionText}"

${instructionsContext}

Here is the user's submitted code:
\`\`\`${language}
${userCode}
\`\`\`

Analyze the user's solution. Your primary task is to determine if the user's code CORRECTLY AND COMPLETELY SOLVES the practice question ("${practiceMaterial.questionText}").

Provide your analysis in a JSON format with the following exact keys: "predictedOutput", "feedback", and "isCorrect" (boolean).

- "predictedOutput": A string representing the exact, predicted output if the user's code were executed. If the code would produce no visible output or result in an error, state that clearly (e.g., "[No direct output]" or "[Error: Division by zero]").
- "isCorrect": A boolean value.
  - Set to true ONLY IF the user's code accurately and fully solves the problem as described by "${practiceMaterial.questionText}". Consider if they followed the general approach outlined in the instructions (if available to them), but prioritize correctness of the solution to the "questionText".
  - Set to false if the user's code fails to solve the "questionText" correctly, contains errors, or is incomplete.
- "feedback": Constructive feedback on the user's solution.
  - If "isCorrect" is true, briefly acknowledge its correctness. You may also point out any best practices or alternative approaches if relevant.
  - If "isCorrect" is false, your feedback should clearly explain WHAT is incorrect or missing in relation to the "questionText". Be encouraging and suggest improvements. You may reference the provided instruction levels if the user missed key guidance.

IMPORTANT: All string values within the JSON structure itself (like feedback and predictedOutput) MUST be valid JSON strings. This means special characters like backslashes (\\), quotes (\"), and newlines (\\n) must be properly escaped within the JSON string literals.
CRITICALLY IMPORTANT: Ensure all keys within any single JSON object are unique. Duplicate keys within the same object are NOT ALLOWED and will result in an invalid JSON structure.

Respond ONLY with the valid JSON object described above, without any additional explanations or surrounding text. Ensure the JSON is well-formed and all string values are properly escaped for JSON.
`;
    try {
        const response = await ai.models.generateContent({
            model: "gemini-2.5-flash-preview-04-17", contents: prompt,
            config: { responseMimeType: "application/json", temperature: 0.3 } 
        });
        return parseJsonFromAiResponse<UserSolutionAnalysis>(response.text, userSolutionAnalysisFieldCheck);
    } catch (error) {
        console.error("Error calling Gemini API for solution check:", error);
        if (error instanceof Error && error.message) {
            if (error.message.includes("API key not valid") || error.message.includes("API_KEY_INVALID")) throw new Error("Invalid API Key. Check configuration.");
            if (error.message.toLowerCase().includes("quota")) throw new Error("API quota exceeded. Try again later.");
       }
       if (error instanceof Error && (error.message.startsWith("AI response validation failed:") || error.message.startsWith("AI returned malformed JSON."))) {
            throw error;
       }
        throw new Error("Failed to get feedback for your solution. Check network/API key, then try again.");
    }
};

export const getExampleByDifficulty = async (
    topicCoreConcepts: string, language: SupportedLanguage, difficulty: ExampleDifficulty
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
        const response = await ai.models.generateContent({
            model: "gemini-2.5-flash-preview-04-17", contents: prompt,
            config: { responseMimeType: "application/json", temperature: 0.6 }
        });
        return parseJsonFromAiResponse<ExampleCodeData>(response.text, exampleCodeDataFieldCheck);
    } catch (error) {
        console.error(`Error calling Gemini API for ${difficulty} example:`, error);
        if (error instanceof Error && error.message) {
            if (error.message.includes("API key not valid") || error.message.includes("API_KEY_INVALID")) throw new Error("Invalid API Key. Check configuration.");
            if (error.message.toLowerCase().includes("quota")) throw new Error("API quota exceeded. Try again later.");
        }
        if (error instanceof Error && (error.message.startsWith("AI response validation failed:") || error.message.startsWith("AI returned malformed JSON."))) {
            throw error;
       }
        throw new Error(`Failed to generate ${difficulty} example from AI. Try again.`);
    }
};

export const askFollowUpQuestionWithGemini = async (
    userQuestion: string, 
    fullExplanationContext: string, 
    language: SupportedLanguage,
    originalInputContext: string, 
    inputType: 'code' | 'concept'
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
        const response = await ai.models.generateContent({
            model: "gemini-2.5-flash-preview-04-17",
            contents: prompt,
            config: { temperature: 0.55 }
        });
        return response.text;
    } catch (error) {
        console.error("Error calling Gemini API for follow-up question:", error);
        if (error instanceof Error && error.message) {
            if (error.message.includes("API key not valid") || error.message.includes("API_KEY_INVALID")) throw new Error("Invalid API Key. Check configuration.");
            if (error.message.toLowerCase().includes("quota")) throw new Error("API quota exceeded. Try again later.");
        }
        throw new Error("Failed to get an answer from AI for your follow-up question. Please try again.");
    }
};
