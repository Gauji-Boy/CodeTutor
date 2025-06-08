
import { GoogleGenAI } from "@google/genai";
import { 
    AnalysisResult, 
    SupportedLanguage, 
    UserSolutionAnalysis, 
    LanguageDisplayNames,
    ExampleDifficulty,
    ExampleCodeData
} from '../types';

const API_KEY = process.env.API_KEY;

let ai: GoogleGenAI | null = null;
if (API_KEY) {
  ai = new GoogleGenAI({ apiKey: API_KEY });
} else {
  console.error("API_KEY environment variable not found. Gemini API calls will fail. Ensure it's set in your execution environment.");
}

const parseJsonFromAiResponse = <T>(responseText: string, fieldCheck: (parsed: any) => boolean): T => {
    let jsonStr = responseText.trim();
    
    const fenceRegex = /^```(?:json)?\s*\n?(.*?)\n?\s*```$/s;
    const match = jsonStr.match(fenceRegex);
    if (match && match[1]) {
        jsonStr = match[1].trim();
    }

    try {
        const parsed = JSON.parse(jsonStr);
        if (fieldCheck(parsed)) {
            return parsed as T;
        } else {
            console.error("Missing fields in AI response. Parsed:", parsed);
            throw new Error("AI response is missing required fields. The AI might be unable to process the request as expected. Check console for details.");
        }
    } catch (e) {
        console.error("Failed to parse JSON response from AI:", e);
        console.error("Raw response text:", responseText);
        throw new Error(`AI returned an invalid response format. Please try again. Raw: ${responseText.substring(0,200)}...`);
    }
};

const analysisResultFieldCheck = (parsed: any): parsed is AnalysisResult => {
    return typeof parsed.topicExplanation === 'string' &&
           typeof parsed.exampleCode === 'string' &&
           typeof parsed.exampleCodeOutput === 'string' &&
           typeof parsed.practiceQuestion === 'string' &&
           typeof parsed.instructions === 'string';
    // exampleDifficulty is optional in the type, so not strictly checked here for presence
    // It will be added by the calling function.
};

const userSolutionAnalysisFieldCheck = (parsed: any): parsed is UserSolutionAnalysis => {
    return typeof parsed.predictedOutput === 'string' &&
           typeof parsed.feedback === 'string';
};

const exampleCodeDataFieldCheck = (parsed: any): parsed is ExampleCodeData => {
    return typeof parsed.exampleCode === 'string' &&
           typeof parsed.exampleCodeOutput === 'string';
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
            return `Provide only raw, runnable ${languageName} code. Incorporate common patterns, perhaps simple conditional logic or loops, demonstrates practical application of the concept, moderate length.`; // Default to intermediate
    }
};

export const analyzeCodeWithGemini = async (
    codeContent: string,
    language: SupportedLanguage,
    initialDifficulty: ExampleDifficulty // New parameter
): Promise<AnalysisResult> => {
    if (!ai) {
        throw new Error("Gemini AI client is not initialized. Ensure the API_KEY environment variable is set correctly.");
    }
    if (language === SupportedLanguage.UNKNOWN) {
        throw new Error("Cannot analyze code for an unknown language.");
    }

    const languageName = LanguageDisplayNames[language];
    const difficultyGuidance = getDifficultyGuidance(languageName, initialDifficulty);

    const prompt = `
You are an expert programming tutor. Analyze the following ${languageName} code.
Provide your analysis in a JSON format with the following exact keys: "topicExplanation", "exampleCode", "exampleCodeOutput", "practiceQuestion", "instructions".

- "topicExplanation": A clear, concise explanation of the main programming concept demonstrated in the uploaded code. This should be a single paragraph.
- "exampleCode": A '${initialDifficulty}' difficulty ${languageName} code example illustrating the explained concept. This example must be different from the user's input code and should be ready to compile/run. ${difficultyGuidance} CRITICALLY IMPORTANT: The 'exampleCode' field MUST contain only pure, raw, runnable ${languageName} code, without any HTML, markdown, or other formatting/styling tags. The frontend will handle syntax highlighting.
- "exampleCodeOutput": A string representing the exact, expected output if the "exampleCode" were executed. If the example code produces no visible output, this should be an empty string or a concise note like "[No direct output produced by this example]".
- "practiceQuestion": A programming question related to the explained concept that a learner can solve in ${languageName}.
- "instructions": Step-by-step instructions on how to approach and solve the practiceQuestion. Provide these as a multi-line string, with each step clearly articulated.

User's ${languageName} Code:
\`\`\`${language}
${codeContent}
\`\`\`

Respond ONLY with the valid JSON object described above, without any additional explanations or surrounding text. Ensure the JSON is well-formed.
`;

    try {
        const response = await ai.models.generateContent({
            model: "gemini-2.5-flash-preview-04-17",
            contents: prompt,
            config: {
                responseMimeType: "application/json",
                temperature: 0.4, 
            }
        });
        
        const parsedResult = parseJsonFromAiResponse<Omit<AnalysisResult, 'exampleDifficulty'>>(response.text, analysisResultFieldCheck);
        return { ...parsedResult, exampleDifficulty: initialDifficulty };

    } catch (error) {
        console.error("Error calling Gemini API for code analysis:", error);
        if (error instanceof Error && error.message) {
             if (error.message.includes("API key not valid") || error.message.includes("API_KEY_INVALID")) {
                throw new Error("Invalid API Key. Please check your API_KEY environment variable configuration.");
            }
             if (error.message.toLowerCase().includes("quota")) {
                throw new Error("API quota exceeded. Please try again later or check your Google Cloud console for quota limits.");
            }
        }
        throw new Error("Failed to get analysis from AI. Please check your network connection and API key, then try again.");
    }
};

