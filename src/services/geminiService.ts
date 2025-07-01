





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
    AssessmentStatus
} from '../types';

const API_KEY = process.env.API_KEY;
const API_TIMEOUT_MS = 45000; // 45 seconds

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
        let dataToValidate = JSON.parse(jsonStr); 

        // If AI returns an array of objects, take the first one.
        // This is a common pattern observed with some model responses.
        if (Array.isArray(dataToValidate) && dataToValidate.length > 0) {
            dataToValidate = dataToValidate[0]; 
        } else if (Array.isArray(dataToValidate) && dataToValidate.length === 0) {
            console.error("AI response is an empty array.");
            throw new Error("AI returned an empty array response.");
        }
        
        // Pre-validation normalization for common AI response inconsistencies, especially for code fields.
        const normalizeCodeField = (obj: any, fieldName: string) => {
            if (obj && obj.hasOwnProperty(fieldName)) {
                const codeField = obj[fieldName];
                
                // Case 1: AI returns { "code": "...", "language": "..." } or similar object.
                if (typeof codeField === 'object' && codeField !== null && !Array.isArray(codeField) && typeof codeField.code === 'string') {
                    obj[fieldName] = codeField.code;
                }
                // Case 2: AI returns an array of code lines.
                else if (Array.isArray(codeField) && codeField.every((item: any) => typeof item === 'string')) {
                    obj[fieldName] = codeField.join('\n');
                }
            }
        };

        // Normalize top-level and nested code fields before validation.
        normalizeCodeField(dataToValidate, 'exampleCode');
        if (dataToValidate && dataToValidate.practiceSection) {
            normalizeCodeField(dataToValidate.practiceSection, 'solutionCode');
        } else {
             // If this is a direct practice material response, normalize its solutionCode
            normalizeCodeField(dataToValidate, 'solutionCode');
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
    
    if (!Array.isArray(parsed.topicExplanation.lineByLineBreakdown)) return "Field 'topicExplanation.lineByLineBreakdown' is not an array";
    if (parsed.topicExplanation.lineByLineBreakdown.length > 0) {
        const isValid = parsed.topicExplanation.lineByLineBreakdown.every((item: any) => 
            typeof item === 'object' && item !== null && typeof item.code === 'string' && typeof item.explanation === 'string'
        );
        if (!isValid) return "Elements in 'lineByLineBreakdown' array do not have the required '{code: string, explanation: string}' structure.";
    }

    if (typeof parsed.topicExplanation.executionFlowAndDataTransformation !== 'string') return "Field 'topicExplanation.executionFlowAndDataTransformation' is not a string";
    
    if (typeof parsed.exampleCode !== 'string') return "Field 'exampleCode' is not a string";
    if (typeof parsed.exampleCodeOutput !== 'string') return "Field 'exampleCodeOutput' is not a string";
    
    if (typeof parsed.practiceSection !== 'object' || parsed.practiceSection === null) return "Missing 'practiceSection' object";
    const practiceCheck = practiceMaterialFieldCheck(parsed.practiceSection);
    if (practiceCheck !== true) return `Validation failed inside 'practiceSection': ${practiceCheck}`;
    
    return true;
};

