
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


export const analyzeCodeWithGemini = async (
    codeContent: string,
    language: SupportedLanguage
): Promise<AnalysisResult> => {
    if (!ai) {
        throw new Error("Gemini AI client is not initialized. Check API_KEY configuration.");
    }
    if (language === SupportedLanguage.UNKNOWN) {
        throw new Error("Cannot analyze code for an unknown language.");
    }

    const languageName = LanguageDisplayNames[language];

    const prompt = `
You are an expert programming tutor. Analyze the following ${languageName} code.
Provide your analysis in a JSON format with the following exact keys: "topicExplanation", "exampleCode", "exampleCodeOutput", "practiceQuestion", "instructions".

- "topicExplanation": A clear, concise explanation of the main programming concept demonstrated in the uploaded code. This should be a single paragraph.
- "exampleCode": A simple, self-contained ${languageName} code example illustrating the explained concept. This example must be different from the user's input code and should be ready to compile/run.
- "exampleCodeOutput": A string representing the exact, expected output if the "exampleCode" were executed. If the example code produces no visible output, this should be an empty string or a concise note like "[No direct output produced by this example]".
- "practiceQuestion": A programming question related to the explained concept that a learner can solve in ${languageName}.
- "instructions": Step-by-step instructions on how to approach and solve the practice question. Provide these as a multi-line string, with each step clearly articulated.

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
        
        return parseJsonFromAiResponse<AnalysisResult>(response.text, analysisResultFieldCheck);

    } catch (error) {
        console.error("Error calling Gemini API for code analysis:", error);
        if (error instanceof Error) {
             if (error.message.includes("API key not valid")) {
                throw new Error("Invalid API Key. Please check your configuration.");
            }
             if (error.message.includes("quota")) {
                throw new Error("API quota exceeded. Please try again later.");
            }
        }
        throw new Error("Failed to get analysis from AI. Please try again.");
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