export const analyzeConceptWithGemini = async (
    concept: string,
    language: SupportedLanguage,
    initialDifficulty: ExampleDifficulty // New parameter
): Promise<AnalysisResult> => {
    if (!ai) {
        throw new Error("Gemini AI client is not initialized. Ensure the API_KEY environment variable is set correctly.");
    }
    if (language === SupportedLanguage.UNKNOWN) {
        throw new Error("Cannot analyze a concept for an unknown language context.");
    }

    const languageName = LanguageDisplayNames[language];
    const difficultyGuidance = getDifficultyGuidance(languageName, initialDifficulty);

    const prompt = `
You are an expert programming tutor. A user wants to understand a programming concept.
The programming language context is ${languageName}.
The concept the user wants to understand is: "${concept}"

Provide your analysis in a JSON format with the following exact keys: "topicExplanation", "exampleCode", "exampleCodeOutput", "practiceQuestion", "instructions".

- "topicExplanation": A clear, concise explanation of the provided programming concept ("${concept}") specifically within the context of the ${languageName} language. This should be detailed and easy to understand for a learner.
- "exampleCode": A '${initialDifficulty}' difficulty ${languageName} code example that clearly illustrates the core idea of the "${concept}". This example must be ready to compile/run if applicable for the language. ${difficultyGuidance} CRITICALLY IMPORTANT: The 'exampleCode' field MUST contain only pure, raw, runnable ${languageName} code, without any HTML, markdown, or other formatting/styling tags. The frontend will handle syntax highlighting.
- "exampleCodeOutput": A string representing the exact, expected output if the "exampleCode" were executed. If the example code produces no visible output (e.g., it defines a class or function but doesn't call it to produce output), this should be an empty string or a concise note like "[No direct output produced by this example definition]".
- "practiceQuestion": A relevant programming question related to the "${concept}" that a learner can solve using ${languageName}. The question should encourage application of the concept.
- "instructions": Step-by-step instructions on how to approach and solve the "practiceQuestion". Provide these as a multi-line string, with each step clearly articulated.

Respond ONLY with the valid JSON object described above, without any additional explanations or surrounding text. Ensure the JSON is well-formed.
`;

    try {
        const response = await ai.models.generateContent({
            model: "gemini-2.5-flash-preview-04-17",
            contents: prompt,
            config: {
                responseMimeType: "application/json",
                temperature: 0.45, 
            }
        });
        
        const parsedResult = parseJsonFromAiResponse<Omit<AnalysisResult, 'exampleDifficulty'>>(response.text, analysisResultFieldCheck);
        return { ...parsedResult, exampleDifficulty: initialDifficulty };

    } catch (error) {
        console.error("Error calling Gemini API for concept analysis:", error);
         if (error instanceof Error && error.message) {
             if (error.message.includes("API key not valid") || error.message.includes("API_KEY_INVALID")) {
                throw new Error("Invalid API Key. Please check your API_KEY environment variable configuration.");
            }
             if (error.message.toLowerCase().includes("quota")) {
                throw new Error("API quota exceeded. Please try again later or check your Google Cloud console for quota limits.");
            }
        }
        throw new Error("Failed to get concept analysis from AI. Please check your network connection and API key, then try again.");
    }
};


