import React, { useState, useCallback, useEffect, useRef, useMemo } from 'react';
import Editor from 'react-simple-code-editor';
declare var Prism: any; 

import { 
    AnalysisResult, 
    UserSolutionAnalysis, 
    SupportedLanguage,
    ExampleDifficulty,
    ExampleDifficultyLevels,
    ExampleDifficultyDisplayNames,
    LineByLineExplanation,
    AssessmentStatus,
    PracticeMaterial,
    BlockExplanation,
    ChatMessage,
    CoreConceptsExplanation,
    ExampleCodeData
} from '../types'; 
import { LanguageDisplayNames } from '../types'; 
import { useGlobalSettings } from '../hooks/useGlobalSettings';
import { TerminalOutput } from './TerminalOutput';
import { 
    checkUserSolutionWithGemini, 
    getExampleByDifficulty,
    askFollowUpQuestionWithGemini,
    getMoreInstructionsFromGemini,
    getPracticeQuestionByDifficulty,
    executeCodeWithGemini,
    GeminiRequestConfig
} from '../services/geminiService'; 
import { ErrorMessage } from './ErrorMessage'; 
import { CodeBlock, getPrismLanguageString } from './CodeBlock'; 
import { escapeHtml } from '../utils/textUtils'; 
import { FullScreenChatModal } from './FullScreenChatModal';
import { VisualFlowPlayer } from './VisualFlowPlayer';

const SectionLoadingSpinner: React.FC<{ text: string }> = ({ text }) => (
    <div className="flex flex-col justify-center items-center py-6 text-center w-full bg-[var(--bg-tertiary)]/50 rounded-lg border border-[var(--border-color)]">
        <div className="w-5 h-5 border-2 border-[var(--accent-primary)] border-t-transparent rounded-full animate-spin mb-2"></div>
        <p className="text-[var(--text-secondary)] text-xs font-medium">{text}</p>
    </div>
);

// Reworked Editable Example Code Section Component
interface EditableExampleCodeSectionProps {
    initialCode: string | undefined;
    initialOutput: string | undefined;
    language: SupportedLanguage;
    geminiConfig: GeminiRequestConfig;
}

const EditableExampleCodeSection: React.FC<EditableExampleCodeSectionProps> = React.memo(({ initialCode, initialOutput, language, geminiConfig }) => {
    const [code, setCode] = useState(initialCode || '');
    const [isExecuting, setIsExecuting] = useState(false);
    const [executionResult, setExecutionResult] = useState<string | null>(null);
    const [executionError, setExecutionError] = useState<string | null>(null);
    // State to trigger re-render when a language grammar is loaded by Prism's autoloader.
    const [highlightingKey, setHighlightingKey] = useState(0);

    const prismLanguageForEditor = getPrismLanguageString(language);
    
    useEffect(() => {
        setCode(initialCode || '');
        setExecutionResult(null);
        setExecutionError(null);
    }, [initialCode]);

    // This effect ensures that Prism's language grammar is loaded for the current language.
    // When the grammar loads, it increments a key, forcing the component to re-render
    // and the Editor component to re-apply syntax highlighting.
    useEffect(() => {
        if (typeof Prism === 'undefined' || !Prism.plugins?.autoloader) {
            return;
        }
        if (Prism.languages[prismLanguageForEditor]) {
            // Language is already available, no need to load.
            return;
        }
        Prism.plugins.autoloader.loadLanguages(prismLanguageForEditor, () => {
            // Force a re-render by updating state after the language is loaded.
            setHighlightingKey(prevKey => prevKey + 1);
        });
    }, [prismLanguageForEditor]);


    const handleRunCode = useCallback(async () => {
        if (!code) return;
        setIsExecuting(true);
        setExecutionResult(null);
        setExecutionError(null);
        try {
            if (!language || language === SupportedLanguage.UNKNOWN) {
                throw new Error("Language not identified, cannot execute code.");
            }
            const output = await executeCodeWithGemini(code, language, geminiConfig);
            setExecutionResult(output);
        } catch (err) {
            const msg = err instanceof Error ? err.message : "An unknown error occurred during execution.";
            setExecutionError(msg);
            console.error(err);
        } finally {
            setIsExecuting(false);
        }
    }, [code, language, geminiConfig]);

    const handleResetCode = useCallback(() => {
        setCode(initialCode || '');
        setExecutionResult(null);
        setExecutionError(null);
    }, [initialCode]);

    const robustHighlight = (codeToHighlight: string) => {
        // Now we check if the language grammar is loaded before attempting to highlight.
        if (typeof Prism !== 'undefined' && Prism.highlight && codeToHighlight && Prism.languages[prismLanguageForEditor]) {
            try {
                return Prism.highlight(codeToHighlight, Prism.languages[prismLanguageForEditor], prismLanguageForEditor);
            } catch (e) {
                console.warn(`Error highlighting with ${prismLanguageForEditor}:`, e);
            }
        }
        // Fallback to simple HTML escaping if Prism isn't ready or fails.
        return escapeHtml(codeToHighlight || '');
    };

    return (
        <>
            <div className="bg-[var(--bg-primary)]/60 border border-[var(--border-color)] rounded-md focus-within:ring-1 focus-within:ring-[var(--accent-primary)] focus-within:border-[var(--accent-primary)] shadow-sm flex flex-col max-h-[320px]">
                <div className="flex-grow overflow-y-auto custom-scrollbar-small">
                    <Editor
                        value={code}
                        onValueChange={newCode => setCode(newCode)}
                        highlight={robustHighlight}
                        padding={12}
                        textareaClassName="code-editor-textarea !text-[var(--text-primary)] !font-fira-code"
                        preClassName="code-editor-pre !font-fira-code"
                        className="text-xs"
                        disabled={isExecuting}
                        placeholder={`// Editable ${LanguageDisplayNames[language || SupportedLanguage.UNKNOWN]} example code...`}
                        aria-label="Editable example code area"
                    />
                </div>
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
                <button
                    type="button"
                    onClick={handleRunCode}
                    disabled={isExecuting}
                    className="bg-green-600 hover:bg-green-700 text-white font-medium py-1.5 px-3 rounded-md flex items-center gap-1.5 transition-colors text-xs shadow focus:outline-none focus:ring-2 focus:ring-green-500 ring-offset-1 ring-offset-[var(--bg-secondary)] disabled:bg-[var(--bg-tertiary)] disabled:text-[var(--text-muted)] disabled:cursor-not-allowed"
                >
                    {isExecuting ? (
                        <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                    ) : (
                        <span className="material-icons-outlined text-sm">play_arrow</span>
                    )}
                    <span>{isExecuting ? 'Running...' : 'Run Code'}</span>
                </button>
                <button
                    type="button"
                    onClick={handleResetCode}
                    disabled={isExecuting || code === initialCode}
                    className="bg-[var(--bg-tertiary)] hover:bg-[var(--border-color)] text-white font-medium py-1.5 px-3 rounded-md flex items-center gap-1 transition-colors text-xs shadow focus:outline-none focus:ring-1 focus:ring-[var(--accent-primary)] ring-offset-1 ring-offset-[var(--bg-secondary)] disabled:opacity-60 disabled:cursor-not-allowed"
                >
                    <span className="material-icons-outlined text-sm">restart_alt</span>
                    Reset
                </button>
            </div>

            {executionError && <ErrorMessage message={executionError} />}
            
            {executionResult !== null && !executionError && (
                <TerminalOutput output={executionResult} title="Live Execution Output" />
            )}
            {executionResult === null && !executionError && (
                <TerminalOutput output={initialOutput} title="Original Expected Output" />
            )}
        </>
    );
});

interface CollapsibleSectionProps {
    title: string;
    content: string;
    isExpandedInitially?: boolean;
    iconName?: string;
}

