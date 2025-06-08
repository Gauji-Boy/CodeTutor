

export interface AnalysisResult {
    topicExplanation: string;
    exampleCode: string;
    exampleCodeOutput: string;
    practiceQuestion: string;
    instructions: string;
    exampleDifficulty?: ExampleDifficulty; // Optional: AI might specify or we set it based on request
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
    JAVASCRIPT = "javascript",
    TYPESCRIPT = "typescript",
    GO = "go",
    SWIFT = "swift",
    KOTLIN = "kotlin",
    PHP = "php",
    RUBY = "ruby",
    SCALA = "scala",
    CSHARP = "csharp",
    SHELL = "shell",
    LUA = "lua", // Added Lua
    UNKNOWN = "unknown"
}

export const LanguageExtensions: Record<string, SupportedLanguage> = {
    ".py": SupportedLanguage.PYTHON,
    ".cpp": SupportedLanguage.CPP,
    ".c": SupportedLanguage.C,
    ".java": SupportedLanguage.JAVA,
    ".rs": SupportedLanguage.RUST,
    ".js": SupportedLanguage.JAVASCRIPT,
    ".ts": SupportedLanguage.TYPESCRIPT,
    ".tsx": SupportedLanguage.TYPESCRIPT, // Also for TypeScript
    ".go": SupportedLanguage.GO,
    ".swift": SupportedLanguage.SWIFT,
    ".kt": SupportedLanguage.KOTLIN,
    ".kts": SupportedLanguage.KOTLIN, // Kotlin Script
    ".php": SupportedLanguage.PHP,
    ".rb": SupportedLanguage.RUBY,
    ".scala": SupportedLanguage.SCALA,
    ".sc": SupportedLanguage.SCALA, // Scala Script
    ".cs": SupportedLanguage.CSHARP,
    ".sh": SupportedLanguage.SHELL,
    ".bash": SupportedLanguage.SHELL, // Bash scripts
    ".lua": SupportedLanguage.LUA, // Added Lua
};

export const LanguageDisplayNames: Record<SupportedLanguage, string> = {
    [SupportedLanguage.PYTHON]: "Python",
    [SupportedLanguage.CPP]: "C++",
    [SupportedLanguage.C]: "C",
    [SupportedLanguage.JAVA]: "Java",
    [SupportedLanguage.RUST]: "Rust",
    [SupportedLanguage.JAVASCRIPT]: "JavaScript",
    [SupportedLanguage.TYPESCRIPT]: "TypeScript",
    [SupportedLanguage.GO]: "Go",
    [SupportedLanguage.SWIFT]: "Swift",
    [SupportedLanguage.KOTLIN]: "Kotlin",
    [SupportedLanguage.PHP]: "PHP",
    [SupportedLanguage.RUBY]: "Ruby",
    [SupportedLanguage.SCALA]: "Scala",
    [SupportedLanguage.CSHARP]: "C#",
    [SupportedLanguage.SHELL]: "Shell Script",
    [SupportedLanguage.LUA]: "Lua", // Added Lua
    [SupportedLanguage.UNKNOWN]: "Unknown Language"
};

export const AcceptedFileExtensions = Object.keys(LanguageExtensions).join(',');

export type ExampleDifficulty = 'easy' | 'intermediate' | 'hard';

export const ExampleDifficultyLevels: ExampleDifficulty[] = ['easy', 'intermediate', 'hard'];

export const ExampleDifficultyDisplayNames: Record<ExampleDifficulty, string> = {
    easy: 'Easy',
    intermediate: 'Intermediate',
    hard: 'Hard'
};

export interface ExampleCodeData {
    exampleCode: string;
    exampleCodeOutput: string;
}

// Settings
export interface GlobalSettings {
    preferredInitialDifficulty: ExampleDifficulty;
}