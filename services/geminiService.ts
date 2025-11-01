
import { GoogleGenAI } from "@google/genai";
import { AnalysisResult, SupportedLanguage, UserSolutionAnalysis } from '../types'; 
import { LanguageDisplayNames } from '../types';

const API_KEY = process.env.API_KEY;

let ai: GoogleGenAI | null = null;
if (API_KEY) {
  ai = new GoogleGenAI({ apiKey: API_KEY });
} else {
  console.error("API_KEY environment variable not found. Gemini API calls will fail.");
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
            throw new Error("Missing one or more required fields in AI response. Check console for details.");
        }
    } catch (e) {
        console.error("Failed to parse JSON response from AI:", e);
        console.error("Raw response text:", responseText);
        throw new Error(`AI returned an invalid response format. Raw: ${responseText.substring(0,200)}...`);
    }
};

const analysisResultFieldCheck = (parsed: any): parsed is AnalysisResult => {
    return typeof parsed.topicExplanation === 'string' &&
           typeof parsed.exampleCode === 'string' &&
           typeof parsed.exampleCodeOutput === 'string' &&
           typeof parsed.practiceQuestion === 'string' &&
           typeof parsed.instructions === 'string';
};

const userSolutionAnalysisFieldCheck = (parsed: any): parsed is UserSolutionAnalysis => {
    return typeof parsed.predictedOutput === 'string' &&
           typeof parsed.feedback === 'string';
    // isCorrect is optional, so not strictly checked here for presence
};


export const getTopicExplanation = async (
    codeContent: string,
    language: SupportedLanguage
): Promise<string> => {
    if (!ai) throw new Error("Gemini AI client not initialized.");
    if (language === SupportedLanguage.UNKNOWN) throw new Error("Cannot analyze code for an unknown language.");

    const languageName = LanguageDisplayNames[language];
    const prompt = `
You are an expert programming tutor. Analyze the following ${languageName} code and provide a clear, concise explanation of the main programming concept demonstrated.
Respond ONLY with the explanation string, without any additional formatting or surrounding text.

User's ${languageName} Code:
\`\`\`${language}
${codeContent}
\`\`\`
`;
    try {
        const response = await ai.models.generateContent({
            model: "gemini-2.5-flash",
            contents: prompt,
            config: { temperature: 0.3 }
        });
        return response.text;
    } catch (error) {
        console.error("Error getting topic explanation from Gemini:", error);
        throw new Error("Failed to get topic explanation from AI.");
    }
};

export const getExampleCode = async (
    topic: string,
    language: SupportedLanguage
): Promise<{ exampleCode: string; exampleCodeOutput: string }> => {
    if (!ai) throw new Error("Gemini AI client not initialized.");
    if (language === SupportedLanguage.UNKNOWN) throw new Error("Cannot get example for an unknown language.");

    const languageName = LanguageDisplayNames[language];
    const prompt = `
You are an expert programming tutor. Provide a simple, runnable code example for the concept: "${topic}" in ${languageName}.
Respond in a JSON format with keys "exampleCode" and "exampleCodeOutput".

- "exampleCode": A self-contained ${languageName} code example.
- "exampleCodeOutput": The exact expected output of the code.
`;
    try {
        const response = await ai.models.generateContent({
            model: "gemini-2.5-flash",
            contents: prompt,
            config: { responseMimeType: "application/json", temperature: 0.5 }
        });
        return parseJsonFromAiResponse(response.text, (p: any) =>
            typeof p.exampleCode === 'string' && typeof p.exampleCodeOutput === 'string'
        );
    } catch (error) {
        console.error("Error getting example code from Gemini:", error);
        throw new Error("Failed to get example code from AI.");
    }
};

export const getPractice = async (
    topic: string,
    language: SupportedLanguage
): Promise<{ practiceQuestion: string; instructions: string }> => {
    if (!ai) throw new Error("Gemini AI client not initialized.");
    if (language === SupportedLanguage.UNKNOWN) throw new Error("Cannot get practice for an unknown language.");

    const languageName = LanguageDisplayNames[language];
    const prompt = `
You are an expert programming tutor. Create a practice question for the concept: "${topic}" in ${languageName}.
Respond in a JSON format with keys "practiceQuestion" and "instructions".

- "practiceQuestion": A programming question for a learner.
- "instructions": Step-by-step instructions to solve the question.
`;
    try {
        const response = await ai.models.generateContent({
            model: "gemini-2.5-flash",
            contents: prompt,
            config: { responseMimeType: "application/json", temperature: 0.6 }
        });
        return parseJsonFromAiResponse(response.text, (p: any) =>
            typeof p.practiceQuestion === 'string' && typeof p.instructions === 'string'
        );
    } catch (error) {
        console.error("Error getting practice question from Gemini:", error);
        throw new Error("Failed to get practice question from AI.");
    }
};