const CollapsibleSectionComponent: React.FC<CollapsibleSectionProps> = ({ title, content, isExpandedInitially = false, iconName = "info" }) => {
    const [isExpanded, setIsExpanded] = useState(isExpandedInitially);

    const toggleExpansion = () => setIsExpanded(!isExpanded);

    const renderFormattedContent = (text: string) => {
      // Check for N/A or empty content first
      if (!text || text.trim().toLowerCase() === "n/a" || text.trim().toLowerCase() === "not applicable") {
        return <p className="text-sm text-[var(--text-muted)] italic">This section is not applicable for the current analysis or was not provided.</p>;
      }
      // Apply basic markdown-like formatting for bold and italics, then split into paragraphs
      return text
        .split('\n') // Split by newline first to get "paragraphs"
        .map(line => line.trim()) // Trim each line
        .filter(line => line.length > 0) // Remove empty lines
        .map((paragraph, index) => (
            <p key={index} 
               dangerouslySetInnerHTML={{ 
                   __html: paragraph
                    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>') // Bold: **text**
                    .replace(/\*(.*?)\*/g, '<em>$1</em>')       // Italics: *text*
               }}>
            </p>
        ));
    };
    
    return (
        <div className="py-2">
            <button
                type="button"
                onClick={toggleExpansion}
                className="w-full flex justify-between items-center text-left text-sm font-medium text-[var(--text-primary)] hover:text-[var(--accent-primary)] p-2 rounded-md hover:bg-[var(--bg-tertiary)]/80 focus:outline-none focus:ring-1 focus:ring-[var(--accent-primary)] focus:ring-offset-1 focus:ring-offset-[var(--bg-secondary)] transition-colors"
                aria-expanded={isExpanded}
                aria-controls={`collapsible-content-${title.replace(/\s+/g, '-').toLowerCase()}`}
            >
                <span className="flex items-center">
                    <span className="material-icons-outlined text-[var(--accent-primary)] mr-2 text-base">{iconName}</span>
                    {title}
                </span>
                <span className={`material-icons-outlined text-lg transform transition-transform duration-200 ${isExpanded ? 'rotate-180' : 'rotate-0'}`}>
                    expand_more
                </span>
            </button>
            <div 
                id={`collapsible-content-${title.replace(/\s+/g, '-').toLowerCase()}`}
                className={`transition-all duration-300 ease-in-out overflow-x-hidden overflow-y-auto custom-scrollbar-small ${isExpanded ? 'max-h-64 opacity-100' : 'max-h-0 opacity-50'}`}
                style={{ transitionProperty: 'max-height, opacity' }}
            >
                <div className="py-3 pl-4 pr-2 border-l-2 border-[var(--border-color)]">
                     <div className="text-sm text-[var(--text-secondary)] leading-relaxed prose prose-sm prose-invert max-w-none">
                        {renderFormattedContent(content)}
                    </div>
                </div>
            </div>
        </div>
    );
};
const CollapsibleSection = React.memo(CollapsibleSectionComponent);


const renderInstructionSteps = (steps: string[]) => {
    if (!steps || steps.length === 0) {
        return <p className="text-sm text-[var(--text-muted)] italic">No instructions provided for this level, or this level is not applicable.</p>;
    }
    return (
        <ul className="list-none text-sm text-[var(--text-secondary)] space-y-2 leading-relaxed">
            {steps.map((step, index) => {
                // Remove common list prefixes if AI includes them
                const trimmedStep = step.trim().replace(/^(\d+\.|-|\*|\u2022|Step\s*\d*:)\s*/i, '');
                if (trimmedStep) return (
                    <li key={`instruction-step-${index}`} className="flex items-start pl-1">
                        <span className="material-icons-outlined text-[var(--accent-primary)] text-base mr-2.5 mt-px flex-shrink-0">chevron_right</span>
                        <span>{trimmedStep}</span>
                    </li>
                );
                return null; // Skip empty or only prefix lines
            })}
        </ul>
    );
};

interface ResultDisplayProps {
    result: AnalysisResult;
    language: SupportedLanguage; 
    difficultyOfProvidedExample: ExampleDifficulty;
    initialPracticeDifficulty: ExampleDifficulty;
    originalInputContext: string; // The original code or concept string
    originalInputType: 'code' | 'concept';
    geminiConfig: GeminiRequestConfig;
}

