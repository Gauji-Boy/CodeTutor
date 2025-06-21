
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
    HTML = "html",
    CSS = "css",
    JSON = "json",
    MARKDOWN = "markdown",
    SHELL = "shell", // For bash/sh scripts
    LUA = "lua",
    UNKNOWN = "unknown"
}

export const LanguageExtensions: Record<string, SupportedLanguage> = {
    ".py": SupportedLanguage.PYTHON,
    ".pyw": SupportedLanguage.PYTHON,
    ".cpp": SupportedLanguage.CPP,
    ".hpp": SupportedLanguage.CPP,
    ".cxx": SupportedLanguage.CPP,
    ".hxx": SupportedLanguage.CPP,
    ".cc": SupportedLanguage.CPP,
    ".hh": SupportedLanguage.CPP,
    ".c": SupportedLanguage.C,
    ".h": SupportedLanguage.C,
    ".java": SupportedLanguage.JAVA,
    ".rs": SupportedLanguage.RUST,
    ".js": SupportedLanguage.JAVASCRIPT,
    ".jsx": SupportedLanguage.JAVASCRIPT, // Often used with React
    ".mjs": SupportedLanguage.JAVASCRIPT,
    ".ts": SupportedLanguage.TYPESCRIPT,
    ".tsx": SupportedLanguage.TYPESCRIPT, // Often used with React
    ".go": SupportedLanguage.GO,
    ".html": SupportedLanguage.HTML,
    ".htm": SupportedLanguage.HTML,
    ".css": SupportedLanguage.CSS,
    ".json": SupportedLanguage.JSON,
    ".md": SupportedLanguage.MARKDOWN,
    ".markdown": SupportedLanguage.MARKDOWN,
    ".sh": SupportedLanguage.SHELL,
    ".bash": SupportedLanguage.SHELL,
    ".zsh": SupportedLanguage.SHELL,
    ".lua": SupportedLanguage.LUA,
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
    [SupportedLanguage.HTML]: "HTML",
    [SupportedLanguage.CSS]: "CSS",
    [SupportedLanguage.JSON]: "JSON",
    [SupportedLanguage.MARKDOWN]: "Markdown",
    [SupportedLanguage.SHELL]: "Shell Script",
    [SupportedLanguage.LUA]: "Lua",
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

// Activity Log
export type ActivityType = 'file_analysis' | 'concept_explanation' | 'paste_analysis' | 'settings_update';

export interface ActivityItem {
    id: string;
    type: ActivityType;
    title: string; // e.g., "my_script.py", "Concept: Python Decorators", "Settings Changed"
    timestamp: Date;
    summary?: string; // e.g., "5 suggestions found", "Difficulty set to Hard"
    icon: string; // Material icon name
    colorClass: string; // Tailwind color class for icon
    language?: SupportedLanguage; // Optional: To track language for relevant activities
    
    // Fields for re-loading analysis:
    originalInput?: string; // The original code, concept text, or pasted code
    analysisResult?: AnalysisResult | null; // The actual result from Gemini
}