export const analyzeCodeWithGemini = async (
    codeContent: string,
    language: SupportedLanguage
): Promise<AnalysisResult> => {
    const topicExplanation = await getTopicExplanation(codeContent, language);
    const [example, practice] = await Promise.all([
        getExampleCode(topicExplanation, language),
        getPractice(topicExplanation, language)
    ]);

    return {
        topicExplanation,
        exampleCode: example.exampleCode,
        exampleCodeOutput: example.exampleCodeOutput,
        practiceQuestion: practice.practiceQuestion,
        instructions: practice.instructions,
    };
};

export const detectLanguage = async (codeContent: string): Promise<SupportedLanguage> => {
    if (!ai) throw new Error("Gemini AI client not initialized.");

    const prompt = `
You are an expert programming language detector. Analyze the following code snippet and identify the programming language.
Respond ONLY with the single word for the language, from the following options: ${Object.values(SupportedLanguage).join(', ')}.

Code:
\`\`\`
${codeContent}
\`\`\`
`;
    try {
        const response = await ai.models.generateContent({
            model: "gemini-2.5-flash",
            contents: prompt,
            config: { temperature: 0.1 }
        });
        const lang = response.text.trim() as SupportedLanguage;
        if (Object.values(SupportedLanguage).includes(lang)) {
            return lang;
        }
        return SupportedLanguage.UNKNOWN;
    } catch (error) {
        console.error("Error detecting language from Gemini:", error);
        return SupportedLanguage.UNKNOWN;
    }
};

export const checkUserSolutionWithGemini = async (
    userCode: string,
    language: SupportedLanguage,
    practiceQuestion: string,
    topicExplanation: string 
): Promise<UserSolutionAnalysis> => {
    if (!ai) {
        throw new Error("Gemini AI client is not initialized. Check API_KEY configuration.");
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
            model: "gemini-2.5-flash", 
            contents: prompt,
            config: {
                responseMimeType: "application/json",
                temperature: 0.5, 
            }
        });

        return parseJsonFromAiResponse<UserSolutionAnalysis>(response.text, userSolutionAnalysisFieldCheck);

    } catch (error) {
        console.error("Error calling Gemini API for solution check:", error);
        if (error instanceof Error) {
            if (error.message.includes("API key not valid")) {
               throw new Error("Invalid API Key. Please check your configuration.");
           }
            if (error.message.includes("quota")) {
               throw new Error("API quota exceeded. Please try again later.");
           }
       }
        throw new Error("Failed to get feedback from AI for your solution. Please try again.");
    }
};

// Functions below are not exported and are used internally
async function analyzeConceptWithGemini(conceptText: string, conceptLanguage: SupportedLanguage, initialDifficultyForThisAnalysis: any, practiceDifficultyForThisAnalysis: any, requestConfig: any): Promise<AnalysisResult> {
    if (!ai) throw new Error("Gemini AI client not initialized.");
    // This is a mock implementation. Replace with your actual implementation.
    return {
        topicExplanation: "Explanation for " + conceptText,
        exampleCode: "Example code for " + conceptText,
        exampleCodeOutput: "Output for " + conceptText,
        practiceQuestion: "Practice question for " + conceptText,
        instructions: "Instructions for " + conceptText,
    };
}

async function debugCodeWithGemini(debugCodeText: string, param2: any, requestConfig: any): Promise<any> {
    if (!ai) throw new Error("Gemini AI client not initialized.");
    // This is a mock implementation. Replace with your actual implementation.
    return {
        summary: "Summary of debug",
        detectedLanguage: SupportedLanguage.PYTHON,
    };
}

async function analyzeProjectWithGemini(currentProjectFiles: any, currentProjectName: any, requestConfig: any): Promise<any> {
    if (!ai) throw new Error("Gemini AI client not initialized.");
    // This is a mock implementation. Replace with your actual implementation.
    return {
        overview: "Overview of project",
    };
}

async function extractCodeFromImageWithGemini(selectedImageFile: any, requestConfig: any): Promise<string> {
    if (!ai) throw new Error("Gemini AI client not initialized.");
    // This is a mock implementation. Replace with your actual implementation.
    return "Code from image";
}