export const checkUserSolutionWithGemini = async (
    userCode: string,
    language: SupportedLanguage,
    practiceQuestion: string,
    topicExplanation: string 
): Promise<UserSolutionAnalysis> => {
    if (!ai) {
        throw new Error("Gemini AI client is not initialized. Ensure the API_KEY environment variable is set correctly.");
    }
    if (language === SupportedLanguage.UNKNOWN) {
        throw new Error("Cannot analyze solution for an unknown language.");
    }

    const languageName = LanguageDisplayNames[language];

    const prompt = `
You are an expert programming tutor. The user is attempting to solve a practice question.
The programming language is ${languageName}.
The topic being practiced is: "${topicExplanation}"
The practice question was: "${practiceQuestion}"

Here is the user's submitted code:
\`\`\`${language}
${userCode}
\`\`\`

Analyze the user's solution. Provide your analysis in a JSON format with the following exact keys: "predictedOutput", "feedback", and optionally "isCorrect" (boolean).

- "predictedOutput": A string representing the exact, predicted output if the user's code were executed. If the code would produce no visible output or result in an error, state that clearly (e.g., "[No direct output]" or "[Error: Division by zero]").
- "feedback": Constructive feedback on the user's solution. Explain if it's correct or incorrect, why, and suggest improvements or point out any logical errors or bugs. Be encouraging.
- "isCorrect": (Optional) A boolean value (true/false) indicating if the solution correctly solves the practice question.

Respond ONLY with the valid JSON object described above, without any additional explanations or surrounding text. Ensure the JSON is well-formed.
`;

    try {
        const response = await ai.models.generateContent({
            model: "gemini-2.5-flash-preview-04-17", 
            contents: prompt,
            config: {
                responseMimeType: "application/json",
                temperature: 0.5, 
            }
        });

        return parseJsonFromAiResponse<UserSolutionAnalysis>(response.text, userSolutionAnalysisFieldCheck);

    } catch (error) {
        console.error("Error calling Gemini API for solution check:", error);
        if (error instanceof Error && error.message) {
            if (error.message.includes("API key not valid") || error.message.includes("API_KEY_INVALID")) {
               throw new Error("Invalid API Key. Please check your API_KEY environment variable configuration.");
           }
            if (error.message.toLowerCase().includes("quota")) {
               throw new Error("API quota exceeded. Please try again later or check your Google Cloud console for quota limits.");
           }
       }
        throw new Error("Failed to get feedback for your solution from AI. Please check your network and API key, then try again.");
    }
};

export const getExampleByDifficulty = async (
    topicExplanation: string,
    language: SupportedLanguage,
    difficulty: ExampleDifficulty
): Promise<ExampleCodeData> => {
    if (!ai) {
        throw new Error("Gemini AI client is not initialized. Ensure the API_KEY environment variable is set correctly.");
    }
    if (language === SupportedLanguage.UNKNOWN) {
        throw new Error("Cannot generate example for an unknown language.");
    }

    const languageName = LanguageDisplayNames[language];
    const difficultyGuidanceText = getDifficultyGuidance(languageName, difficulty);

    const prompt = `
You are an expert programming tutor.
The user wants a ${languageName} code example for the concept: "${topicExplanation}".
The requested difficulty level is: "${difficulty}".

Guidance for "${difficulty}" difficulty: ${difficultyGuidanceText}

Provide ONLY a JSON object with the following exact keys: "exampleCode" and "exampleCodeOutput".
- "exampleCode": A self-contained ${languageName} code snippet for the concept "${topicExplanation}" at the "${difficulty}" difficulty level. CRITICALLY IMPORTANT: The 'exampleCode' field MUST contain only pure, raw, runnable ${languageName} code, without any HTML, markdown, or other formatting/styling tags. The frontend will handle syntax highlighting.
- "exampleCodeOutput": A string representing the exact, expected output if the "exampleCode" were executed. If the example code produces no visible output, this should be an empty string or a concise note like "[No direct output produced by this example]".

Respond ONLY with the valid JSON object. Do not include any other text or explanations.
`;

    try {
        const response = await ai.models.generateContent({
            model: "gemini-2.5-flash-preview-04-17",
            contents: prompt,
            config: {
                responseMimeType: "application/json",
                temperature: 0.6, 
            }
        });
        
        return parseJsonFromAiResponse<ExampleCodeData>(response.text, exampleCodeDataFieldCheck);

    } catch (error) {
        console.error(`Error calling Gemini API for ${difficulty} example:`, error);
        if (error instanceof Error && error.message) {
            if (error.message.includes("API key not valid") || error.message.includes("API_KEY_INVALID")) {
                throw new Error("Invalid API Key. Please check your API_KEY environment variable configuration.");
            }
            if (error.message.toLowerCase().includes("quota")) {
                throw new Error("API quota exceeded. Please try again later or check your Google Cloud console for quota limits.");
            }
        }
        throw new Error(`Failed to generate ${difficulty} example from AI. Please try again.`);
    }
};
