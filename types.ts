
export interface AnalysisResult {
    topicExplanation: string;
    exampleCode: string;
    exampleCodeOutput: string;
    practiceQuestion: string;
    instructions: string;
}

export interface UserSolutionAnalysis {
    predictedOutput: string;
    feedback: string;
    isCorrect?: boolean; // Optional: AI might determine correctness
}

export enum SupportedLanguage {
    PYTHON = "python",
    CPP = "cpp",
    C = "c",
    JAVA = "java",
    RUST = "rust",
    UNKNOWN = "unknown"
}

export const LanguageExtensions: Record<string, SupportedLanguage> = {
    ".py": SupportedLanguage.PYTHON,
    ".cpp": SupportedLanguage.CPP,
    ".c": SupportedLanguage.C,
    ".java": SupportedLanguage.JAVA,
    ".rs": SupportedLanguage.RUST,
};

export const LanguageDisplayNames: Record<SupportedLanguage, string> = {
    [SupportedLanguage.PYTHON]: "Python",
    [SupportedLanguage.CPP]: "C++",
    [SupportedLanguage.C]: "C",
    [SupportedLanguage.JAVA]: "Java",
    [SupportedLanguage.RUST]: "Rust",
    [SupportedLanguage.UNKNOWN]: "Unknown Language"
};

export const AcceptedFileExtensions = ".py,.cpp,.c,.java,.rs";