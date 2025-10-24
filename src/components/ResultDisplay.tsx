
import React, { useState, useCallback, useEffect, useRef } from 'react';
import toast from 'react-hot-toast';
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
    ChatMessage
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
    executeCodeWithGemini
} from '../services/geminiService'; 
import { ErrorMessage } from './ErrorMessage'; 
import { CodeBlock, getPrismLanguageString } from './CodeBlock'; 
import { escapeHtml } from '../utils/textUtils'; 
import { FullScreenChatModal } from './FullScreenChatModal';
import { VisualFlowPlayer } from './VisualFlowPlayer';


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
        return <p className="text-sm text-gray-400 italic">This section is not applicable for the current analysis or was not provided.</p>;
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
                className="w-full flex justify-between items-center text-left text-sm font-medium text-gray-100 hover:text-indigo-300 p-2 rounded-md hover:bg-gray-700/40 focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:ring-offset-1 focus:ring-offset-gray-800 transition-colors"
                aria-expanded={isExpanded}
                aria-controls={`collapsible-content-${title.replace(/\s+/g, '-').toLowerCase()}`}
            >
                <span className="flex items-center">
                    <span className="material-icons-outlined text-indigo-400 mr-2 text-base">{iconName}</span>
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
                <div className="pl-3 pr-3 py-1.5 border-l-2 border-gray-700/60">
                     <div className="text-sm text-gray-300 leading-relaxed prose prose-sm prose-invert max-w-none">
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
        return <p className="text-sm text-gray-400 italic">No instructions provided for this level, or this level is not applicable.</p>;
    }
    return (
        <ul className="list-none text-sm text-gray-300 space-y-2 leading-relaxed">
            {steps.map((step, index) => {
                // Remove common list prefixes if AI includes them
                const trimmedStep = step.trim().replace(/^(\d+\.|-|\*|\u2022|Step\s*\d*:)\s*/i, '');
                if (trimmedStep) return (
                    <li key={`instruction-step-${index}`} className="flex items-start pl-1">
                        <span className="material-icons-outlined text-indigo-500 text-base mr-2.5 mt-px flex-shrink-0">chevron_right</span>
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
}

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
                className="w-full flex justify-between items-center text-left text-sm font-medium text-gray-100 hover:text-indigo-300 p-2 rounded-md hover:bg-gray-700/40 focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:ring-offset-1 focus:ring-offset-gray-800 transition-colors"
                aria-expanded={isExpanded}
                aria-controls="block-by-block-breakdown-content"
            >
                <span className="flex items-center">
                    <span className="material-icons-outlined text-indigo-400 mr-2 text-base">view_quilt</span>
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
                <div className="pl-3 pr-3 py-1.5 border-l-2 border-gray-700/60">
                    {breakdown.map((item, index) => (
                        <div key={`bbb-${index}`} className="py-3 border-b border-gray-700/50 last:border-b-0">
                            <CodeBlock code={item.codeBlock} language={language} idSuffix={`bbb-${index}`} />
                            <p className="mt-2 text-sm text-gray-300/90 leading-relaxed">{item.explanation}</p>
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
                className="w-full flex justify-between items-center text-left text-sm font-medium text-gray-100 hover:text-indigo-300 p-2 rounded-md hover:bg-gray-700/40 focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:ring-offset-1 focus:ring-offset-gray-800 transition-colors"
                aria-expanded={isExpanded}
                aria-controls="line-by-line-breakdown-content"
            >
                <span className="flex items-center">
                    <span className="material-icons-outlined text-indigo-400 mr-2 text-base">segment</span>
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
                <div className="pl-3 pr-3 py-1.5 border-l-2 border-gray-700/60">
                    {breakdown.map((item, index) => (
                        <div key={`lbl-${index}`} className="py-3 border-b border-gray-700/50 last:border-b-0">
                            <CodeBlock code={item.code} language={language} idSuffix={`lbl-${index}`} />
                            <p className="mt-2 text-sm text-gray-300/90 leading-relaxed">{item.explanation}</p>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
};


const ResultDisplayComponent: React.FC<ResultDisplayProps> = ({ 
    result, 
    language, 
    difficultyOfProvidedExample,
    initialPracticeDifficulty,
    originalInputContext,
    originalInputType
}) => {
    const { preferredInstructionFormat, visibleSections } = useGlobalSettings();
    const [isLanguageGrammarLoaded, setIsLanguageGrammarLoaded] = useState(false);

    // This effect ensures the grammar for the current language is loaded for the editors.
    useEffect(() => {
        if (typeof Prism !== 'undefined' && Prism.plugins?.autoloader) {
            const lang = getPrismLanguageString(language);
            if (!Prism.languages[lang]) {
                setIsLanguageGrammarLoaded(false); // Reset loading state
                Prism.plugins.autoloader.loadLanguages(lang, () => {
                    // Callback fires when loaded, trigger re-render
                    setIsLanguageGrammarLoaded(true);
                });
            } else {
                setIsLanguageGrammarLoaded(true); // Already available
            }
        }
    }, [language]);


    // Example Code states
    const [currentExampleCode, setCurrentExampleCode] = useState<string>(result.exampleCode);
    const [currentExampleCodeOutput, setCurrentExampleCodeOutput] = useState<string>(result.exampleCodeOutput);
    const [selectedExampleDifficulty, setSelectedExampleDifficulty] = useState<ExampleDifficulty>(difficultyOfProvidedExample);
    const [isExampleLoading, setIsExampleLoading] = useState<boolean>(false);
    const [exampleError, setExampleError] = useState<string | null>(null);
    const [editableExampleCode, setEditableExampleCode] = useState(result.exampleCode);
    const [isExecutingExample, setIsExecutingExample] = useState(false);
    const [exampleExecutionResult, setExampleExecutionResult] = useState<string | null>(null);
    const [exampleExecutionError, setExampleExecutionError] = useState<string | null>(null);
    
    // Practice Section states
    const [practiceMode, setPracticeMode] = useState<'generated' | 'userCode'>('generated');
    const [generatedPracticeMaterial, setGeneratedPracticeMaterial] = useState<PracticeMaterial>(result.practiceContext.generatedQuestion);
    const [selectedPracticeDifficulty, setSelectedPracticeDifficulty] = useState<ExampleDifficulty>(initialPracticeDifficulty);
    const [isPracticeQuestionLoading, setIsPracticeQuestionLoading] = useState<boolean>(false);
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


    // Instruction states
    const [instructionFormat, setInstructionFormat] = useState<'normal' | 'line-by-line'>(preferredInstructionFormat);
    const [displayedInstructions, setDisplayedInstructions] = useState<string[]>([]);
    const [currentInstructionLevel, setCurrentInstructionLevel] = useState<number>(1);
    const [isLoadingInstructions, setIsLoadingInstructions] = useState<boolean>(false);
    const [hasMoreInstructions, setHasMoreInstructions] = useState<boolean>(true);

    // State for showing AI's solution to practice question
    const [showSolution, setShowSolution] = useState<boolean>(false);

    const { coreConcepts, blockByBlockBreakdown, lineByLineBreakdown, executionFlowAndDataTransformation, visualExecutionFlow } = result.topicExplanation;
    const userCodePracticeMaterial = result.practiceContext.userCodeAsPractice;
    const activePracticeMaterial = practiceMode === 'generated' ? generatedPracticeMaterial : userCodePracticeMaterial;

    // Effect runs only when the parent 'result' prop (a full new analysis) changes.
    useEffect(() => {
        // Reset example code section
        setCurrentExampleCode(result.exampleCode);
        setCurrentExampleCodeOutput(result.exampleCodeOutput);
        setSelectedExampleDifficulty(difficultyOfProvidedExample);
        setIsExampleLoading(false);
        setExampleError(null);
        setEditableExampleCode(result.exampleCode);
        setExampleExecutionResult(null);
        setExampleExecutionError(null);
        setIsExecutingExample(false);
        
        // Reset practice question section to the initial one from the new analysis
        setPracticeMode('generated');
        setGeneratedPracticeMaterial(result.practiceContext.generatedQuestion);
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
        if (newDifficulty === selectedExampleDifficulty && !exampleError && !isExampleLoading) {
            toast(`Currently showing ${ExampleDifficultyDisplayNames[newDifficulty]} example.`, { icon: 'ℹ️' });
            return;
        }
        if (isExampleLoading) return;

        setIsExampleLoading(true); setExampleError(null);

        try {
            if (!language || language === SupportedLanguage.UNKNOWN) throw new Error("Language not set for example generation.");
            toast(`Fetching ${ExampleDifficultyDisplayNames[newDifficulty]} example...`, { icon: '⏳', duration: 2500 });
            const exampleData = await getExampleByDifficulty(coreConcepts, language, newDifficulty);
            setCurrentExampleCode(exampleData.exampleCode);
            setCurrentExampleCodeOutput(exampleData.exampleCodeOutput);
            setSelectedExampleDifficulty(newDifficulty);
            toast.success(`${ExampleDifficultyDisplayNames[newDifficulty]} example loaded!`);
        } catch (err) {
            const errorMsg = err instanceof Error ? err.message : "Failed to get the example from AI.";
            setExampleError(errorMsg); toast.error(errorMsg); console.error(err);
        } finally {
            setIsExampleLoading(false);
        }
    }, [selectedExampleDifficulty, isExampleLoading, language, coreConcepts, exampleError]);

    const handlePracticeDifficultyChange = useCallback(async (newDifficulty: ExampleDifficulty) => {
        if (newDifficulty === selectedPracticeDifficulty || isPracticeQuestionLoading) return;
    
        setIsPracticeQuestionLoading(true);
        setPracticeQuestionError(null);
    
        try {
            toast(`Fetching ${ExampleDifficultyDisplayNames[newDifficulty]} practice question...`, { icon: '⏳' });
            if (!language || language === SupportedLanguage.UNKNOWN) {
                throw new Error("Language not set for practice question generation.");
            }
    
            const newPracticeMaterial = await getPracticeQuestionByDifficulty(
                coreConcepts,
                language,
                newDifficulty
            );
    
            setGeneratedPracticeMaterial(newPracticeMaterial);
            setSelectedPracticeDifficulty(newDifficulty);
            toast.success(`${ExampleDifficultyDisplayNames[newDifficulty]} practice question loaded!`);
    
        } catch (err) {
            const errorMsg = err instanceof Error ? err.message : "Failed to get the practice question from AI.";
            setPracticeQuestionError(errorMsg);
            toast.error(errorMsg);
            console.error(err);
        } finally {
            setIsPracticeQuestionLoading(false);
        }
    }, [selectedPracticeDifficulty, isPracticeQuestionLoading, language, coreConcepts]);

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
        toast.loading('Running code and getting AI feedback...', { id: 'solution-check' });

        try {
            if (!language || language === SupportedLanguage.UNKNOWN) {
                throw new Error("Language not identified, cannot check solution.");
            }
            if (!activePracticeMaterial) {
                throw new Error("Practice material is missing, cannot verify solution accurately.");
            }

            // Run both API calls in parallel for efficiency
            const analysisPromise = checkUserSolutionWithGemini(
                practiceSolution, language, activePracticeMaterial.questionText, coreConcepts, displayedInstructions
            );
            const executionPromise = executeCodeWithGemini(practiceSolution, language);

            const [analysis, actualOutput] = await Promise.all([analysisPromise, executionPromise]);
            
            setUserSolutionAnalysis(analysis);
            setActualSolutionOutput(actualOutput);
            toast.success("AI feedback on your solution received!", { id: 'solution-check' });

        } catch (err) {
            const msg = err instanceof Error ? err.message : "An unknown error occurred while checking your solution.";
            setSolutionError(msg);
            toast.error(msg, { id: 'solution-check' });
            console.error(err);
        } finally {
            setIsCheckingSolution(false);
        }
    }, [practiceSolution, language, activePracticeMaterial, coreConcepts, displayedInstructions]);


    const handleSendMessage = useCallback(async () => {
        if (!userMessage.trim() || isChatLoading) return;

        const newUserMessage: ChatMessage = { role: 'user', content: userMessage };
        const currentHistoryWithUserMessage = [...chatHistory, newUserMessage];

        setUserMessage('');
        setIsChatLoading(true);
        setChatError(null);
        setChatHistory(currentHistoryWithUserMessage);

        try {
            const lineByLineText = lineByLineBreakdown.map(item => `Code: ${item.code}\nExplanation: ${item.explanation}`).join('\n\n');
            const fullExplanationForContext = `Core Concepts: ${coreConcepts}\n\nLine-by-Line Breakdown: ${lineByLineText}\n\nExecution Flow & Data Transformation: ${executionFlowAndDataTransformation}`;
            
            const answer = await askFollowUpQuestionWithGemini(
                newUserMessage.content,
                chatHistory, // Pass history *before* the new user message
                fullExplanationForContext, 
                language, 
                originalInputContext, 
                originalInputType
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
    }, [userMessage, isChatLoading, chatHistory, coreConcepts, lineByLineBreakdown, executionFlowAndDataTransformation, language, originalInputContext, originalInputType]);
    
    const handleClearChat = () => {
        if (chatHistory.length === 0) return;
        setChatHistory([]);
        setChatError(null);
        toast("Chat history cleared.", { icon: '🗑️' });
    };

    const handleMoreInstructions = useCallback(async () => {
        if (!hasMoreInstructions || isLoadingInstructions) return;
        setIsLoadingInstructions(true);
        toast(`Fetching Level ${currentInstructionLevel + 1} instructions...`, { icon: '⏳' });
        try {
            if (!activePracticeMaterial?.questionText || !language || language === SupportedLanguage.UNKNOWN) {
                throw new Error("Missing context for fetching more instructions.");
            }
            const response = await getMoreInstructionsFromGemini(
                activePracticeMaterial.questionText, displayedInstructions, language, currentInstructionLevel
            );
            if (response.newInstructionSteps && response.newInstructionSteps.length > 0) {
                const actualNewSteps = response.newInstructionSteps.filter(step => !step.toLowerCase().includes("no further") && !step.toLowerCase().includes("not beneficial") && step.trim() !== "");
                if (actualNewSteps.length > 0) {
                    setDisplayedInstructions(prev => [...prev, ...actualNewSteps]);
                    setCurrentInstructionLevel(prev => prev + 1);
                    toast.success(`Level ${currentInstructionLevel + 1} instructions loaded!`, { icon: '📚' });
                } else if (response.newInstructionSteps.length > 0 && response.newInstructionSteps[0].trim() !== "") {
                    toast(response.newInstructionSteps[0], { icon: 'ℹ️' });
                } else {
                    toast("No more detailed instructions available for this level.", { icon: 'ℹ️' });
                }
            } else {
                toast("No more detailed instructions available.", { icon: 'ℹ️' });
            }
            setHasMoreInstructions(response.hasMoreLevels);
        } catch (err) {
            const msg = err instanceof Error ? err.message : "Failed to fetch more instructions.";
            toast.error(msg);
            console.error("Error fetching more instructions:", err);
        } finally {
            setIsLoadingInstructions(false);
        }
    }, [activePracticeMaterial, displayedInstructions, language, currentInstructionLevel, hasMoreInstructions, isLoadingInstructions]);
    
    useEffect(() => {
        setEditableExampleCode(currentExampleCode);
        setExampleExecutionResult(null);
        setExampleExecutionError(null);
    }, [currentExampleCode]);
    
    const handleRunExampleCode = useCallback(async () => {
        setIsExecutingExample(true);
        setExampleExecutionResult(null);
        setExampleExecutionError(null);
        try {
            if (!language || language === SupportedLanguage.UNKNOWN) {
                throw new Error("Language not identified, cannot execute code.");
            }
            const output = await executeCodeWithGemini(editableExampleCode, language);
            setExampleExecutionResult(output);
            toast.success("Code executed successfully!");
        } catch (err) {
            const msg = err instanceof Error ? err.message : "An unknown error occurred during execution.";
            setExampleExecutionError(msg);
            toast.error("Execution failed.");
            console.error(err);
        } finally {
            setIsExecutingExample(false);
        }
    }, [editableExampleCode, language]);

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

    const robustExampleCodeHighlight = (code: string) => {
        if (typeof Prism === 'undefined' || !Prism.highlight || !code) return escapeHtml(code || '');
        try {
            const langGrammar = Prism.languages[prismLanguageForEditor] || Prism.languages.clike;
            if (langGrammar) return Prism.highlight(code, langGrammar, prismLanguageForEditor);
        } catch (e) { console.warn(`Error highlighting example code with ${prismLanguageForEditor}:`, e); }
        return escapeHtml(code);
    };
    
    const renderChatMessageContent = (text: string) => { 
        if (!text) return null;
        const formattedText = text.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>').replace(/\*(.*?)\*/g, '<em>$1</em>');       
        return formattedText.split('\n').map((paragraph, index) => <p key={index} className="mb-1 last:mb-0" dangerouslySetInnerHTML={{ __html: paragraph }}></p>);
    };

    const topicExplanationSection = visibleSections.topicExplanation.masterToggle && (
        <section aria-labelledby="topic-explanation-main-title">
            <h3 id="topic-explanation-main-title" className="text-lg font-semibold text-white mb-2 flex items-center">
                <span className="material-icons-outlined text-indigo-400 mr-2 text-xl">school</span>Topic Explanation
            </h3>
            <div className="bg-gray-700/20 p-1.5 sm:p-2 rounded-lg border border-gray-600/40 divide-y divide-gray-700/50">
                {visibleSections.topicExplanation.coreConcepts && <CollapsibleSection title="Core Concepts Explained" content={coreConcepts} isExpandedInitially={false} iconName="lightbulb" />}
                {visibleSections.topicExplanation.blockByBlock && <BlockByBlockBreakdownSection breakdown={blockByBlockBreakdown} language={language} />}
                {visibleSections.topicExplanation.lineByLine && <LineByLineBreakdownSection breakdown={lineByLineBreakdown} language={language} />}
                
                {/* Collapsible Chat Section */}
                {visibleSections.topicExplanation.followUp && (
                    <div className="py-2">
                        <div className="flex justify-between items-center text-left text-sm font-medium text-gray-100 p-2 rounded-md hover:bg-gray-700/40 transition-colors focus-within:ring-1 focus-within:ring-indigo-500 focus-within:ring-offset-1 focus-within:ring-offset-gray-800">
                             <button type="button" onClick={() => setIsChatExpanded(!isChatExpanded)} className="flex items-center flex-grow" aria-expanded={isChatExpanded} aria-controls="collapsible-chat-content">
                                <span className="material-icons-outlined text-indigo-400 mr-2 text-base">forum</span>
                                Conversational Chat
                                <span className={`material-icons-outlined text-lg ml-2 transform transition-transform duration-200 ${isChatExpanded ? 'rotate-180' : 'rotate-0'}`}>
                                    expand_more
                                </span>
                            </button>
                            <div className="flex items-center gap-1">
                                <button type="button" onClick={handleClearChat} disabled={chatHistory.length === 0} title="Clear chat history" className="p-1.5 rounded-full text-gray-400 hover:text-white hover:bg-gray-600/70 transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
                                    <span className="material-icons-outlined text-sm">delete</span>
                                </button>
                                <button type="button" onClick={() => setIsFullScreenChatOpen(true)} title="Open in full-screen" className="p-1.5 rounded-full text-gray-400 hover:text-white hover:bg-gray-600/70 transition-colors">
                                    <span className="material-icons-outlined text-sm">open_in_full</span>
                                </button>
                            </div>
                        </div>

                        <div id="collapsible-chat-content" className={`transition-all duration-300 ease-in-out overflow-hidden ${isChatExpanded ? 'max-h-[30rem] opacity-100 mt-2' : 'max-h-0 opacity-0'}`} style={{ transitionProperty: 'max-height, opacity, margin-top' }}>
                            <div className="pl-3 pr-2 py-1.5 border-l-2 border-gray-700/60 space-y-3">
                                <div ref={chatContainerRef} className="bg-gray-700/40 border border-gray-600/50 rounded-lg p-2 sm:p-3 h-64 overflow-y-auto custom-scrollbar-small flex flex-col space-y-3">
                                    {chatHistory.map((msg, index) => (
                                        <div key={index} className={`flex items-start gap-2.5 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                                            {msg.role === 'ai' && <span className="material-icons-outlined text-indigo-400 text-lg flex-shrink-0 mt-1">assistant</span>}
                                            <div className={`max-w-xs md:max-w-md p-2 rounded-lg text-xs leading-normal whitespace-pre-wrap ${msg.role === 'user' ? 'bg-indigo-600 text-white' : 'bg-gray-600 text-gray-200'}`}>
                                                {renderChatMessageContent(msg.content)}
                                            </div>
                                            {msg.role === 'user' && <span className="material-icons-outlined text-gray-400 text-lg flex-shrink-0 mt-1">account_circle</span>}
                                        </div>
                                    ))}
                                    {isChatLoading && (
                                        <div className="flex items-start gap-2.5 justify-start">
                                            <span className="material-icons-outlined text-indigo-400 text-lg flex-shrink-0 mt-1">assistant</span>
                                            <div className="bg-gray-600 p-2 rounded-lg flex items-center space-x-1">
                                                <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-pulse delay-0"></span>
                                                <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-pulse delay-200"></span>
                                                <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-pulse delay-400"></span>
                                            </div>
                                        </div>
                                    )}
                                    {chatError && <ErrorMessage message={chatError} />}
                                </div>
                                <div className="flex items-center gap-2">
                                    <textarea id="follow-up-question" rows={1} value={userMessage} onChange={(e) => setUserMessage(e.target.value)} onKeyDown={(e) => { if(e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSendMessage(); } }} placeholder="Ask a follow-up..." className="flex-grow w-full bg-gray-700/60 border border-gray-600 text-gray-200 rounded-md p-2 text-xs focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 placeholder-gray-500 transition-colors custom-scrollbar-small resize-none" disabled={isChatLoading} />
                                    <button type="button" onClick={handleSendMessage} disabled={isChatLoading || !userMessage.trim()} className="bg-indigo-600 hover:bg-indigo-700 text-white font-medium p-2 rounded-md flex items-center justify-center transition-colors focus:outline-none focus:ring-1 focus:ring-indigo-500 ring-offset-1 ring-offset-gray-800 disabled:bg-gray-600 disabled:text-gray-400 disabled:cursor-not-allowed shadow" aria-label="Send message">
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
            <h3 id="visual-flow-title" className="text-lg font-semibold text-white mb-3 flex items-center">
                <span className="material-icons-outlined text-indigo-400 mr-2 text-xl">play_circle_outline</span>Visual Execution Flow
            </h3>
            <VisualFlowPlayer
                flowSteps={visualExecutionFlow}
                code={originalInputType === 'code' ? originalInputContext : result.exampleCode}
                language={language}
            />
        </section>
    );

    const exampleCodeSection = visibleSections.exampleCode && (
        <section aria-labelledby="example-code-title">
            <h3 id="example-code-title" className="text-lg font-semibold text-white mb-3 flex items-center">
                <span className="material-icons-outlined text-indigo-400 mr-2 text-xl">code_blocks</span>Editable Example Code
            </h3>
            <div className="flex flex-wrap items-center gap-2 mb-3">
                <span className="text-xs text-gray-400 mr-1">Difficulty:</span>
                {ExampleDifficultyLevels.map(level => (
                    <button key={level} type="button" onClick={() => handleDifficultyChange(level)} disabled={isExampleLoading} className={`px-2.5 py-1 rounded-full text-xs font-medium transition-colors focus:outline-none focus:ring-1 ring-offset-1 ring-offset-gray-800 shadow-sm ${selectedExampleDifficulty === level ? 'bg-indigo-600 text-white hover:bg-indigo-700 focus:ring-indigo-500' : 'bg-gray-700 hover:bg-gray-600 text-gray-300 focus:ring-indigo-600'} ${isExampleLoading && selectedExampleDifficulty !== level ? 'cursor-not-allowed opacity-60' : ''} ${isExampleLoading && selectedExampleDifficulty === level ? 'animate-pulse' : ''}`} aria-pressed={selectedExampleDifficulty === level}>
                        {ExampleDifficultyDisplayNames[level]}
                    </button>
                ))}
            </div>
            {isExampleLoading && <div className="flex items-center justify-center p-3 bg-gray-700/20 rounded-md my-2 text-xs"><div className="w-3.5 h-3.5 border-2 border-indigo-400 border-t-transparent rounded-full animate-spin mr-2"></div><span className="text-gray-400">Generating {ExampleDifficultyDisplayNames[selectedExampleDifficulty]} example...</span></div>}
            {exampleError && !isExampleLoading && <ErrorMessage message={`Failed to load example: ${exampleError}`} />}
            {!isExampleLoading && currentExampleCode && (
                <>
                    <div className="bg-gray-900/60 border border-gray-600 rounded-md overflow-hidden focus-within:ring-1 focus-within:ring-indigo-500 focus-within:border-indigo-500 custom-scrollbar-small shadow-sm">
                        <Editor
                            value={editableExampleCode}
                            onValueChange={code => setEditableExampleCode(code)}
                            highlight={robustExampleCodeHighlight}
                            padding={12}
                            textareaClassName="code-editor-textarea !text-gray-200 !font-fira-code"
                            preClassName="code-editor-pre !font-fira-code"
                            className="text-xs min-h-[160px] max-h-[320px] overflow-y-auto"
                            disabled={isExecutingExample}
                            placeholder={`// Editable ${LanguageDisplayNames[language || SupportedLanguage.UNKNOWN]} example code...`}
                            aria-label="Editable example code area"
                        />
                    </div>
                    <div className="mt-3 flex flex-wrap gap-2">
                        <button
                            type="button"
                            onClick={handleRunExampleCode}
                            disabled={isExecutingExample}
                            className="bg-green-600 hover:bg-green-700 text-white font-medium py-1.5 px-3 rounded-md flex items-center gap-1.5 transition-colors text-xs shadow focus:outline-none focus:ring-2 focus:ring-green-500 ring-offset-1 ring-offset-gray-800 disabled:bg-gray-600 disabled:text-gray-400 disabled:cursor-not-allowed"
                        >
                            {isExecutingExample ? (
                                <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                            ) : (
                                <span className="material-icons-outlined text-sm">play_arrow</span>
                            )}
                            <span>{isExecutingExample ? 'Running...' : 'Run Code'}</span>
                        </button>
                        <button
                            type="button"
                            onClick={() => {
                                setEditableExampleCode(currentExampleCode);
                                setExampleExecutionResult(null);
                                setExampleExecutionError(null);
                                toast('Example code has been reset.', { icon: '🔄' });
                            }}
                            disabled={isExecutingExample || editableExampleCode === currentExampleCode}
                            className="bg-gray-600 hover:bg-gray-500 text-white font-medium py-1.5 px-3 rounded-md flex items-center gap-1 transition-colors text-xs shadow focus:outline-none focus:ring-1 focus:ring-indigo-500 ring-offset-1 ring-offset-gray-800 disabled:opacity-60 disabled:cursor-not-allowed"
                        >
                            <span className="material-icons-outlined text-sm">restart_alt</span>
                            Reset
                        </button>
                    </div>

                    {exampleExecutionError && <ErrorMessage message={exampleExecutionError} />}
                    
                    {exampleExecutionResult !== null && !exampleExecutionError && (
                        <TerminalOutput output={exampleExecutionResult} title="Live Execution Output" />
                    )}
                    {exampleExecutionResult === null && !exampleExecutionError && (
                        <TerminalOutput output={currentExampleCodeOutput} title="Original Expected Output" />
                    )}
                </>
            )}
        </section>
    );

    const practiceQuestionSection = visibleSections.practiceQuestion && activePracticeMaterial && (
        <section aria-labelledby="practice-question-title">
            <div className="flex justify-between items-center mb-3 flex-wrap gap-2">
                <h3 id="practice-question-title" className="text-lg font-semibold text-white flex items-center">
                    <span className="material-icons-outlined text-indigo-400 mr-2 text-xl">quiz</span>Practice
                </h3>
                <div className="bg-gray-700/60 p-1 rounded-md flex items-center gap-1 text-xs shadow-sm" role="tablist" aria-orientation="horizontal">
                     {(['generated', 'userCode'] as const).map(mode => (
                        <button key={mode} onClick={() => setPracticeMode(mode)} className={`px-2.5 py-1.5 rounded-sm font-medium transition-colors focus:outline-none focus:ring-1 focus:ring-offset-1 focus:ring-offset-gray-700 ${practiceMode === mode ? 'bg-indigo-600 text-white focus:ring-indigo-500' : 'bg-transparent text-gray-300 hover:bg-gray-600/70 focus:ring-indigo-600'}`} role="tab" aria-selected={practiceMode === mode} aria-controls="practice-panel">
                            {mode === 'generated' ? 'Generated Question' : 'Solve Your Code'}
                        </button>
                    ))}
                </div>
            </div>
            
            <div id="practice-panel" role="tabpanel">
                <div className="bg-gray-700/30 p-3 sm:p-4 rounded-lg border border-gray-600/50 mb-4">
                    <h4 className="text-md font-semibold text-indigo-300 mb-2">
                        {activePracticeMaterial.title}
                    </h4>
                    <div className="text-sm text-gray-300 leading-relaxed prose prose-sm prose-invert max-w-none">
                        {activePracticeMaterial.questionText.split('\n').map((line, index) => <p key={index}>{line}</p>)}
                    </div>
                </div>

                {practiceMode === 'generated' && (
                    <div className="flex flex-wrap items-center gap-2 mb-4">
                        <span className="text-xs text-gray-400 mr-1">Difficulty:</span>
                        {ExampleDifficultyLevels.map(level => (
                            <button key={level} type="button" onClick={() => handlePracticeDifficultyChange(level)} disabled={isPracticeQuestionLoading} className={`px-2.5 py-1 rounded-full text-xs font-medium transition-colors focus:outline-none focus:ring-1 ring-offset-1 ring-offset-gray-800 shadow-sm ${selectedPracticeDifficulty === level ? 'bg-indigo-600 text-white hover:bg-indigo-700 focus:ring-indigo-500' : 'bg-gray-700 hover:bg-gray-600 text-gray-300 focus:ring-indigo-600'} ${isPracticeQuestionLoading && selectedPracticeDifficulty !== level ? 'cursor-not-allowed opacity-60' : ''} ${isPracticeQuestionLoading && selectedPracticeDifficulty === level ? 'animate-pulse' : ''}`} aria-pressed={selectedPracticeDifficulty === level}>
                                {ExampleDifficultyDisplayNames[level]}
                            </button>
                        ))}
                    </div>
                )}


                {isPracticeQuestionLoading && <div className="flex items-center justify-center p-3 bg-gray-700/20 rounded-md my-2 text-xs"><div className="w-3.5 h-3.5 border-2 border-indigo-400 border-t-transparent rounded-full animate-spin mr-2"></div><span className="text-gray-400">Generating new practice question...</span></div>}
                {practiceQuestionError && !isPracticeQuestionLoading && <ErrorMessage message={`Failed to load practice question: ${practiceQuestionError}`} />}

                {!isPracticeQuestionLoading && (
                    <>
                        {visibleSections.instructionsToSolve && (
                            <div className="mb-4">
                                <div className="flex justify-between items-center mb-2 flex-wrap gap-2">
                                    <h4 className="text-md font-semibold text-gray-100 flex items-center">
                                        <span className="material-icons-outlined text-base text-indigo-400 mr-1.5">integration_instructions</span>
                                        Instructions to Solve
                                    </h4>
                                    <div className="bg-gray-700/60 p-1 rounded-md flex items-center gap-1 text-xs shadow-sm">
                                        {(['normal', 'line-by-line'] as const).map(format => (
                                            <button key={format} onClick={() => setInstructionFormat(format)} className={`px-2 py-1 rounded-sm font-medium transition-colors focus:outline-none focus:ring-1 focus:ring-offset-1 focus:ring-offset-gray-700 ${instructionFormat === format ? 'bg-indigo-600 text-white focus:ring-indigo-500' : 'bg-transparent text-gray-300 hover:bg-gray-600/70 focus:ring-indigo-600'}`} aria-pressed={instructionFormat === format}>
                                                {format === 'normal' ? 'Conceptual' : 'Line-by-Line'}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                                {instructionFormat === 'normal' && (
                                    <div className="mt-2">
                                        <p className="text-sm italic text-gray-400 mb-2">Conceptual, step-by-step guidance. Level {currentInstructionLevel}.</p>
                                        {renderInstructionSteps(displayedInstructions)}
                                        <div className="mt-3 flex flex-wrap gap-2">
                                            {hasMoreInstructions && <button type="button" onClick={handleMoreInstructions} disabled={isLoadingInstructions} className="bg-gray-600 hover:bg-gray-500 text-white font-medium py-1.5 px-3 rounded-md flex items-center gap-1 transition-colors text-xs shadow focus:outline-none focus:ring-1 focus:ring-indigo-500 ring-offset-1 ring-offset-gray-800 disabled:opacity-60 disabled:cursor-not-allowed">{isLoadingInstructions ? (<><div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin mr-1.5"></div><span>Loading...</span></>) : (<><span className="material-icons-outlined text-sm">unfold_more</span>More Instructions</>)}</button>}
                                            <button type="button" onClick={() => setShowSolution(!showSolution)} className="bg-indigo-600 hover:bg-indigo-700 text-white font-medium py-1.5 px-3 rounded-md flex items-center gap-1 transition-colors text-xs shadow focus:outline-none focus:ring-1 focus:ring-indigo-400 ring-offset-1 ring-offset-gray-800">
                                                <span className="material-icons-outlined text-sm">{showSolution ? 'visibility_off' : 'visibility'}</span>{showSolution ? 'Hide Solution' : 'Show Solution'}
                                            </button>
                                        </div>
                                    </div>
                                )}
                                {instructionFormat === 'line-by-line' && (
                                    <div className="mt-2">
                                        <p className="text-sm italic text-gray-400 mb-3">Code construction guidance, one step at a time.</p>
                                        <div className="max-h-80 overflow-y-auto custom-scrollbar-small pr-2">
                                            {renderInstructionSteps(activePracticeMaterial.lineByLineInstructions)}
                                        </div>
                                        <div className="mt-3 flex flex-wrap gap-2">
                                            <button type="button" onClick={() => setShowSolution(!showSolution)} className="bg-indigo-600 hover:bg-indigo-700 text-white font-medium py-1.5 px-3 rounded-md flex items-center gap-1 transition-colors text-xs shadow focus:outline-none focus:ring-1 focus:ring-indigo-400 ring-offset-1 ring-offset-gray-800">
                                                <span className="material-icons-outlined text-sm">{showSolution ? 'visibility_off' : 'visibility'}</span>{showSolution ? 'Hide Solution' : 'Show Solution'}
                                            </button>
                                        </div>
                                    </div>
                                )}
                                {showSolution && activePracticeMaterial.solutionCode && (
                                    <div className="mt-4 p-3 bg-gray-700/30 rounded-lg border border-gray-600/50">
                                        <h5 className="text-sm font-semibold text-gray-100 mb-2">AI Generated Solution:</h5>
                                        <CodeBlock code={activePracticeMaterial.solutionCode} language={language} idSuffix="solution" />
                                        {activePracticeMaterial.solutionOutput && <TerminalOutput output={activePracticeMaterial.solutionOutput} title="Solution Output" />}
                                    </div>
                                )}
                            </div>
                        )}
                        <div>
                            <label htmlFor="practice-solution" className="block text-sm font-medium text-gray-400 mb-1.5">Your Solution ({LanguageDisplayNames[language || SupportedLanguage.UNKNOWN]}):</label>
                            <div className="bg-gray-900/60 border border-gray-600 rounded-md overflow-hidden focus-within:ring-1 focus-within:ring-indigo-500 focus-within:border-indigo-500 custom-scrollbar-small shadow-sm">
                                <Editor value={practiceSolution} onValueChange={code => setPracticeSolution(code)} highlight={robustPracticeSolutionHighlight} padding={12} textareaClassName="code-editor-textarea !text-gray-200 !font-fira-code" preClassName="code-editor-pre !font-fira-code" className="text-xs min-h-[160px] max-h-[320px] overflow-y-auto" disabled={isCheckingSolution} placeholder={`// Enter your ${LanguageDisplayNames[language || SupportedLanguage.UNKNOWN]} code here...`} aria-label="Practice solution input area" />
                            </div>
                            <div className="mt-3 flex flex-col sm:flex-row justify-end items-center gap-2.5">
                                {isCheckingSolution && <div className="w-4 h-4 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin order-first sm:order-none"></div>}
                                <button type="button" onClick={handleCheckSolution} disabled={isCheckSolutionDisabled} className="w-full sm:w-auto bg-indigo-600 hover:bg-indigo-700 text-white font-medium py-2 px-4 rounded-md flex items-center justify-center gap-1.5 transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500 ring-offset-1 ring-offset-gray-800 disabled:bg-gray-600 disabled:text-gray-400 text-xs shadow">
                                    <span className="material-icons-outlined text-base">{isCheckingSolution ? 'hourglass_empty' : 'play_circle_filled'}</span>{isCheckingSolution ? 'Running & Checking...' : "Run & Get AI Feedback"}
                                </button>
                            </div>
                            {solutionError && <div className="mt-2.5"><ErrorMessage message={solutionError} /></div>}
                            {(userSolutionAnalysis || actualSolutionOutput) && !isCheckingSolution && (() => {
                                const assessmentDetails = userSolutionAnalysis ? getAssessmentDetails(userSolutionAnalysis.assessmentStatus, userSolutionAnalysis.isCorrect) : null;
                                return (
                                    <div ref={solutionFeedbackRef} className="mt-4 p-3.5 bg-gray-700/30 rounded-lg border border-gray-600/50 shadow-md">
                                        <h4 className="text-sm font-semibold text-gray-100 mb-2 flex items-center gap-1.5"><span className="material-icons-outlined text-base text-indigo-400">comment</span>AI Feedback:</h4>
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
                                                <h5 className="text-xs font-semibold text-gray-200 mb-1">Detailed Feedback:</h5>
                                                <div className="text-xs text-gray-300 leading-relaxed whitespace-pre-wrap prose prose-xs prose-invert max-w-none">{userSolutionAnalysis.feedback.split('\n').map((line, index) => <p key={index}>{line}</p>)}</div>
                                            </div>
                                        )}
                                    </div>
                                );
                            })()}
                        </div>
                    </>
                )}
            </div>
        </section>
    );

    const allSections = [
        { key: 'topicExplanation', content: topicExplanationSection },
        { key: 'visualExecutionFlow', content: visualExecutionFlowSection },
        { key: 'exampleCode', content: exampleCodeSection },
        { key: 'practiceQuestion', content: practiceQuestionSection },
    ].filter(s => s.content);

    return (
        <div className="w-full text-left">
            {allSections.map((section, index) => (
                <React.Fragment key={section.key}>
                    {index > 0 && <div className="border-t border-gray-700/60 my-6 sm:my-8"></div>}
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