const CoreConceptsSection: React.FC<{ data: CoreConceptsExplanation }> = ({ data }) => {
    const [isExpanded, setIsExpanded] = useState(false); // Collapsed by default

    if (!data) {
        return <CollapsibleSection title="Core Concepts Explained" content="N/A" iconName="lightbulb" />;
    }

    const renderMarkdown = (text: string) => {
        if (!text) return { __html: '' };
        return { __html: text.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>').replace(/\*(.*?)\*/g, '<em>$1</em>') };
    };

    return (
        <div className="py-2">
            <button
                type="button"
                onClick={() => setIsExpanded(!isExpanded)}
                className="w-full flex justify-between items-center text-left text-sm font-medium text-[var(--text-primary)] hover:text-[var(--accent-primary)] p-2 rounded-md hover:bg-[var(--bg-tertiary)]/80 focus:outline-none focus:ring-1 focus:ring-[var(--accent-primary)] focus:ring-offset-1 focus:ring-offset-[var(--bg-secondary)] transition-colors"
                aria-expanded={isExpanded}
                aria-controls="core-concepts-content"
            >
                <span className="flex items-center">
                    <span className="material-icons-outlined text-[var(--accent-primary)] mr-2 text-base">lightbulb</span>
                    Core Concepts: {data.title}
                </span>
                <span className={`material-icons-outlined text-lg transform transition-transform duration-200 ${isExpanded ? 'rotate-180' : 'rotate-0'}`}>
                    expand_more
                </span>
            </button>
            <div
                id="core-concepts-content"
                className={`transition-all duration-300 ease-in-out overflow-hidden ${isExpanded ? 'max-h-[60rem] opacity-100' : 'max-h-0 opacity-50'}`} // Increased max-h
                style={{ transitionProperty: 'max-height, opacity' }}
            >
                <div className="py-3 pl-4 pr-2 border-l-2 border-[var(--border-color)]">
                    <div className="prose prose-sm prose-invert max-w-none">
                        <p className="text-[var(--text-secondary)]" dangerouslySetInnerHTML={renderMarkdown(data.explanation)}></p>
                        <div className="space-y-4 mt-4">
                            {data.concepts.map((concept, index) => (
                                <div key={index}>
                                    <h5 className="font-semibold text-sm text-[var(--text-primary)] not-prose" dangerouslySetInnerHTML={renderMarkdown(concept.name)}></h5>
                                    <p dangerouslySetInnerHTML={renderMarkdown(concept.description)}></p>
                                    {concept.points && (
                                        <ul className="list-disc pl-5 mt-2 space-y-1">
                                            {concept.points.map((point, pIndex) => (
                                                <li key={pIndex} dangerouslySetInnerHTML={renderMarkdown(point)}></li>
                                            ))}
                                        </ul>
                                    )}
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};


const BlockByBlockBreakdownSection: React.FC<{ breakdown: BlockExplanation[], language: SupportedLanguage }> = ({ breakdown, language }) => {
    const [isExpanded, setIsExpanded] = useState(false);

    if (!breakdown || breakdown.length === 0) {
        return (
            <CollapsibleSection
                title="Block-by-Block Code Explanation"
                content="N/A"
                isExpandedInitially={false}
                iconName="view_quilt"
            />
        );
    }
    
    return (
        <div className="py-2">
            <button
                type="button"
                onClick={() => setIsExpanded(!isExpanded)}
                className="w-full flex justify-between items-center text-left text-sm font-medium text-[var(--text-primary)] hover:text-[var(--accent-primary)] p-2 rounded-md hover:bg-[var(--bg-tertiary)]/80 focus:outline-none focus:ring-1 focus:ring-[var(--accent-primary)] focus:ring-offset-1 focus:ring-offset-[var(--bg-secondary)] transition-colors"
                aria-expanded={isExpanded}
                aria-controls="block-by-block-breakdown-content"
            >
                <span className="flex items-center">
                    <span className="material-icons-outlined text-[var(--accent-primary)] mr-2 text-base">view_quilt</span>
                    Block-by-Block Code Explanation
                </span>
                <span className={`material-icons-outlined text-lg transform transition-transform duration-200 ${isExpanded ? 'rotate-180' : 'rotate-0'}`}>
                    expand_more
                </span>
            </button>
            <div
                id="block-by-block-breakdown-content"
                className={`transition-all duration-300 ease-in-out overflow-x-hidden overflow-y-auto custom-scrollbar-small ${isExpanded ? 'max-h-80 opacity-100' : 'max-h-0 opacity-50'}`}
                style={{ transitionProperty: 'max-height, opacity' }}
            >
                <div className="py-3 pl-4 pr-2 border-l-2 border-[var(--border-color)]">
                    {breakdown.map((item, index) => (
                        <div key={`bbb-${index}`} className="py-3 border-b border-[var(--border-color)]/50 last:border-b-0">
                            <CodeBlock code={item.codeBlock.trim()} language={language} idSuffix={`bbb-${index}`} />
                            <p className="mt-2 text-sm text-[var(--text-secondary)]/90 leading-relaxed">{item.explanation}</p>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
};

const LineByLineBreakdownSection: React.FC<{ breakdown: LineByLineExplanation[], language: SupportedLanguage }> = ({ breakdown, language }) => {
    const [isExpanded, setIsExpanded] = useState(false);

    if (!breakdown || breakdown.length === 0) {
        return (
            <CollapsibleSection
                title="Line-by-Line Code Breakdown"
                content="N/A"
                isExpandedInitially={false}
                iconName="segment"
            />
        );
    }
    
    return (
        <div className="py-2">
            <button
                type="button"
                onClick={() => setIsExpanded(!isExpanded)}
                className="w-full flex justify-between items-center text-left text-sm font-medium text-[var(--text-primary)] hover:text-[var(--accent-primary)] p-2 rounded-md hover:bg-[var(--bg-tertiary)]/80 focus:outline-none focus:ring-1 focus:ring-[var(--accent-primary)] focus:ring-offset-1 focus:ring-offset-[var(--bg-secondary)] transition-colors"
                aria-expanded={isExpanded}
                aria-controls="line-by-line-breakdown-content"
            >
                <span className="flex items-center">
                    <span className="material-icons-outlined text-[var(--accent-primary)] mr-2 text-base">segment</span>
                    Line-by-Line Code Breakdown
                </span>
                <span className={`material-icons-outlined text-lg transform transition-transform duration-200 ${isExpanded ? 'rotate-180' : 'rotate-0'}`}>
                    expand_more
                </span>
            </button>
            <div
                id="line-by-line-breakdown-content"
                className={`transition-all duration-300 ease-in-out overflow-x-hidden overflow-y-auto custom-scrollbar-small ${isExpanded ? 'max-h-80 opacity-100' : 'max-h-0 opacity-50'}`}
                style={{ transitionProperty: 'max-height, opacity' }}
            >
                <div className="py-3 pl-4 pr-2 border-l-2 border-[var(--border-color)]">
                    {breakdown.map((item, index) => (
                        <div key={`lbl-${index}`} className="py-3 border-b border-[var(--border-color)]/50 last:border-b-0">
                            <CodeBlock code={item.code.trim()} language={language} idSuffix={`lbl-${index}`} />
                            <p className="mt-2 text-sm text-[var(--text-secondary)]/90 leading-relaxed">{item.explanation}</p>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
};

const FinalOutputDisplay: React.FC<{ output: string }> = ({ output }) => {
    if (!output.trim()) {
        return (
             <div className="bg-[var(--bg-primary)] p-2 rounded-md border border-[var(--border-color)]">
                <div className="text-xs text-[var(--text-muted)] italic text-center py-2">No output is produced by this code.</div>
            </div>
        );
    }
    return (
         <div className="bg-[var(--bg-primary)] rounded-md border border-[var(--border-color)] overflow-hidden">
            <pre className="text-xs font-fira-code text-gray-300 whitespace-pre-wrap break-words p-2 max-h-40 overflow-y-auto custom-scrollbar-small">
                {output}
            </pre>
        </div>
    );
};


const ResultDisplayComponent: React.FC<ResultDisplayProps> = ({ 
    result, 
    language, 
    difficultyOfProvidedExample,
    initialPracticeDifficulty,
    originalInputContext,
    originalInputType,
    geminiConfig
}) => {
    const { preferredInstructionFormat, visibleSections } = useGlobalSettings();

    // Example Code states
    const [exampleCache, setExampleCache] = useState<Partial<Record<ExampleDifficulty, ExampleCodeData>>>({
        [difficultyOfProvidedExample]: {
            exampleCode: result.exampleCode || '',
            exampleCodeOutput: result.exampleCodeOutput || '',
        }
    });
    const [selectedExampleDifficulty, setSelectedExampleDifficulty] = useState<ExampleDifficulty>(difficultyOfProvidedExample);
    const [isExampleLoading, setIsExampleLoading] = useState<boolean>(false);
    const [loadingDifficulty, setLoadingDifficulty] = useState<ExampleDifficulty | null>(null);
    const [exampleError, setExampleError] = useState<string | null>(null);
    
    // Practice Section states
    const [practiceMode, setPracticeMode] = useState<'generated' | 'userCode'>('generated');
    const [generatedPracticeMaterial, setGeneratedPracticeMaterial] = useState<PracticeMaterial | undefined>(result.practiceContext?.generatedQuestion);
    const [selectedPracticeDifficulty, setSelectedPracticeDifficulty] = useState<ExampleDifficulty>(initialPracticeDifficulty);
    const [isPracticeQuestionLoading, setIsPracticeQuestionLoading] = useState<boolean>(false);
    const [loadingPracticeDifficulty, setLoadingPracticeDifficulty] = useState<ExampleDifficulty | null>(null);
    const [practiceQuestionError, setPracticeQuestionError] = useState<string | null>(null);
    
    // User Solution states
    const [practiceSolution, setPracticeSolution] = useState(''); // User's code for practice question
    const [userSolutionAnalysis, setUserSolutionAnalysis] = useState<UserSolutionAnalysis | null>(null);
    const [actualSolutionOutput, setActualSolutionOutput] = useState<string | null>(null);
    const [isCheckingSolution, setIsCheckingSolution] = useState<boolean>(false);
    const [solutionError, setSolutionError] = useState<string | null>(null);
    const solutionFeedbackRef = useRef<HTMLDivElement>(null);
    
    // Conversational Chat states
    const [chatHistory, setChatHistory] = useState<ChatMessage[]>([]);
    const [userMessage, setUserMessage] = useState('');
    const [isChatLoading, setIsChatLoading] = useState(false);
    const [chatError, setChatError] = useState<string | null>(null);
    const [isChatExpanded, setIsChatExpanded] = useState(false); // Collapsed by default
    const [isFullScreenChatOpen, setIsFullScreenChatOpen] = useState(false);
    const chatContainerRef = useRef<HTMLDivElement>(null);
    const chatInputRef = useRef<HTMLTextAreaElement>(null);


    // Instruction states
    const [instructionFormat, setInstructionFormat] = useState<'normal' | 'line-by-line'>(preferredInstructionFormat);
    const [displayedInstructions, setDisplayedInstructions] = useState<string[]>([]);
    const [currentInstructionLevel, setCurrentInstructionLevel] = useState<number>(1);
    const [isLoadingInstructions, setIsLoadingInstructions] = useState<boolean>(false);
    const [hasMoreInstructions, setHasMoreInstructions] = useState<boolean>(true);

    // State for showing AI's solution to practice question
    const [showSolution, setShowSolution] = useState<boolean>(false);
    const [isFinalOutputVisible, setIsFinalOutputVisible] = useState(true);

    const { coreConcepts, blockByBlockBreakdown, lineByLineBreakdown, executionFlowAndDataTransformation, visualExecutionFlow } = result.topicExplanation || {};
    const userCodePracticeMaterial = result.practiceContext?.userCodeAsPractice;
    const activePracticeMaterial = practiceMode === 'generated' ? generatedPracticeMaterial : userCodePracticeMaterial;

    // Effect to auto-resize chat textarea
    useEffect(() => {
        const textarea = chatInputRef.current;
        if (textarea) {
            // Temporarily reset height to calculate the scroll height correctly.
            textarea.style.height = 'auto';
            textarea.style.height = `${textarea.scrollHeight}px`;
        }
    }, [userMessage]);

    // Effect runs only when the parent 'result' prop (a full new analysis) changes.
    useEffect(() => {
        // Reset example code section
        setExampleCache({
            [difficultyOfProvidedExample]: {
                exampleCode: result.exampleCode || '',
                exampleCodeOutput: result.exampleCodeOutput || ''
            }
        });
        setSelectedExampleDifficulty(difficultyOfProvidedExample);
        setIsExampleLoading(false);
        setExampleError(null);
        
        // Reset practice question section to the initial one from the new analysis
        setPracticeMode('generated');
        setGeneratedPracticeMaterial(result.practiceContext?.generatedQuestion);
        setSelectedPracticeDifficulty(initialPracticeDifficulty);
        setIsPracticeQuestionLoading(false);
        setPracticeQuestionError(null);

        // Reset conversational chat section
        setChatHistory([]);
        setUserMessage('');
        setIsChatLoading(false);
        setChatError(null);
        setIsChatExpanded(false); // Collapse on new analysis
        setIsFullScreenChatOpen(false);
    }, [result, difficultyOfProvidedExample, initialPracticeDifficulty]);

     // This effect runs whenever the active practice material changes (due to mode switch or new generated question).
    // It resets all dependent state for that section.
    useEffect(() => {
        if (!activePracticeMaterial) return;

        setPracticeSolution('');
        setUserSolutionAnalysis(null);
        setActualSolutionOutput(null);
        setSolutionError(null);
        setShowSolution(false);
        setInstructionFormat(preferredInstructionFormat);

        if (activePracticeMaterial.normalInstructionsLevel1) {
            setDisplayedInstructions(activePracticeMaterial.normalInstructionsLevel1.filter(line => line.trim() !== ''));
        } else {
            setDisplayedInstructions([]);
        }
        setCurrentInstructionLevel(1);
        setHasMoreInstructions(true); // Assume more instructions are available initially
        setIsLoadingInstructions(false);
    }, [activePracticeMaterial, preferredInstructionFormat]);

    useEffect(() => {
        if ((userSolutionAnalysis || actualSolutionOutput) && solutionFeedbackRef.current) {
            setTimeout(() => {
                solutionFeedbackRef.current?.scrollIntoView({
                    behavior: 'smooth',
                    block: 'nearest',
                });
            }, 100); // A small delay ensures the DOM is updated before scrolling
        }
    }, [userSolutionAnalysis, actualSolutionOutput]);

    // Auto-scroll chat window
    useEffect(() => {
        if (chatContainerRef.current) {
            chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
        }
    }, [chatHistory, isChatLoading]);

    const handleDifficultyChange = useCallback(async (newDifficulty: ExampleDifficulty) => {
        if (newDifficulty === selectedExampleDifficulty && !exampleError) {
            return;
        }
        setSelectedExampleDifficulty(newDifficulty);

        if (exampleCache[newDifficulty] || isExampleLoading) {
            setExampleError(null);
            return;
        }

        setIsExampleLoading(true);
        setLoadingDifficulty(newDifficulty);
        setExampleError(null);

        try {
            if (!language || language === SupportedLanguage.UNKNOWN || !coreConcepts) throw new Error("Language or topic not set for example generation.");
            const exampleData = await getExampleByDifficulty(coreConcepts.title, language, newDifficulty, geminiConfig);
            setExampleCache(prevCache => ({ ...prevCache, [newDifficulty]: exampleData }));
        } catch (err) {
            const errorMsg = err instanceof Error ? err.message : "Failed to get the example from AI.";
            setExampleError(errorMsg); console.error(err);
        } finally {
            setIsExampleLoading(false);
            setLoadingDifficulty(null);
        }
    }, [selectedExampleDifficulty, isExampleLoading, language, coreConcepts, exampleCache, geminiConfig, exampleError]);
    
    const handleGenerateNewExample = useCallback(async () => {
        if (isExampleLoading) return;
    
        setIsExampleLoading(true);
        setLoadingDifficulty(selectedExampleDifficulty); // Indicate loading for the current level
        setExampleError(null);
    
        try {
            if (!language || language === SupportedLanguage.UNKNOWN || !coreConcepts) {
                throw new Error("Language or topic not set for new example generation.");
            }
            const newExampleData = await getExampleByDifficulty(
                coreConcepts.title,
                language,
                selectedExampleDifficulty,
                geminiConfig
            );
            setExampleCache(prevCache => ({
                ...prevCache,
                [selectedExampleDifficulty]: newExampleData
            }));
        } catch (err) {
            const errorMsg = err instanceof Error ? err.message : "Failed to generate a new example.";
            setExampleError(errorMsg);
            console.error(err);
        } finally {
            setIsExampleLoading(false);
            setLoadingDifficulty(null);
        }
    }, [isExampleLoading, selectedExampleDifficulty, language, coreConcepts, geminiConfig]);

    const handlePracticeDifficultyChange = useCallback(async (newDifficulty: ExampleDifficulty) => {
        if (newDifficulty === selectedPracticeDifficulty || isPracticeQuestionLoading) return;
    
        setIsPracticeQuestionLoading(true);
        setLoadingPracticeDifficulty(newDifficulty);
        setPracticeQuestionError(null);
    
        try {
            if (!language || language === SupportedLanguage.UNKNOWN || !coreConcepts) {
                throw new Error("Language or topic not set for practice question generation.");
            }
    
            const newPracticeMaterial = await getPracticeQuestionByDifficulty(
                coreConcepts.title,
                language,
                newDifficulty,
                geminiConfig
            );
    
            setGeneratedPracticeMaterial(newPracticeMaterial);
            setSelectedPracticeDifficulty(newDifficulty);
    
        } catch (err) {
            const errorMsg = err instanceof Error ? err.message : "Failed to get the practice question from AI.";
            setPracticeQuestionError(errorMsg);
            console.error(err);
        } finally {
            setIsPracticeQuestionLoading(false);
            setLoadingPracticeDifficulty(null);
        }
    }, [selectedPracticeDifficulty, isPracticeQuestionLoading, language, coreConcepts, geminiConfig]);

    const handleCheckSolution = useCallback(async () => {
        if (!practiceSolution.trim()) {
            setSolutionError("Please enter your solution code before checking.");
            setUserSolutionAnalysis(null);
            setActualSolutionOutput(null);
            return;
        }
        setIsCheckingSolution(true);
        setSolutionError(null);
        setUserSolutionAnalysis(null);
        setActualSolutionOutput(null);

        try {
            if (!language || language === SupportedLanguage.UNKNOWN) {
                throw new Error("Language not identified, cannot check solution.");
            }
            if (!activePracticeMaterial || !coreConcepts) {
                throw new Error("Practice material is missing, cannot verify solution accurately.");
            }

            const analysisPromise = checkUserSolutionWithGemini(
                practiceSolution, language, activePracticeMaterial.questionText, coreConcepts.title, displayedInstructions, geminiConfig
            );
            const executionPromise = executeCodeWithGemini(practiceSolution, language, geminiConfig);

            const [analysis, actualOutput] = await Promise.all([analysisPromise, executionPromise]);
            
            setUserSolutionAnalysis(analysis);
            setActualSolutionOutput(actualOutput);

        } catch (err) {
            const msg = err instanceof Error ? err.message : "An unknown error occurred while checking your solution.";
            setSolutionError(msg);
            console.error(err);
        } finally {
            setIsCheckingSolution(false);
        }
    }, [practiceSolution, language, activePracticeMaterial, coreConcepts, displayedInstructions, geminiConfig]);


    const handleSendMessage = useCallback(async () => {
        if (!userMessage.trim() || isChatLoading) return;

        const newUserMessage: ChatMessage = { role: 'user', content: userMessage };
        const currentHistoryWithUserMessage = [...chatHistory, newUserMessage];

        setUserMessage('');
        setIsChatLoading(true);
        setChatError(null);
        setChatHistory(currentHistoryWithUserMessage);

        try {
            if (!lineByLineBreakdown || !coreConcepts || !executionFlowAndDataTransformation) {
                throw new Error("Explanation context is not fully loaded.");
            }
            const lineByLineText = lineByLineBreakdown.map(item => `Code: ${item.code}\nExplanation: ${item.explanation}`).join('\n\n');
            const fullExplanationForContext = `Core Concepts: ${coreConcepts.title}\n\nLine-by-Line Breakdown: ${lineByLineText}\n\nExecution Flow & Data Transformation: ${executionFlowAndDataTransformation}`;
            
            const answer = await askFollowUpQuestionWithGemini(
                newUserMessage.content,
                chatHistory, // Pass history *before* the new user message
                fullExplanationForContext, 
                language, 
                originalInputContext, 
                originalInputType,
                geminiConfig
            );

            const aiResponseMessage: ChatMessage = { role: 'ai', content: answer };
            setChatHistory(prev => [...prev, aiResponseMessage]);

        } catch (err) {
            const msg = err instanceof Error ? err.message : "Could not get an answer from AI.";
            setChatError(msg);
            const aiErrorResponseMessage: ChatMessage = { role: 'ai', content: `Sorry, I encountered an error: ${msg}` };
            setChatHistory(prev => [...prev, aiErrorResponseMessage]);
        } finally {
            setIsChatLoading(false);
        }
    }, [userMessage, isChatLoading, chatHistory, coreConcepts, lineByLineBreakdown, executionFlowAndDataTransformation, language, originalInputContext, originalInputType, geminiConfig]);
    
    const handleClearChat = () => {
        if (chatHistory.length === 0) return;
        setChatHistory([]);
        setChatError(null);
    };

    const handleMoreInstructions = useCallback(async () => {
        if (!hasMoreInstructions || isLoadingInstructions) return;
        setIsLoadingInstructions(true);
        try {
            if (!activePracticeMaterial?.questionText || !language || language === SupportedLanguage.UNKNOWN) {
                throw new Error("Missing context for fetching more instructions.");
            }
            const response = await getMoreInstructionsFromGemini(
                activePracticeMaterial.questionText, displayedInstructions, language, currentInstructionLevel, geminiConfig
            );
            if (response.newInstructionSteps && response.newInstructionSteps.length > 0) {
                const actualNewSteps = response.newInstructionSteps.filter(step => !step.toLowerCase().includes("no further") && !step.toLowerCase().includes("not beneficial") && step.trim() !== "");
                if (actualNewSteps.length > 0) {
                    setDisplayedInstructions(prev => [...prev, ...actualNewSteps]);
                    setCurrentInstructionLevel(prev => prev + 1);
                } else if (response.newInstructionSteps.length > 0 && response.newInstructionSteps[0].trim() !== "") {
                    console.log(response.newInstructionSteps[0]);
                } else {
                    console.log("No more detailed instructions available for this level.");
                }
            } else {
                console.log("No more detailed instructions available.");
            }
            setHasMoreInstructions(response.hasMoreLevels);
        } catch (err) {
            const msg = err instanceof Error ? err.message : "Failed to fetch more instructions.";
            console.error("Error fetching more instructions:", err);
        } finally {
            setIsLoadingInstructions(false);
        }
    }, [activePracticeMaterial, displayedInstructions, language, currentInstructionLevel, hasMoreInstructions, isLoadingInstructions, geminiConfig]);
    
    const getAssessmentDetails = (status?: AssessmentStatus, isCorrect?: boolean) => {
        let effectiveStatus = status;
        // Fallback to isCorrect if assessmentStatus is missing
        if (!effectiveStatus && typeof isCorrect === 'boolean') {
            effectiveStatus = isCorrect ? 'correct' : 'incorrect';
        }

        if (!effectiveStatus) return null;

        switch (effectiveStatus) {
            case 'correct':
                return {
                    classes: 'bg-green-600/20 border-green-500/40 text-green-300',
                    icon: 'check_circle',
                    text: 'AI Assessment: Correct'
                };
            case 'partially_correct':
                return {
                    classes: 'bg-orange-500/20 border-orange-500/40 text-orange-300',
                    icon: 'tips_and_updates',
                    text: 'AI Assessment: Partially Correct'
                };
            case 'incorrect':
                return {
                    classes: 'bg-yellow-500/20 border-yellow-500/40 text-yellow-300',
                    icon: 'warning',
                    text: 'AI Assessment: Incorrect Solution'
                };
            case 'syntax_error':
                return {
                    classes: 'bg-red-700/20 border-red-600/40 text-red-300',
                    icon: 'error',
                    text: 'AI Assessment: Syntax Error'
                };
            case 'unrelated':
                return {
                    classes: 'bg-red-700/20 border-red-600/40 text-red-300',
                    icon: 'help_outline',
                    text: 'AI Assessment: Unrelated Solution'
                };
            default:
                return null;
        }
    };

    const isCheckSolutionDisabled = isCheckingSolution || !practiceSolution.trim();
    const prismLanguageForEditor = getPrismLanguageString(language);

    const robustPracticeSolutionHighlight = (code: string) => {
        if (typeof Prism === 'undefined' || !Prism.highlight || !code) return escapeHtml(code || '');
        try {
            const langGrammar = Prism.languages[prismLanguageForEditor] || Prism.languages.clike;
            if (langGrammar) return Prism.highlight(code, langGrammar, prismLanguageForEditor);
        } catch (e) { console.warn(`Error highlighting practice solution with ${prismLanguageForEditor}:`, e); }
        return escapeHtml(code);
    };
    
    const renderChatMessageContent = (text: string) => { 
        if (!text) return null;
        const formattedText = text.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>').replace(/\*(.*?)\*/g, '<em>$1</em>');       
        return formattedText.split('\n').map((paragraph, index) => <p key={index} className="mb-1 last:mb-0" dangerouslySetInnerHTML={{ __html: paragraph }}></p>);
    };

    const topicExplanationSection = visibleSections.topicExplanation.masterToggle && result.topicExplanation && (
        <section aria-labelledby="topic-explanation-main-title">
            <h3 id="topic-explanation-main-title" className="text-lg font-semibold text-[var(--text-primary)] mb-2 flex items-center">
                <span className="material-icons-outlined text-[var(--accent-primary)] mr-2 text-xl">school</span>Topic Explanation
            </h3>
            <div className="bg-[var(--bg-tertiary)]/50 p-1.5 sm:p-2 rounded-lg border border-[var(--border-color)] divide-y divide-[var(--border-color)]">
                {visibleSections.topicExplanation.coreConcepts && coreConcepts && <CoreConceptsSection data={coreConcepts} />}
                {visibleSections.topicExplanation.blockByBlock && blockByBlockBreakdown && <BlockByBlockBreakdownSection breakdown={blockByBlockBreakdown} language={language} />}
                {visibleSections.topicExplanation.lineByLine && lineByLineBreakdown && <LineByLineBreakdownSection breakdown={lineByLineBreakdown} language={language} />}
                
                {/* Collapsible Chat Section */}
                {visibleSections.topicExplanation.followUp && (
                    <div className="py-2">
                        <div className="flex justify-between items-center text-left text-sm font-medium text-[var(--text-primary)] p-2 rounded-md hover:bg-[var(--bg-tertiary)]/80 transition-colors focus-within:ring-1 focus-within:ring-[var(--accent-primary)] focus-within:ring-offset-1 focus-within:ring-offset-[var(--bg-secondary)]">
                             <button type="button" onClick={() => setIsChatExpanded(!isChatExpanded)} className="flex items-center flex-grow" aria-expanded={isChatExpanded} aria-controls="collapsible-chat-content">
                                <span className="material-icons-outlined text-[var(--accent-primary)] mr-2 text-base">forum</span>
                                Conversational Chat
                                <span className={`material-icons-outlined text-lg ml-2 transform transition-transform duration-200 ${isChatExpanded ? 'rotate-180' : 'rotate-0'}`}>
                                    expand_more
                                </span>
                            </button>
                            <div className="flex items-center gap-1">
                                <button type="button" onClick={handleClearChat} disabled={chatHistory.length === 0} title="Clear chat history" className="p-1.5 rounded-full text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)] transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
                                    <span className="material-icons-outlined text-sm">delete</span>
                                </button>
                                <button type="button" onClick={() => setIsFullScreenChatOpen(true)} title="Open in full-screen" className="p-1.5 rounded-full text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)] transition-colors">
                                    <span className="material-icons-outlined text-sm">open_in_full</span>
                                </button>
                            </div>
                        </div>

                        <div id="collapsible-chat-content" className={`transition-all duration-300 ease-in-out overflow-hidden ${isChatExpanded ? 'max-h-[30rem] opacity-100 mt-2' : 'max-h-0 opacity-0'}`} style={{ transitionProperty: 'max-height, opacity, margin-top' }}>
                            <div className="py-3 pl-4 pr-2 border-l-2 border-[var(--border-color)] space-y-3">
                                <div ref={chatContainerRef} className="bg-[var(--bg-tertiary)]/80 border border-[var(--border-color)] rounded-lg p-2 sm:p-3 h-64 overflow-y-auto custom-scrollbar-small flex flex-col space-y-3">
                                    {chatHistory.map((msg, index) => (
                                        <div key={index} className={`flex items-start gap-2.5 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                                            {msg.role === 'ai' && <span className="material-icons-outlined text-[var(--accent-primary)] text-lg flex-shrink-0 mt-1">assistant</span>}
                                            <div className={`max-w-xs md:max-w-md p-2 rounded-lg text-xs leading-normal whitespace-pre-wrap ${msg.role === 'user' ? 'bg-[var(--accent-primary)] text-white' : 'bg-[var(--bg-tertiary)] text-[var(--text-primary)]'}`}>
                                                {renderChatMessageContent(msg.content)}
                                            </div>
                                            {msg.role === 'user' && <span className="material-icons-outlined text-[var(--text-muted)] text-lg flex-shrink-0 mt-1">account_circle</span>}
                                        </div>
                                    ))}
                                    {isChatLoading && (
                                        <div className="flex items-start gap-2.5 justify-start">
                                            <span className="material-icons-outlined text-[var(--accent-primary)] text-lg flex-shrink-0 mt-1">assistant</span>
                                            <div className="bg-[var(--bg-tertiary)] p-2 rounded-lg flex items-center space-x-1">
                                                <span className="w-1.5 h-1.5 bg-[var(--text-muted)] rounded-full animate-pulse delay-0"></span>
                                                <span className="w-1.5 h-1.5 bg-[var(--text-muted)] rounded-full animate-pulse delay-200"></span>
                                                <span className="w-1.5 h-1.5 bg-[var(--text-muted)] rounded-full animate-pulse delay-400"></span>
                                            </div>
                                        </div>
                                    )}
                                    {chatError && <ErrorMessage message={chatError} />}
                                </div>
                                <div className="flex items-center gap-2">
                                    <textarea 
                                        ref={chatInputRef}
                                        id="follow-up-question" 
                                        rows={1} 
                                        value={userMessage} 
                                        onChange={(e) => setUserMessage(e.target.value)} 
                                        onKeyDown={(e) => { if(e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSendMessage(); } }} 
                                        placeholder="Ask a follow-up..." 
                                        className="flex-grow w-full bg-[var(--bg-tertiary)] border border-[var(--border-color)] text-[var(--text-primary)] rounded-md p-2 text-xs focus:ring-1 focus:ring-[var(--accent-primary)] focus:border-[var(--accent-primary)] placeholder-[var(--text-muted)] transition-colors custom-scrollbar-small min-h-[40px] max-h-24 resize-none" 
                                        disabled={isChatLoading} 
                                    />
                                    <button type="button" onClick={handleSendMessage} disabled={isChatLoading || !userMessage.trim()} className="bg-[var(--accent-primary)] hover:bg-[var(--accent-primary-hover)] text-white font-medium p-2 rounded-md flex items-center justify-center transition-colors focus:outline-none focus:ring-1 focus:ring-[var(--accent-primary)] ring-offset-1 ring-offset-[var(--bg-secondary)] disabled:bg-[var(--bg-tertiary)] disabled:text-[var(--text-muted)] disabled:cursor-not-allowed shadow" aria-label="Send message">
                                        {isChatLoading ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div> : <span className="material-icons-outlined text-base">send</span>}
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </section>
    );

    const visualExecutionFlowSection = visibleSections.topicExplanation.executionFlow && visualExecutionFlow && visualExecutionFlow.length > 1 && (
        <section aria-labelledby="visual-flow-title">
            <h3 id="visual-flow-title" className="text-lg font-semibold text-[var(--text-primary)] mb-3 flex items-center">
                <span className="material-icons-outlined text-[var(--accent-primary)] mr-2 text-xl">play_circle_outline</span>Visual Execution Flow
            </h3>
            <VisualFlowPlayer
                flowSteps={visualExecutionFlow}
                code={originalInputType === 'code' ? originalInputContext : (result.exampleCode || '')}
                language={language}
            />
        </section>
    );
    
    const finalExecutionOutput = useMemo(() => {
        return visualExecutionFlow
            ?.map(step => step.consoleOutput || '')
            .join('');
    }, [visualExecutionFlow]);

    const finalOutputSection = finalExecutionOutput !== undefined && finalExecutionOutput !== null && (
        <section aria-labelledby="final-output-title">
            <h3 id="final-output-title" className="text-lg font-semibold text-[var(--text-primary)] mb-3 flex items-center justify-between">
                <span className="flex items-center">
                    <span className="material-icons-outlined text-[var(--accent-primary)] mr-2 text-xl">receipt_long</span>
                    Final Execution Output
                </span>
                <button onClick={() => setIsFinalOutputVisible(!isFinalOutputVisible)} className="p-1 rounded-full text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)] transition-colors" title={isFinalOutputVisible ? 'Hide Final Output' : 'Show Final Output'}>
                    <span className="material-icons-outlined text-base">{isFinalOutputVisible ? 'visibility_off' : 'visibility'}</span>
                </button>
            </h3>
            <div className={`transition-all duration-300 ease-in-out overflow-hidden ${isFinalOutputVisible ? 'max-h-60 opacity-100' : 'max-h-0 opacity-0'}`}>
                <FinalOutputDisplay output={finalExecutionOutput} />
            </div>
        </section>
    );

    const currentExampleData = exampleCache[selectedExampleDifficulty];

    const exampleCodeSection = visibleSections.exampleCode && (
        <section aria-labelledby="example-code-title">
            <div className="flex justify-between items-center mb-3 flex-wrap gap-2">
                <h3 id="example-code-title" className="text-lg font-semibold text-[var(--text-primary)] flex items-center">
                    <span className="material-icons-outlined text-[var(--accent-primary)] mr-2 text-xl">code_blocks</span>Editable Example Code
                </h3>
                {result.exampleCode && (
                    <div className="flex flex-wrap items-center gap-2">
                        <span className="text-xs text-[var(--text-muted)] mr-1">Difficulty:</span>
                        {ExampleDifficultyLevels.map(level => {
                            const isLoadingThisButton = isExampleLoading && loadingDifficulty === level;
                            const isSelected = selectedExampleDifficulty === level;
                            return (
                                <button 
                                    key={level} 
                                    type="button" 
                                    onClick={() => handleDifficultyChange(level)} 
                                    disabled={isExampleLoading} 
                                    className={`px-2.5 py-1 rounded-full text-xs font-medium transition-colors focus:outline-none focus:ring-1 ring-offset-1 ring-offset-[var(--bg-secondary)] shadow-sm 
                                        ${isLoadingThisButton 
                                            ? 'bg-[var(--accent-primary)] text-white animate-pulse cursor-wait' 
                                            : isSelected 
                                                ? 'bg-[var(--accent-primary)] text-white hover:bg-[var(--accent-primary-hover)] focus:ring-[var(--accent-primary)]' 
                                                : 'bg-[var(--bg-tertiary)] hover:bg-[var(--border-color)] text-[var(--text-secondary)] focus:ring-[var(--accent-primary)]'
                                        } 
                                        ${isExampleLoading && !isLoadingThisButton ? 'opacity-60 cursor-not-allowed' : ''}
                                    `} 
                                    aria-pressed={selectedExampleDifficulty === level}
                                >
                                    {ExampleDifficultyDisplayNames[level]}
                                </button>
                            );
                        })}
                        <button
                            onClick={handleGenerateNewExample}
                            disabled={isExampleLoading}
                            className="bg-[var(--bg-tertiary)] hover:bg-[var(--border-color)] text-white font-medium py-1.5 px-3 rounded-md flex items-center gap-1.5 transition-colors text-xs shadow focus:outline-none focus:ring-1 focus:ring-[var(--accent-primary)] ring-offset-1 ring-offset-[var(--bg-secondary)] disabled:opacity-60 disabled:cursor-not-allowed"
                            title="Generate a new example for the current difficulty"
                        >
                            {isExampleLoading && loadingDifficulty === selectedExampleDifficulty ? (
                                <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                            ) : (
                                <span className="material-icons-outlined text-sm">refresh</span>
                            )}
                            <span>New Example</span>
                        </button>
                    </div>
                )}
            </div>
            
            {isExampleLoading ? (
                <SectionLoadingSpinner text={`Generating ${loadingDifficulty || 'new'} example...`} />
            ) : (
                <>
                    {exampleError && <ErrorMessage message={`Failed to load example: ${exampleError}`} />}
                    {currentExampleData ? (
                        <EditableExampleCodeSection 
                            key={currentExampleData.exampleCode}
                            initialCode={currentExampleData.exampleCode}
                            initialOutput={currentExampleData.exampleCodeOutput}
                            language={language}
                            geminiConfig={geminiConfig}
                        />
                    ) : (
                         <div className="flex flex-col justify-center items-center py-6 text-center w-full bg-[var(--bg-tertiary)]/50 rounded-lg border border-[var(--border-color)]">
                            <p className="text-[var(--text-secondary)] text-sm font-medium">No Example Code</p>
                            <p className="text-[var(--text-muted)] text-xs mt-1">An example could not be generated for this topic.</p>
                        </div>
                    )}
                </>
            )}
        </section>
    );

    const practiceQuestionSection = visibleSections.practiceQuestion && (
        <section aria-labelledby="practice-question-title">
             <div className="flex justify-between items-center mb-3 flex-wrap gap-2">
                <h3 id="practice-question-title" className="text-lg font-semibold text-[var(--text-primary)] flex items-center">
                    <span className="material-icons-outlined text-[var(--accent-primary)] mr-2 text-xl">quiz</span>Practice
                </h3>
                {result.practiceContext && (
                    <div className="bg-[var(--bg-tertiary)]/80 p-1 rounded-md flex items-center gap-1 text-xs shadow-sm" role="tablist" aria-orientation="horizontal">
                        {(['generated', 'userCode'] as const).map(mode => (
                            <button key={mode} onClick={() => setPracticeMode(mode)} className={`px-2.5 py-1.5 rounded-sm font-medium transition-colors focus:outline-none focus:ring-1 focus:ring-offset-1 focus:ring-offset-[var(--bg-tertiary)] ${practiceMode === mode ? 'bg-[var(--accent-primary)] text-white focus:ring-[var(--accent-primary)]' : 'bg-transparent text-[var(--text-secondary)] hover:bg-[var(--border-color)] focus:ring-[var(--accent-primary)]'}`} role="tab" aria-selected={practiceMode === mode} aria-controls="practice-panel">
                                {mode === 'generated' ? 'Generated Question' : 'Solve Your Code'}
                            </button>
                        ))}
                    </div>
                )}
            </div>

            {!result.practiceContext ? <SectionLoadingSpinner text="Loading Practice Question..." /> : (
                <>
                    <div id="practice-panel" role="tabpanel">
                        {activePracticeMaterial && (
                            <div className="bg-[var(--bg-tertiary)]/60 p-3 sm:p-4 rounded-lg border border-[var(--border-color)] mb-4">
                                <h4 className="text-md font-semibold text-[var(--accent-primary)] mb-2">
                                    {activePracticeMaterial.title}
                                </h4>
                                <div className="text-sm text-[var(--text-secondary)] leading-relaxed prose prose-sm prose-invert max-w-none">
                                    {activePracticeMaterial.questionText.split('\n').map((line, index) => <p key={index}>{line}</p>)}
                                </div>
                            </div>
                        )}

                        {practiceMode === 'generated' && (
                            <div className="flex flex-wrap items-center gap-2 mb-4">
                                <span className="text-xs text-[var(--text-muted)] mr-1">Difficulty:</span>
                                {ExampleDifficultyLevels.map(level => {
                                    const isLoadingThisButton = loadingPracticeDifficulty === level;
                                    const isSelected = selectedPracticeDifficulty === level && !loadingPracticeDifficulty;

                                    return (
                                        <button
                                            key={level}
                                            type="button"
                                            onClick={() => handlePracticeDifficultyChange(level)}
                                            disabled={isPracticeQuestionLoading}
                                            className={`px-2.5 py-1 rounded-full text-xs font-medium transition-colors focus:outline-none focus:ring-1 ring-offset-1 ring-offset-[var(--bg-secondary)] shadow-sm
                                                ${isLoadingThisButton
                                                    ? 'bg-[var(--accent-primary)] text-white animate-pulse cursor-wait'
                                                    : isSelected
                                                        ? 'bg-[var(--accent-primary)] text-white hover:bg-[var(--accent-primary-hover)] focus:ring-[var(--accent-primary)]'
                                                        : 'bg-[var(--bg-tertiary)] hover:bg-[var(--border-color)] text-[var(--text-secondary)] focus:ring-[var(--accent-primary)]'
                                                }
                                                ${isPracticeQuestionLoading && !isLoadingThisButton ? 'opacity-60 cursor-not-allowed' : ''}
                                            `}
                                            aria-pressed={selectedPracticeDifficulty === level}
                                        >
                                            {ExampleDifficultyDisplayNames[level]}
                                        </button>
                                    );
                                })}
                            </div>
                        )}

                        {isPracticeQuestionLoading && <div className="flex items-center justify-center p-3 bg-[var(--bg-tertiary)]/50 rounded-md my-2 text-xs"><div className="w-3.5 h-3.5 border-2 border-[var(--accent-primary)] border-t-transparent rounded-full animate-spin mr-2"></div><span className="text-[var(--text-muted)]">Generating new practice question...</span></div>}
                        {practiceQuestionError && !isPracticeQuestionLoading && <ErrorMessage message={`Failed to load practice question: ${practiceQuestionError}`} />}

                        {!isPracticeQuestionLoading && activePracticeMaterial && (
                            <>
                                {visibleSections.instructionsToSolve && (
                                    <div className="mb-4">
                                        <div className="flex justify-between items-center mb-2 flex-wrap gap-2">
                                            <h4 className="text-md font-semibold text-[var(--text-primary)] flex items-center">
                                                <span className="material-icons-outlined text-base text-[var(--accent-primary)] mr-1.5">integration_instructions</span>
                                                Instructions to Solve
                                            </h4>
                                            <div className="bg-[var(--bg-tertiary)]/80 p-1 rounded-md flex items-center gap-1 text-xs shadow-sm">
                                                {(['normal', 'line-by-line'] as const).map(format => (
                                                    <button key={format} onClick={() => setInstructionFormat(format)} className={`px-2 py-1 rounded-sm font-medium transition-colors focus:outline-none focus:ring-1 focus:ring-offset-1 focus:ring-offset-[var(--bg-tertiary)] ${instructionFormat === format ? 'bg-[var(--accent-primary)] text-white focus:ring-[var(--accent-primary)]' : 'bg-transparent text-[var(--text-secondary)] hover:bg-[var(--border-color)] focus:ring-[var(--accent-primary)]'}`} aria-pressed={instructionFormat === format}>
                                                        {format === 'normal' ? 'Conceptual' : 'Line-by-Line'}
                                                    </button>
                                                ))}
                                            </div>
                                        </div>
                                        {instructionFormat === 'normal' && (
                                            <div className="mt-2">
                                                <p className="text-sm italic text-[var(--text-muted)] mb-2">Conceptual, step-by-step guidance. Level {currentInstructionLevel}.</p>
                                                {renderInstructionSteps(displayedInstructions)}
                                                <div className="mt-3 flex flex-wrap gap-2">
                                                    {hasMoreInstructions && <button type="button" onClick={handleMoreInstructions} disabled={isLoadingInstructions} className="bg-[var(--bg-tertiary)] hover:bg-[var(--border-color)] text-white font-medium py-1.5 px-3 rounded-md flex items-center gap-1 transition-colors text-xs shadow focus:outline-none focus:ring-1 focus:ring-[var(--accent-primary)] ring-offset-1 ring-offset-[var(--bg-secondary)] disabled:opacity-60 disabled:cursor-not-allowed">{isLoadingInstructions ? (<><div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin mr-1.5"></div><span>Loading...</span></>) : (<><span className="material-icons-outlined text-sm">unfold_more</span>More Instructions</>)}</button>}
                                                    <button type="button" onClick={() => setShowSolution(!showSolution)} className="bg-[var(--accent-primary)] hover:bg-[var(--accent-primary-hover)] text-white font-medium py-1.5 px-3 rounded-md flex items-center gap-1 transition-colors text-xs shadow focus:outline-none focus:ring-1 focus:ring-[var(--accent-primary)] ring-offset-1 ring-offset-[var(--bg-secondary)]">
                                                        <span className="material-icons-outlined text-sm">{showSolution ? 'visibility_off' : 'visibility'}</span>{showSolution ? 'Hide Solution' : 'Show Solution'}
                                                    </button>
                                                </div>
                                            </div>
                                        )}
                                        {instructionFormat === 'line-by-line' && (
                                            <div className="mt-2">
                                                <p className="text-sm italic text-[var(--text-muted)] mb-3">Code construction guidance, one step at a time.</p>
                                                <div className="max-h-80 overflow-y-auto custom-scrollbar-small pr-2">
                                                    {renderInstructionSteps(activePracticeMaterial.lineByLineInstructions)}
                                                </div>
                                                <div className="mt-3 flex flex-wrap gap-2">
                                                    <button type="button" onClick={() => setShowSolution(!showSolution)} className="bg-[var(--accent-primary)] hover:bg-[var(--accent-primary-hover)] text-white font-medium py-1.5 px-3 rounded-md flex items-center gap-1 transition-colors text-xs shadow focus:outline-none focus:ring-1 focus:ring-[var(--accent-primary)] ring-offset-1 ring-offset-[var(--bg-secondary)]">
                                                        <span className="material-icons-outlined text-sm">{showSolution ? 'visibility_off' : 'visibility'}</span>{showSolution ? 'Hide Solution' : 'Show Solution'}
                                                    </button>
                                                </div>
                                            </div>
                                        )}
                                        {showSolution && activePracticeMaterial.solutionCode && (
                                            <div className="mt-4 p-3 bg-[var(--bg-tertiary)]/60 rounded-lg border border-[var(--border-color)]">
                                                <h5 className="text-sm font-semibold text-[var(--text-primary)] mb-2">AI Generated Solution:</h5>
                                                <CodeBlock code={activePracticeMaterial.solutionCode} language={language} idSuffix="solution" showLineNumbers />
                                                {activePracticeMaterial.solutionOutput && <TerminalOutput output={activePracticeMaterial.solutionOutput} title="Solution Output" />}
                                            </div>
                                        )}
                                    </div>
                                )}
                                <div>
                                    <label htmlFor="practice-solution" className="block text-sm font-medium text-[var(--text-muted)] mb-1.5">Your Solution ({LanguageDisplayNames[language || SupportedLanguage.UNKNOWN]}):</label>
                                    <div className="bg-[var(--bg-primary)]/60 border border-[var(--border-color)] rounded-md focus-within:ring-1 focus-within:ring-[var(--accent-primary)] focus-within:border-[var(--accent-primary)] shadow-sm">
                                        <Editor value={practiceSolution} onValueChange={code => setPracticeSolution(code)} highlight={robustPracticeSolutionHighlight} padding={12} textareaClassName="code-editor-textarea !text-[var(--text-primary)] !font-fira-code" preClassName="code-editor-pre !font-fira-code" className="text-xs min-h-[160px] max-h-[320px] overflow-y-auto custom-scrollbar-small" disabled={isCheckingSolution} placeholder={`// Enter your ${LanguageDisplayNames[language || SupportedLanguage.UNKNOWN]} code here...`} aria-label="Practice solution input area" />
                                    </div>
                                    <div className="mt-3 flex flex-col sm:flex-row justify-end items-center gap-2.5">
                                        {isCheckingSolution && <div className="w-4 h-4 border-2 border-[var(--accent-primary)] border-t-transparent rounded-full animate-spin order-first sm:order-none"></div>}
                                        <button type="button" onClick={handleCheckSolution} disabled={isCheckSolutionDisabled} className="w-full sm:w-auto bg-[var(--accent-primary)] hover:bg-[var(--accent-primary-hover)] text-white font-medium py-2 px-4 rounded-md flex items-center justify-center gap-1.5 transition-colors focus:outline-none focus:ring-2 focus:ring-[var(--accent-primary)] ring-offset-1 ring-offset-[var(--bg-secondary)] disabled:bg-[var(--bg-tertiary)] disabled:text-[var(--text-muted)] text-xs shadow">
                                            <span className="material-icons-outlined text-base">{isCheckingSolution ? 'hourglass_empty' : 'play_circle_filled'}</span>{isCheckingSolution ? 'Running & Checking...' : "Run & Get AI Feedback"}
                                        </button>
                                    </div>
                                    {solutionError && <div className="mt-2.5"><ErrorMessage message={solutionError} /></div>}
                                    {(userSolutionAnalysis || actualSolutionOutput) && !isCheckingSolution && (() => {
                                        const assessmentDetails = userSolutionAnalysis ? getAssessmentDetails(userSolutionAnalysis.assessmentStatus, userSolutionAnalysis.isCorrect) : null;
                                        return (
                                            <div ref={solutionFeedbackRef} className="mt-4 p-4 bg-[var(--bg-tertiary)]/60 rounded-lg border border-[var(--border-color)] shadow-md">
                                                <h4 className="text-sm font-semibold text-[var(--text-primary)] mb-2 flex items-center gap-1.5"><span className="material-icons-outlined text-base text-[var(--accent-primary)]">comment</span>AI Feedback:</h4>
                                                {assessmentDetails && (
                                                    <div className={`mb-2 p-2 rounded-md text-xs font-medium flex items-center border ${assessmentDetails.classes}`}>
                                                        <span className="material-icons-outlined mr-1.5 text-sm">{assessmentDetails.icon}</span>
                                                        {assessmentDetails.text}
                                                    </div>
                                                )}
                                                {actualSolutionOutput !== null && <TerminalOutput output={actualSolutionOutput} title="Actual Output" />}
                                                {userSolutionAnalysis && <TerminalOutput output={userSolutionAnalysis.predictedOutput} title="AI's Predicted Output" />}

                                                {userSolutionAnalysis && (
                                                    <div className="mt-2.5">
                                                        <h5 className="text-xs font-semibold text-[var(--text-secondary)] mb-1">Detailed Feedback:</h5>
                                                        <div className="text-xs text-[var(--text-secondary)] leading-relaxed whitespace-pre-wrap prose prose-xs prose-invert max-w-none">{userSolutionAnalysis.feedback.split('\n').map((line, index) => <p key={index}>{line}</p>)}</div>
                                                    </div>
                                                )}
                                            </div>
                                        );
                                    })()}
                                </div>
                            </>
                        )}
                    </div>
                </>
            )}
        </section>
    );

    const allSections = [
        { key: 'topicExplanation', content: topicExplanationSection },
        { key: 'visualExecutionFlow', content: visualExecutionFlowSection },
        { key: 'finalOutput', content: finalOutputSection },
        { key: 'exampleCode', content: exampleCodeSection },
        { key: 'practiceQuestion', content: practiceQuestionSection },
    ].filter(s => s.content);

    return (
        <div className="w-full text-left">
            {allSections.map((section, index) => (
                <React.Fragment key={section.key}>
                    {index > 0 && <div className="border-t border-[var(--border-color)] my-6 sm:my-8"></div>}
                    {section.content}
                </React.Fragment>
            ))}

            <FullScreenChatModal
                isOpen={isFullScreenChatOpen}
                onClose={() => setIsFullScreenChatOpen(false)}
                chatHistory={chatHistory}
                isChatLoading={isChatLoading}
                chatError={chatError}
                userMessage={userMessage}
                setUserMessage={setUserMessage}
                handleSendMessage={handleSendMessage}
                handleClearChat={handleClearChat}
                renderChatMessageContent={renderChatMessageContent}
            />
        </div>
    );
};

export const ResultDisplay = React.memo(ResultDisplayComponent);