
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

    jsonStr = jsonStr.replace(/\\'/g, "'");

    try {
        const parsed = JSON.parse(jsonStr);
        if (fieldCheck(parsed)) {
            return parsed as T;
        } else {
            console.error("Missing fields in AI response or incorrect structure. Parsed object:", parsed);
            throw new Error(`AI response is missing required fields or has an incorrect structure. The AI might be unable to process the request as expected. Check console for the actual parsed object.`);
        }
    } catch (e) {
        console.error("Failed to parse JSON response from AI:", e);
        console.error("Raw response text (after preprocessing):", jsonStr);
        throw new Error(`AI returned an invalid response format. Please try again. Raw (excerpt): ${responseText.substring(0,200)}...`);
    }
};

const analysisResultFieldCheck = (parsed: any): parsed is AnalysisResult => {
    return typeof parsed.topicExplanation === 'string' &&
           typeof parsed.exampleCode === 'string' &&
           typeof parsed.exampleCodeOutput === 'string' &&
           typeof parsed.practiceQuestion === 'string' &&
           typeof parsed.instructions === 'string';
           // exampleDifficulty is added later, so not checked here
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

Provide your analysis in a JSON format with the following exact keys: "topicExplanation", "exampleCode", "exampleCodeOutput", "practiceQuestion", "instructions".

- "topicExplanation": A comprehensive and detailed explanation of THE MAIN PROGRAMMING CONCEPT(S) DEMONSTRATED IN THE USER'S UPLOADED CODE.
  Begin with a concise, high-level overview of the core programming concepts or topics utilized in the user's code.
  The primary focus of the explanation must then meticulously detail the user's code functionality, its structure, and its logic.
  Explicitly trace the execution flow of the user's code, step by step.
  Describe how data is transformed throughout the operation of the user's code.
  This explanation should be tailored to the user's code, easy for a learner to understand, cover key aspects, and can be multiple paragraphs if necessary to be thorough.
- "exampleCode": A '${initialDifficulty}' difficulty ${languageName} code example that clearly illustrates THE EXPLAINED CONCEPT (derived from user's code). This example must be different from the user's input code and should be ready to compile/run. ${difficultyGuidance} CRITICALLY IMPORTANT: The 'exampleCode' field MUST contain only pure, raw, runnable ${languageName} code, without any HTML, markdown, or other formatting/styling tags.
- "exampleCodeOutput": A string representing the exact, expected output if the "exampleCode" were executed. If no visible output, use "[No direct output produced by this example]".
- "practiceQuestion": A programming question related to THE EXPLAINED CONCEPT that a learner can solve in ${languageName}.
- "instructions": Step-by-step instructions on how to approach and solve the practiceQuestion.
  Provide these as a multi-line string, with each step clearly articulated.
  The number of steps and overall length of instructions should be proportional to the perceived complexity and length of the user's input code.
  For very short or simple user code (e.g., less than 10-15 lines, simple concept), 3-5 concise steps might be sufficient.
  For longer or more complex user code (e.g., 50+ lines, multiple interacting concepts), a more detailed breakdown with 5-10+ steps would be more helpful. Use your judgment to provide an appropriate level of detail.

User's ${languageName} Code:
\`\`\`${language}
${codeContent}
\`\`\`

Respond ONLY with the valid JSON object described above. Ensure the JSON is well-formed.
`;

    try {
        const response = await ai.models.generateContent({
            model: "gemini-2.5-flash-preview-04-17", contents: prompt,
            config: { responseMimeType: "application/json", temperature: 0.4 }
        });
        const parsedResult = parseJsonFromAiResponse<Omit<AnalysisResult, 'exampleDifficulty'>>(response.text, analysisResultFieldCheck);
        return { ...parsedResult, exampleDifficulty: initialDifficulty };
    } catch (error) {
        console.error("Error calling Gemini API for code analysis:", error);
        if (error instanceof Error && error.message) {
             if (error.message.includes("API key not valid") || error.message.includes("API_KEY_INVALID")) throw new Error("Invalid API Key. Check configuration.");
             if (error.message.toLowerCase().includes("quota")) throw new Error("API quota exceeded. Try again later.");
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

Provide your analysis in a JSON format with the following exact keys: "topicExplanation", "exampleCode", "exampleCodeOutput", "practiceQuestion", "instructions".

- "topicExplanation": A comprehensive and detailed explanation of THE USER'S PROVIDED PROGRAMMING CONCEPT ("${concept}") specifically within the context of the ${languageName} language.
  Begin with a concise, high-level overview of the core programming concepts or topics related to "${concept}".
  The primary focus of the explanation must then meticulously detail the concept's functionality, its typical structure or implementation patterns, and its underlying logic.
  Explicitly trace how a program utilizing this concept would typically execute or how the concept manifests in execution.
  Describe how data is typically transformed or managed when this concept is applied.
  This explanation should be thorough, cover key aspects, potential nuances, be easy for a learner to understand, and can be multiple paragraphs as needed.
- "exampleCode": A '${initialDifficulty}' difficulty ${languageName} code example that clearly illustrates the core idea of THE USER'S CONCEPT ("${concept}"). This example must be ready to compile/run. ${difficultyGuidance} CRITICALLY IMPORTANT: The 'exampleCode' field MUST contain only pure, raw, runnable ${languageName} code.
- "exampleCodeOutput": A string representing the exact, expected output if the "exampleCode" were executed. If no visible output, use "[No direct output produced by this example definition]".
- "practiceQuestion": A relevant programming question related to THE USER'S CONCEPT ("${concept}") that a learner can solve using ${languageName}.
- "instructions": Step-by-step instructions on how to approach and solve the "practiceQuestion".

Respond ONLY with the valid JSON object. Ensure the JSON is well-formed.
`;

    try {
        const response = await ai.models.generateContent({
            model: "gemini-2.5-flash-preview-04-17", contents: prompt,
            config: { responseMimeType: "application/json", temperature: 0.45 }
        });
        const parsedResult = parseJsonFromAiResponse<Omit<AnalysisResult, 'exampleDifficulty'>>(response.text, analysisResultFieldCheck);
        return { ...parsedResult, exampleDifficulty: initialDifficulty };
    } catch (error) {
        console.error("Error calling Gemini API for concept analysis:", error);
         if (error instanceof Error && error.message) {
             if (error.message.includes("API key not valid") || error.message.includes("API_KEY_INVALID")) throw new Error("Invalid API Key. Check configuration.");
             if (error.message.toLowerCase().includes("quota")) throw new Error("API quota exceeded. Try again later.");
        }
        throw new Error("Failed to get concept analysis from AI. Check network/API key, then try again.");
    }
};


export const checkUserSolutionWithGemini = async (
    userCode: string, 
    language: SupportedLanguage, 
    practiceQuestion: string, 
    topicExplanation: string,
    instructionsToSolve: string // New parameter
): Promise<UserSolutionAnalysis> => {
    if (!ai) throw new Error("Gemini AI client is not initialized. Ensure API_KEY is set.");
    if (language === SupportedLanguage.UNKNOWN) throw new Error("Cannot analyze solution for an unknown language.");

    const languageName = LanguageDisplayNames[language];
    const prompt = `
You are an expert programming tutor. The user is attempting to solve a practice question.
The programming language is ${languageName}.
The topic being practiced is: "${topicExplanation}"
The practice question was: "${practiceQuestion}"

The user was GIVEN THE FOLLOWING STEP-BY-STEP INSTRUCTIONS to solve this practice question:
--- INSTRUCTIONS START ---
${instructionsToSolve}
--- INSTRUCTIONS END ---

Here is the user's submitted code:
\`\`\`${language}
${userCode}
\`\`\`

Analyze the user's solution. Your primary task is to determine if the user's code CORRECTLY AND COMPLETELY IMPLEMENTS EACH of the provided step-by-step instructions.

Provide your analysis in a JSON format with the following exact keys: "predictedOutput", "feedback", and "isCorrect" (boolean).

- "predictedOutput": A string representing the exact, predicted output if the user's code were executed. If the code would produce no visible output or result in an error, state that clearly (e.g., "[No direct output]" or "[Error: Division by zero]").
- "isCorrect": A boolean value.
  - Set to true ONLY IF the user's code accurately and fully implements ALL of the step-by-step instructions provided above and correctly solves the problem as described by those instructions.
  - Set to false if the user's code deviates from the instructions, fails to implement any part of them, contains errors, or introduces logic not covered by the instructions that leads to an incorrect or incomplete solution relative to THE GIVEN INSTRUCTIONS.
- "feedback": Constructive feedback on the user's solution.
  - If "isCorrect" is true, elaborate on how the solution successfully follows the instructions and achieves the goal.
  - If "isCorrect" is false, your feedback should clearly explain WHICH instructions were not followed, or WHAT is incorrect or missing in relation to the given instructions. Be encouraging and suggest improvements.

Respond ONLY with the valid JSON object described above, without any additional explanations or surrounding text. Ensure the JSON is well-formed.
`;
    try {
        const response = await ai.models.generateContent({
            model: "gemini-2.5-flash-preview-04-17", contents: prompt,
            config: { responseMimeType: "application/json", temperature: 0.3 } // Lowered temperature for more deterministic instruction following check
        });
        return parseJsonFromAiResponse<UserSolutionAnalysis>(response.text, userSolutionAnalysisFieldCheck);
    } catch (error) {
        console.error("Error calling Gemini API for solution check:", error);
        if (error instanceof Error && error.message) {
            if (error.message.includes("API key not valid") || error.message.includes("API_KEY_INVALID")) throw new Error("Invalid API Key. Check configuration.");
            if (error.message.toLowerCase().includes("quota")) throw new Error("API quota exceeded. Try again later.");
       }
        throw new Error("Failed to get feedback for your solution. Check network/API key, then try again.");
    }
};

export const getExampleByDifficulty = async (
    topicExplanation: string, language: SupportedLanguage, difficulty: ExampleDifficulty
): Promise<ExampleCodeData> => {
    if (!ai) throw new Error("Gemini AI client is not initialized. Ensure API_KEY is set.");
    if (language === SupportedLanguage.UNKNOWN) throw new Error("Cannot generate example for an unknown language.");

    const languageName = LanguageDisplayNames[language];
    const difficultyGuidanceText = getDifficultyGuidance(languageName, difficulty);
    const prompt = `
You are an expert programming tutor.
Concept: "${topicExplanation}". Language: ${languageName}. Requested difficulty: "${difficulty}".
Guidance for "${difficulty}": ${difficultyGuidanceText}
Provide ONLY a JSON object with keys: "exampleCode", "exampleCodeOutput".
- "exampleCode": Self-contained ${languageName} code for "${topicExplanation}" at "${difficulty}" level. MUST be only pure, raw, runnable code.
- "exampleCodeOutput": Exact expected output. If none, use "[No direct output produced by this example]".
Respond ONLY with the valid JSON object.
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
        throw new Error(`Failed to generate ${difficulty} example from AI. Try again.`);
    }
};

export const askFollowUpQuestionWithGemini = async (
    userQuestion: string, currentExplanation: string, language: SupportedLanguage,
    originalInputContext: string, inputType: 'code' | 'concept'
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
- Your Previous Explanation (summarized or key points): "${currentExplanation.substring(0, 500)}..." 
  (The full explanation was: "${currentExplanation}")

User's Follow-up Question: "${userQuestion}"

Please answer the user's follow-up question directly, clearly, and comprehensively. 
Focus specifically on their question while keeping the provided context (original input, your prior explanation) in mind.
Your answer should be plain text, suitable for direct display. Do not use JSON.
Be concise but thorough. If the question is ambiguous, try to provide the most helpful interpretation.
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

export const getAdditionalExplanation = async (
    currentExplanation: string,
    language: SupportedLanguage,
    originalInputContext: string,
    inputType: 'code' | 'concept',
    elaborationLevel: number // New parameter: 1 for first elaboration, 2 for second etc.
): Promise<string> => {
    if (!ai) throw new Error("Gemini AI client is not initialized. Ensure API_KEY is set.");

    const languageName = LanguageDisplayNames[language] || "the specified language";
    const contextDescription = inputType === 'code' ? "their code submission" : "the concept they inquired about";

    let lengthGuidance = "";
    if (elaborationLevel === 1) {
        lengthGuidance = "Provide a concise additional explanation (e.g., 1-2 short paragraphs or a few key bullet points) to elaborate on the key points from the 'ORIGINAL EXPLANATION'. Focus on clarifying the most important aspects further.";
    } else if (elaborationLevel >= 2) {
        lengthGuidance = "Provide a more detailed and comprehensive additional explanation (e.g., 2-3 well-developed paragraphs). You can expand significantly upon the 'ORIGINAL EXPLANATION', delve deeper into nuances, or offer a small, distinct illustrative analogy if highly relevant. Avoid simply repeating information.";
    }

    const prompt = `
You are an expert programming tutor.
The user has received the following explanation about a topic related to ${contextDescription} in ${languageName}:

ORIGINAL EXPLANATION:
"""
${currentExplanation}
"""

ORIGINAL USER INPUT (${inputType}):
"""
${originalInputContext}
"""

The user wants a more detailed explanation. This is elaboration request number ${elaborationLevel}.
Instruction for this level of elaboration: ${lengthGuidance}

Please elaborate on the "ORIGINAL EXPLANATION", keeping the user's "ORIGINAL USER INPUT" in mind.
Focus on expanding and deepening the understanding of what was already stated.
Do not introduce entirely new topics that weren't hinted at.
Your response should be plain text, formatted for readability (e.g., paragraphs, bullet points if appropriate). Do NOT use JSON.
Keep the tone helpful and educational.
`;

    try {
        const response = await ai.models.generateContent({
            model: "gemini-2.5-flash-preview-04-17",
            contents: prompt,
            config: { temperature: 0.5 + (elaborationLevel * 0.05) } // Slightly increase temperature for more varied deeper elaborations
        });
        return response.text;
    } catch (error) {
        console.error("Error calling Gemini API for additional explanation:", error);
        if (error instanceof Error && error.message) {
            if (error.message.includes("API key not valid") || error.message.includes("API_KEY_INVALID")) throw new Error("Invalid API Key. Check configuration.");
            if (error.message.toLowerCase().includes("quota")) throw new Error("API quota exceeded. Try again later.");
        }
        throw new Error("Failed to get additional explanation from AI. Please try again.");
    }
};