const practiceMaterialFieldCheck = (parsed: any): true | string => {
    if (typeof parsed !== 'object' || parsed === null) return "Parsed JSON is not an object.";
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
    if (typeof parsed !== 'object' || parsed === null) return "Parsed JSON is not an object.";
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

const criticalJsonFormattingRules = `
CRITICAL JSON FORMATTING RULES:
- The entire response MUST be a single, valid JSON object.
- All keys and string values must be enclosed in double quotes (").
- All special characters inside string values MUST be correctly escaped for JSON.
  - Double quotes (") must be escaped as \\". For example, a code snippet like \`print("hello")\` MUST be represented in a JSON string as \`"print(\\"hello\\")"\`. This is CRITICAL for fields containing code.
  - Backslashes (\\) must be escaped as \\\\. For example, a Windows path \`"C:\\Users\\Test"\` MUST be represented as \`"C:\\\\Users\\\\Test"\`.
  - Newlines must be escaped as \\n.
- No trailing commas in objects or arrays.
- All keys within a single JSON object must be unique.
Adhere to these rules strictly to prevent JSON parsing errors.
`;

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

    const practiceDifficultyGuidance = getPracticeQuestionDifficultyGuidance(isDetectingLanguage ? 'the detected language' : LanguageDisplayNames[language], practiceDifficulty);

    const practiceSectionInstructions = `
Details for the "practiceSection" top-level key. It MUST be an object with the following keys:
- "questionText": ${practiceDifficultyGuidance}
- "normalInstructionsLevel1": An array of strings with 3-5 high-level, conceptual steps (Level 1). DO NOT give away the full solution or specific implementation details in these initial steps.
- "lineByLineInstructions": An array of strings. Each string is a granular step guiding the user to build the solution line-by-line WITHOUT showing the code. For example: "1. Declare a function 'main' that returns an integer.", "2. Inside main, use 'std::cout' to print 'Hello World'.".
- "solutionCode": The complete, runnable code solution for the "questionText".
- "solutionOutput": The exact output of the "solutionCode".
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

Provide your analysis in a JSON format. The top-level JSON object must contain the following exact keys: "detectedLanguage", "topicExplanation", "exampleCode", "exampleCodeOutput", "practiceSection".

- "detectedLanguage": A string representing the identified programming language. The value MUST be one of the following: ${validLanguages}.
- "topicExplanation": A JSON object with keys "coreConcepts", "lineByLineBreakdown", and "executionFlowAndDataTransformation".
  - "coreConcepts": A comprehensive explanation of the main concepts in the code.
  - "lineByLineBreakdown": An array of objects, each with "code" and "explanation" keys, breaking down the user's code. Do NOT explain comments.
  - "executionFlowAndDataTransformation": An explanation of how the code executes and transforms data.
- "exampleCode": A STRING containing a '${initialDifficulty}' difficulty code example in the DETECTED language, illustrating the core concepts. This value MUST be only pure, raw, runnable code.
- "exampleCodeOutput": A STRING representing the exact output of "exampleCode".
- "practiceSection": An object structured as described below.

${practiceSectionInstructions}
${criticalJsonFormattingRules}

User's Code Snippet to analyze:
\`\`\`
${codeContent}
\`\`\`

Respond ONLY with the valid JSON object described above.
`;
        fieldCheck = (parsed: any): true | string => {
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

Provide your analysis in a JSON format. The top-level JSON object must contain the following exact keys: "topicExplanation", "exampleCode", "exampleCodeOutput", "practiceSection".

The value for the "topicExplanation" key MUST be a JSON object structured as follows:
{
    "coreConcepts": "[Provide a comprehensive and detailed explanation of THE MAIN PROGRAMMING CONCEPT(S) DEMONSTRATED IN THE USER'S UPLOADED CODE. Begin with a concise, high-level overview. The primary focus must be on the user's code functionality, its structure, and its logic. This should be tailored to the user's code, easy for a learner to understand, cover key aspects, and can be multiple paragraphs if necessary. Ensure this is a single JSON string value.]",
    "lineByLineBreakdown": [
        {
            "code": "/* A single line or small logical block of the user's code goes here */",
            "explanation": "/* A concise explanation for the code line/block above. For simple lines, this should be 1-2 sentences. For more complex lines, it can be longer. Do NOT explain comments. */"
        }
    ],
    "executionFlowAndDataTransformation": "[Explain how the user's code executes step-by-step. Detail the flow of control, how variables change, and how data is transformed throughout the program's lifecycle. Ensure this is a single JSON string value.]"
}

Specific rules for "lineByLineBreakdown":
- It MUST be an array of objects.
- Each object MUST have two string keys: 'code' and 'explanation'.
- The array must sequentially cover the entire user's code.
- Explanations must be concise but adapt in length based on code complexity.
- CRITICALLY IMPORTANT: Your explanation must NOT mention, reference, or explain any comments present in the code (e.g., lines starting with '#'). Focus exclusively on what the executable code does.

The "exampleCode" and "exampleCodeOutput" keys MUST be direct, top-level properties of the main JSON object:
- "exampleCode": THIS MUST BE A STRING containing the '${initialDifficulty}' difficulty ${languageName} code example that clearly illustrates THE CORE CONCEPT(S) explained in "coreConcepts". This example must be different from the user's input code and should be ready to compile/run. ${difficultyGuidance} The value MUST be only pure, raw, runnable ${languageName} code.
- "exampleCodeOutput": THIS MUST BE A STRING representing the exact, expected output if "exampleCode" were executed. If no visible output, use "[No direct output produced by this example]".

${practiceSectionInstructions}
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
                model: "gemini-2.5-flash-preview-04-17",
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
    const difficultyGuidance = getDifficultyGuidance(languageName, initialDifficulty);
    const practiceDifficultyGuidance = getPracticeQuestionDifficultyGuidance(languageName, practiceDifficulty);

    const practiceSectionInstructions = `
Details for the "practiceSection" top-level key. It MUST be an object with the following keys:
- "questionText": ${practiceDifficultyGuidance}
- "normalInstructionsLevel1": An array of strings with 3-5 high-level, conceptual steps (Level 1). DO NOT give away the full solution or specific implementation details in these initial steps.
- "lineByLineInstructions": An array of strings. Each string is a granular step guiding the user to build the solution line-by-line WITHOUT showing the code. For example: "1. Declare a function 'main' that returns an integer.", "2. Inside main, use 'std::cout' to print 'Hello World'.".
- "solutionCode": The complete, runnable code solution for the "questionText".
- "solutionOutput": The exact output of the "solutionCode".
`;

    const prompt = `
You are an expert programming tutor. A user wants to understand a specific programming concept.
The programming language context is ${languageName}.
The concept the user wants to understand is: "${concept}"

Provide your analysis in a JSON format. The top-level JSON object must contain the following exact keys: "topicExplanation", "exampleCode", "exampleCodeOutput", "practiceSection".

The value for the "topicExplanation" key MUST be a JSON object structured as follows:
{
    "coreConcepts": "[Provide a comprehensive and detailed explanation of the core aspects of \\"${concept}\\" specifically within the context of the ${languageName} language. Begin with a concise, high-level overview. This explanation should be thorough, cover key aspects, potential nuances, and be easy for a learner to understand. Ensure this is a single JSON string value.]",
    "lineByLineBreakdown": [
        {
            "code": "/* A generic code line/block illustrating the concept goes here */",
            "explanation": "/* A concise explanation for the generic code line/block above. Explain each part's role in the context of \\"${concept}\\". Adapt explanation length to complexity. If not applicable, the array can be empty or contain a single object with an explanation that this is not applicable. */"
        }
    ],
    "executionFlowAndDataTransformation": "[Explain how a program utilizing this concept (\\"${concept}\\") would typically execute or how the concept manifests in execution. Describe how data is typically transformed or managed when this concept is applied. Ensure this is a single JSON string value.]"
}

Specific rules for "lineByLineBreakdown":
- It MUST be an array of objects.
- Each object MUST have two string keys: 'code' and 'explanation'.
- If the concept involves a typical code structure (e.g., a for loop, a class definition), provide a breakdown of such a generic structure.
- If not applicable, you can provide an empty array [] or state its non-applicability in a single entry's explanation.

The "exampleCode" and "exampleCodeOutput" keys MUST be direct, top-level properties of the main JSON object:
- "exampleCode": THIS MUST BE A STRING containing the '${initialDifficulty}' difficulty ${languageName} code example that clearly illustrates the core idea of THE USER'S CONCEPT ("${concept}"). This example must be ready to compile/run. ${difficultyGuidance} The value MUST be only pure, raw, runnable ${languageName} code.
- "exampleCodeOutput": THIS MUST BE A STRING representing the exact, expected output if "exampleCode" were executed. If no visible output, use "[No direct output produced by this example definition]".

${practiceSectionInstructions}
${criticalJsonFormattingRules}

Respond ONLY with the valid JSON object described above.
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

${criticalJsonFormattingRules}

Respond ONLY with the valid JSON object described above.
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
                model: "gemini-2.5-flash-preview-04-17",
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