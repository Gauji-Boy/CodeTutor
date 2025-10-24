export interface BlockExplanation {
    codeBlock: string;
    explanation: string;
}

export interface LineByLineExplanation {
    code: string;
    explanation: string;
}

export interface VariableStateChange {
    variable: string;
    previousValue: any;
    currentValue: any;
}

export interface VisualFlowStep {
    lineNumber: number | null; 
    explanation: string;
    variablesState: Record<string, any>;
    stateChanges?: VariableStateChange[];
}

export interface TopicExplanationParts {
    coreConcepts: string;
    blockByBlockBreakdown: BlockExplanation[];
    lineByLineBreakdown: LineByLineExplanation[];
    executionFlowAndDataTransformation: string;
    visualExecutionFlow: VisualFlowStep[];
}

export interface PracticeMaterial {
    title: string;
    questionText: string;
    normalInstructionsLevel1: string[]; 
    lineByLineInstructions: string[]; 
    solutionCode: string;
    solutionOutput: string;
}

export interface PracticeContext {
    generatedQuestion: PracticeMaterial;
    userCodeAsPractice: PracticeMaterial;
}

export interface AnalysisResult {
    topicExplanation: TopicExplanationParts;
    exampleCode: string;
    exampleCodeOutput: string;
    practiceContext: PracticeContext; 
    detectedLanguage?: SupportedLanguage;
}

export type AssessmentStatus = 'correct' | 'partially_correct' | 'incorrect' | 'syntax_error' | 'unrelated';

export interface UserSolutionAnalysis {
    predictedOutput: string;
    feedback: string;
    isCorrect?: boolean; 
    assessmentStatus?: AssessmentStatus;
}

// New types for the Debug feature
export interface IdentifiedError {
    errorLine?: number;
    erroneousCode: string;
    errorType: 'Syntax' | 'Logic' | 'Best Practice' | 'Other';
    explanation: string;
    suggestedFix: string;
}

export interface DebugResult {
    summary: string;
    errorAnalysis: IdentifiedError[];
    correctedCode: string;
    detectedLanguage?: SupportedLanguage;
}

// Types for Project Analysis
export interface ProjectFile {
    path: string;
    content: string;
}

export interface DependencyAnalysis {
    name: string;
    description: string;
}

export interface DependencyInfo {
    modulePath: string;
    imports: string[];
    importedBy: string[];
    description: string;
}

export interface ProjectAnalysis {
    overview: string;
    fileBreakdown: {
        path: string;
        description: string;
    }[];
    // Optional fields for generated content
    dependencyAnalysis?: DependencyAnalysis[];
    dependencyInfo?: DependencyInfo[];
    readmeContent?: string;
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
    SHELL = "shell", 
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
    ".jsx": SupportedLanguage.JAVASCRIPT, 
    ".mjs": SupportedLanguage.JAVASCRIPT,
    ".ts": SupportedLanguage.TYPESCRIPT,
    ".tsx": SupportedLanguage.TYPESCRIPT, 
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
export interface TopicExplanationVisibility {
    masterToggle: boolean;
    coreConcepts: boolean;
    blockByBlock: boolean;
    lineByLine: boolean;
    executionFlow: boolean;
    followUp: boolean;
}

export interface GlobalSettings {
    preferredInitialDifficulty: ExampleDifficulty;
    isLeftPanelCollapsed?: boolean;
    preferredInstructionFormat: 'normal' | 'line-by-line';
    defaultPracticeDifficulty: ExampleDifficulty;
    visibleSections: {
        topicExplanation: TopicExplanationVisibility;
        exampleCode: boolean;
        practiceQuestion: boolean;
        instructionsToSolve: boolean;
    };
}

// Conversational Chat
export interface ChatMessage {
    role: 'user' | 'ai';
    content: string;
}

// Activity Log
export type ActivityType = 'file_analysis' | 'concept_explanation' | 'paste_analysis' | 'settings_update' | 'debug_analysis' | 'project_analysis';

export interface ActivityItem {
    id: string;
    type: ActivityType;
    title: string; 
    timestamp: Date;
    summary?: string; 
    icon: string; 
    colorClass: string; 
    language?: SupportedLanguage; 
    
    originalInput?: string; 
    analysisResult?: AnalysisResult | null; 
    debugResult?: DebugResult | null;
    analysisDifficulty?: ExampleDifficulty; 
    
    // Fields for project analysis
    projectFiles?: ProjectFile[] | null;
    projectAnalysis?: ProjectAnalysis | null;
    projectChatHistory?: ChatMessage[] | null;
}