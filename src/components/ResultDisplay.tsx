import React, { useState, useCallback, useEffect } from 'react';
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
    PracticeMaterial 
} from '../types'; 
import { LanguageDisplayNames } from '../types'; 
import { TerminalOutput } from './TerminalOutput';
import { 
    checkUserSolutionWithGemini, 
    getExampleByDifficulty, askFollowUpQuestionWithGemini, getMoreInstructionsWithGemini
} from '../services/geminiService'; 
import { ErrorMessage } from './ErrorMessage'; 
import { CodeBlock, getPrismLanguageString } from './CodeBlock'; 
import { escapeHtml } from '../utils/textUtils'; // Import centralized utility


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
      if (!text || text.trim().toLowerCase() === "n/a" || text.trim().toLowerCase() === "not applicable") {
        return <p className="text-sm text-gray-400 italic">This section is not applicable for the current analysis or was not provided.</p>;
      }
      return text
        .split('\n')
        .map(line => line.trim())
        .filter(line => line.length > 0)
        .map((paragraph, index) => (
            <p key={index} 
               dangerouslySetInnerHTML={{ 
                   __html: paragraph
                    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>') 
                    .replace(/\*(.*?)\*/g, '<em>$1</em>')       
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
                className={`transition-all duration-300 ease-in-out overflow-hidden ${isExpanded ? 'max-h-[1500px] opacity-100' : 'max-h-0 opacity-50'}`}
                style={{ transitionProperty: 'max-height, opacity' }}
            >
                <div className="mt-1.5 pl-3 pr-2 py-1.5 border-l-2 border-gray-700/60">
                     <div className="text-sm text-gray-300 leading-relaxed prose prose-sm prose-invert max-w-none">
                        {renderFormattedContent(content)}
                    </div>
                </div>
            </div>
        </div>
    );
};
const CollapsibleSection = React.memo(CollapsibleSectionComponent);


const renderInstructionList = (instructionsString: string | undefined) => {
    if (!instructionsString || instructionsString.trim() === "") {
        return <p className="text-sm text-gray-400 italic">No instructions provided for this level, or this level is not applicable.</p>;
    }
    return (
        <ul className="list-none text-sm text-gray-300 space-y-2 leading-relaxed">
            {instructionsString.split('\n').map((line, index) => {
                const trimmedLine = line.trim().replace(/^(\d+\.|-|\*|\u2022|Step\s*\d*:)\s*/i, '');
                if (trimmedLine) return (
                    <li key={index} className="flex items-start pl-1">
                        <span className="material-icons-outlined text-indigo-500 text-base mr-2.5 mt-px flex-shrink-0">chevron_right</span>
                        <span>{trimmedLine}</span>
                    </li>
                );
                return null;
            })}
        </ul>
    );
};

interface ResultDisplayProps {
    result: AnalysisResult;
    language: SupportedLanguage; 
    difficultyOfProvidedExample: ExampleDifficulty;
    originalInputContext: string; 
    originalInputType: 'code' | 'concept';
}

const ResultDisplayComponent: React.FC<ResultDisplayProps> = ({ 
    result, 
    language, 
    difficultyOfProvidedExample,
    originalInputContext,
    originalInputType
}) => {
    const [currentExampleCode, setCurrentExampleCode] = useState<string>(result.exampleCode);
    const [currentExampleCodeOutput, setCurrentExampleCodeOutput] = useState<string>(result.exampleCodeOutput);
    const [selectedExampleDifficulty, setSelectedExampleDifficulty] = useState<ExampleDifficulty>(difficultyOfProvidedExample);

    const [isExampleLoading, setIsExampleLoading] = useState<boolean>(false);
    const [exampleError, setExampleError] = useState<string | null>(null);
    const [showExampleOutput, setShowExampleOutput] = useState(false);

    const [practiceSolution, setPracticeSolution] = useState('');
    const [userSolutionAnalysis, setUserSolutionAnalysis] = useState<UserSolutionAnalysis | null>(null);
    const [isCheckingSolution, setIsCheckingSolution] = useState<boolean>(false);
    const [solutionError, setSolutionError] = useState<string | null>(null);

    const [followUpQuestionText, setFollowUpQuestionText] = useState<string>('');
    const [followUpAnswer, setFollowUpAnswer] = useState<string | null>(null);
    const [isAskingFollowUp, setIsAskingFollowUp] = useState<boolean>(false);
    const [followUpError, setFollowUpError] = useState<string | null>(null);

    const [showUserSolution, setShowUserSolution] = useState<boolean>(false);
    const [userSolutionInput, setUserSolutionInput] = useState<string>('');
    const [userSolutionFeedback, setUserSolutionFeedback] = useState<UserSolutionAnalysis | null>(null);
    const [isCheckingSolution, setIsCheckingSolution] = useState<boolean>(false);
    const [practiceAttempted, setPracticeAttempted] = useState<boolean>(false);

    // Progressive instruction states
    const [displayedInstructions, setDisplayedInstructions] = useState<string[]>([]);
    const [currentInstructionLevel, setCurrentInstructionLevel] = useState<number>(1);
    const [hasMoreInstructions, setHasMoreInstructions] = useState<boolean>(true);
    const [isLoadingInstructions, setIsLoadingInstructions] = useState<boolean>(false);
    const [showSolution, setShowSolution] = useState<boolean>(false);
    const [isLoadingSolution, setIsLoadingSolution] = useState<boolean>(false);

    const [instructionsExpanded, setInstructionsExpanded] = useState<boolean>(false);

    const { coreConcepts, lineByLineBreakdown, executionFlowAndDataTransformation } = result.topicExplanation;
    const { practiceSection } = result; 
    const instructionLevels = practiceSection?.instructionLevels || [];
    const MAX_INSTRUCTION_LEVEL_INDEX = instructionLevels.length - 1;

    useEffect(() => {
        setCurrentExampleCode(result.exampleCode);
        setCurrentExampleCodeOutput(result.exampleCodeOutput);
        setSelectedExampleDifficulty(difficultyOfProvidedExample);
        setShowExampleOutput(false);
        setIsExampleLoading(false);
        setExampleError(null);

        setPracticeSolution('');
        setUserSolutionAnalysis(null);
        setSolutionError(null);

        setFollowUpQuestionText('');
        setFollowUpAnswer(null);
        setIsAskingFollowUp(false);
        setFollowUpError(null);

        // Progressive Reveal Reset
        setDisplayedInstructions([]);
        setCurrentInstructionLevel(1);
        setHasMoreInstructions(true);
        setShowSolution(false);

    }, [result, difficultyOfProvidedExample]);

    useEffect(() => {
        if (result?.practiceSection?.instructionLevels && result.practiceSection.instructionLevels.length > 0) {
            setInstructionsExpanded(true);
            // Initialize with the first level of instructions
            setDisplayedInstructions([result.practiceSection.instructionLevels[0]]);
            setCurrentInstructionLevel(1);
            // Assume there are more levels initially (will be determined by AI)
            setHasMoreInstructions(result.practiceSection.instructionLevels.length > 1);
        }
    }, [result]);

    const handleDifficultyChange = useCallback(async (newDifficulty: ExampleDifficulty) => {
        if (newDifficulty === selectedExampleDifficulty && !exampleError && !isExampleLoading) {
            toast(`Currently showing ${ExampleDifficultyDisplayNames[newDifficulty]} example.`, { icon: 'ℹ️' });
            return;
        }
        if (isExampleLoading) return;

        setIsExampleLoading(true); setExampleError(null); setShowExampleOutput(false); 

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

    const handleCheckSolution = useCallback(async () => {
        if (!practiceSolution.trim()) {
            setSolutionError("Please enter your solution code before checking."); setUserSolutionAnalysis(null); return;
        }
        setIsCheckingSolution(true); setSolutionError(null); setUserSolutionAnalysis(null);

        try {
            if (!language || language === SupportedLanguage.UNKNOWN) throw new Error("Language not identified, cannot check solution.");
            if (!practiceSection) throw new Error("Practice material is missing, cannot verify solution accurately.");

            const analysis = await checkUserSolutionWithGemini(
                practiceSolution, 
                language, 
                practiceSection, 
                coreConcepts 
            );
            setUserSolutionAnalysis(analysis);
            toast.success("AI feedback on your solution received!");
        } catch (err) {
            const msg = err instanceof Error ? err.message : "An unknown error occurred while checking your solution.";
            setSolutionError(msg); toast.error(msg); console.error(err);
        } finally {
            setIsCheckingSolution(false);
        }
    }, [practiceSolution, language, practiceSection, coreConcepts]);

    const handleAskFollowUpQuestion = useCallback(async () => {
        if (!followUpQuestionText.trim() || isAskingFollowUp) return;
        setIsAskingFollowUp(true);
        setFollowUpError(null);
        setFollowUpAnswer(null);
        toast("Asking AI your question...", { icon: '💬' });
        try {
            const fullExplanationForContext = `Core Concepts: ${coreConcepts}\n\nLine-by-Line Breakdown: ${lineByLineBreakdown}\n\nExecution Flow: ${executionFlowAndDataTransformation}`;
            const answer = await askFollowUpQuestionWithGemini(followUpQuestionText, fullExplanationForContext, language, originalInputContext, originalInputType);
            setFollowUpAnswer(answer);
            toast.success("AI has responded!");
        } catch (err) {
            const msg = err instanceof Error ? err.message : "Could not get an answer from AI.";
            setFollowUpError(msg); toast.error(msg);
        } finally {
            setIsAskingFollowUp(false);
        }
    }, [followUpQuestionText, coreConcepts, lineByLineBreakdown, executionFlowAndDataTransformation, language, originalInputContext, originalInputType, isAskingFollowUp]);

    const resetUserSolution = () => {
        setUserSolutionInput('');
        setUserSolutionFeedback(null);
        setPracticeAttempted(false);
    };

    const handleMoreInstructions = async () => {
        if (!result?.practiceSection?.questionText) return;

        setIsLoadingInstructions(true);
        try {
            const response = await getMoreInstructionsWithGemini(
                result.practiceSection.questionText,
                displayedInstructions,
                language,
                currentInstructionLevel
            );

            if (response.instructions.length > 0) {
                setDisplayedInstructions(prev => [...prev, ...response.instructions]);
                setCurrentInstructionLevel(response.levelNumber);
                setHasMoreInstructions(response.hasMoreLevels);
            } else {
                setHasMoreInstructions(false);
                toast.info("No more detailed instructions available for this question.");
            }
        } catch (error) {
            console.error('Error fetching more instructions:', error);
            toast.error(error instanceof Error ? error.message : 'Failed to get more instructions');
        } finally {
            setIsLoadingInstructions(false);
        }
    };

    const handleShowSolution = async () => {
        if (!result?.practiceSection?.solutionCode) {
            toast.error("Solution not available");
            return;
        }
        setShowSolution(true);
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

    const renderParagraphsForFollowUp = (text: string) => { 
      if (!text) return null;
      const formattedText = text
        .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>') 
        .replace(/\*(.*?)\*/g, '<em>$1</em>');       

      return formattedText.split('\n').map((paragraph, index) => (
        <p key={index} dangerouslySetInnerHTML={{ __html: paragraph }}></p>
      ));
    };

    const currentInstructionsContent = instructionLevels[currentInstructionLevelIndex];

    return (
        <div className="w-full text-left space-y-6 sm:space-y-8">
            <section aria-labelledby="topic-explanation-main-title">
                <h3 id="topic-explanation-main-title" className="text-lg font-semibold text-white mb-2 flex items-center">
                    <span className="material-icons-outlined text-indigo-400 mr-2 text-xl">school</span>Topic Explanation
                </h3>
                <div className="bg-gray-700/20 p-1.5 sm:p-2 rounded-lg border border-gray-600/40 divide-y divide-gray-700/50">
                    <CollapsibleSection title="Core Concepts Explained" content={coreConcepts} isExpandedInitially={false} iconName="lightbulb" />
                    <CollapsibleSection title="Line-by-Line Code Breakdown" content={lineByLineBreakdown} isExpandedInitially={false} iconName="segment" />
                    <CollapsibleSection title="Code Execution Flow & Data Transformation" content={executionFlowAndDataTransformation} isExpandedInitially={false} iconName="data_object" />
                </div>

                <div className="mt-4 pt-4 border-t border-gray-700/70 space-y-3">
                    <div>
                        <label htmlFor="follow-up-question" className="block text-xs font-medium text-gray-400 mb-1.5">Ask a Follow-up Question about the Topic:</label>
                        <textarea
                            id="follow-up-question" rows={2} value={followUpQuestionText} onChange={(e) => setFollowUpQuestionText(e.target.value)}
                            placeholder="Type your question..."
                            className="w-full bg-gray-700/60 border border-gray-600 text-gray-200 rounded-md p-2 text-xs focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 placeholder-gray-500 transition-colors custom-scrollbar-small"
                            disabled={isAskingFollowUp}
                        />
                        <button
                            type="button" onClick={handleAskFollowUpQuestion} disabled={isAskingFollowUp || !followUpQuestionText.trim()}
                            className="mt-2 bg-gray-600 hover:bg-gray-500 text-white font-medium py-1.5 px-3 rounded-md flex items-center justify-center gap-1 transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-1 focus:ring-offset-gray-800 disabled:bg-gray-700 disabled:text-gray-500 text-xs shadow"
                        >
                             {isAskingFollowUp ? <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin"></div> : <span className="material-icons-outlined text-sm">question_answer</span>}
                            {isAskingFollowUp ? 'Asking...' : 'Ask AI'}
                        </button>
                        {followUpError && <div className="mt-2"><ErrorMessage message={followUpError}/></div>}
                        {followUpAnswer && !isAskingFollowUp && (
                            <div className="mt-3 p-3 bg-gray-700/40 rounded-lg border border-gray-600/50">
                                <h5 className="text-xs font-semibold text-gray-100 mb-1.5 flex items-center gap-1">
                                    <span className="material-icons-outlined text-sm text-indigo-400">assistant</span>AI's Answer:
                                </h5>
                                <div className="text-xs text-gray-300 leading-relaxed whitespace-pre-wrap prose prose-xs prose-invert max-w-none">
                                   {renderParagraphsForFollowUp(followUpAnswer)}
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </section>

            <div className="border-t border-gray-700/60"></div>

            <section aria-labelledby="example-code-title">
                <h3 id="example-code-title" className="text-lg font-semibold text-white mb-3 flex items-center">
                    <span className="material-icons-outlined text-indigo-400 mr-2 text-xl">code_blocks</span>Example Code
                </h3>
                <div className="flex flex-wrap items-center gap-2 mb-3">
                    <span className="text-xs text-gray-400 mr-1">Difficulty:</span>
                    {ExampleDifficultyLevels.map(level => (
                        <button
                            key={level} type="button" onClick={() => handleDifficultyChange(level)} disabled={isExampleLoading}
                            className={`px-2.5 py-1 rounded-full text-xs font-medium transition-colors focus:outline-none focus:ring-1 ring-offset-1 ring-offset-gray-800 shadow-sm
                                ${selectedExampleDifficulty === level ? 'bg-indigo-600 text-white hover:bg-indigo-700 focus:ring-indigo-500' : 'bg-gray-700 hover:bg-gray-600 text-gray-300 focus:ring-indigo-600'}
                                ${isExampleLoading && selectedExampleDifficulty !== level ? 'cursor-not-allowed opacity-60' : ''}
                                ${isExampleLoading && selectedExampleDifficulty === level ? 'animate-pulse' : ''}`}
                            aria-pressed={selectedExampleDifficulty === level}
                        >
                            {ExampleDifficultyDisplayNames[level]}
                        </button>
                    ))}
                </div>

                {isExampleLoading && (
                    <div className="flex items-center justify-center p-3 bg-gray-700/20 rounded-md my-2 text-xs">
                        <div className="w-3.5 h-3.5 border-2 border-indigo-400 border-t-transparent rounded-full animate-spin mr-2"></div>
                        <span className="text-gray-400">Generating {ExampleDifficultyDisplayNames[selectedExampleDifficulty]} example...</span>
                    </div>
                )}
                {exampleError && !isExampleLoading && <ErrorMessage message={`Failed to load example: ${exampleError}`} />}

                {!isExampleLoading && currentExampleCode && (
                    <>
                        <CodeBlock code={currentExampleCode} language={language} idSuffix="example" />
                        <div className="mt-3">
                            <button
                                type="button" onClick={() => setShowExampleOutput(!showExampleOutput)}
                                className="bg-gray-700 hover:bg-gray-600 text-gray-300 border border-gray-600 hover:border-gray-500 py-1.5 px-3 rounded-md text-xs flex items-center gap-1 transition-colors focus:outline-none focus:ring-1 focus:ring-indigo-500 ring-offset-1 ring-offset-gray-800 shadow"
                                aria-expanded={showExampleOutput} aria-controls="example-output-terminal"
                            >
                                {showExampleOutput ? 'Hide' : 'Show'} Output
                                <span className={`material-icons-outlined text-base transition-transform duration-200 ${showExampleOutput ? 'rotate-180' : ''}`}>expand_more</span>
                            </button>
                            {showExampleOutput && <TerminalOutput output={currentExampleCodeOutput} title="Example Code Output" />}
                        </div>
                    </>
                )}
            </section>

            <div className="border-t border-gray-700/60"></div>

            {practiceSection && instructionLevels.length > 0 && (
            <section aria-labelledby="practice-question-title">
                <h3 id="practice-question-title" className="text-lg font-semibold text-white mb-3 flex items-center">
                    <span className="material-icons-outlined text-indigo-400 mr-2 text-xl">quiz</span>Practice Question
                </h3>
                <div className="text-sm text-gray-300 mb-4 leading-relaxed prose prose-sm prose-invert max-w-none">
                     {practiceSection.questionText.split('\n').map((line, index) => <p key={index}>{line}</p>)}
                </div>

                <div className="mb-4">
                    <h4 className="text-md font-semibold text-gray-100 mb-2 flex items-center">
                         <span className="material-icons-outlined text-base text-indigo-400 mr-1.5">integration_instructions</span>
                        Instructions to Solve (Level {currentInstructionLevelIndex + 1} of {instructionLevels.length}):
                    </h4>
                    {renderInstructionList(currentInstructionsContent)}

                    <div className="mt-3 flex flex-wrap gap-2">
                        {currentInstructionLevelIndex < MAX_INSTRUCTION_LEVEL_INDEX && (
                            <button 
                                type="button" 
                                onClick={handleMoreInstructions}
                                className="bg-gray-600 hover:bg-gray-500 text-white font-medium py-1.5 px-3 rounded-md flex items-center gap-1 transition-colors text-xs shadow focus:outline-none focus:ring-1 focus:ring-indigo-500 ring-offset-1 ring-offset-gray-800"
                            >
                                <span className="material-icons-outlined text-sm">unfold_more</span>
                                More Instructions
                            </button>
                        )}
                        <button 
                            type="button" 
                            onClick={() => setShowSolution(!showSolution)}
                            className="bg-indigo-600 hover:bg-indigo-700 text-white font-medium py-1.5 px-3 rounded-md flex items-center gap-1 transition-colors text-xs shadow focus:outline-none focus:ring-1 focus:ring-indigo-400 ring-offset-1 ring-offset-gray-800"
                        >
                            <span className="material-icons-outlined text-sm">{showSolution ? 'visibility_off' : 'visibility'}</span>
                            {showSolution ? 'Hide Solution' : 'Show Solution'}
                        </button>
                    </div>

                    {showSolution && practiceSection.solutionCode && (
                        <div className="mt-4 p-3 bg-gray-700/30 rounded-lg border border-gray-600/50">
                            <h5 className="text-sm font-semibold text-gray-100 mb-2">AI Generated Solution:</h5>
                            <CodeBlock code={practiceSection.solutionCode} language={language} idSuffix="solution" />
                            {practiceSection.solutionOutput && (
                                <TerminalOutput output={practiceSection.solutionOutput} title="Solution Output" />
                            )}
                        </div>
                    )}
                </div>

                <div>
                    <label htmlFor="practice-solution" className="block text-sm font-medium text-gray-400 mb-1.5">
                        Your Solution ({LanguageDisplayNames[language || SupportedLanguage.UNKNOWN]}):
                    </label>
                    <div className="bg-gray-700/60 border border-gray-600 rounded-md overflow-hidden focus-within:ring-1 focus-within:ring-indigo-500 focus-within:border-indigo-500 custom-scrollbar-small shadow-sm">
                        <Editor
                            value={practiceSolution} onValueChange={code => setPracticeSolution(code)}
                            highlight={robustPracticeSolutionHighlight} padding={12}
                            textareaClassName="code-editor-textarea !text-gray-200 !font-fira-code" preClassName="code-editor-pre !font-fira-code"
                            className="text-xs min-h-[160px] max-h-[320px] overflow-y-auto"
                            disabled={isCheckingSolution}
                            placeholder={`// Enter your ${LanguageDisplayNames[language || SupportedLanguage.UNKNOWN]} code here...`}
                            aria-label="Practice solution input area"
                        />
                    </div>
                     <div className="mt-3 flex flex-col sm:flex-row justify-end items-center gap-2.5">
                        {isCheckingSolution && <div className="w-4 h-4 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin order-first sm:order-none"></div>}
                        <button
                            type="button" onClick={handleCheckSolution} disabled={isCheckSolutionDisabled}
                            className="w-full sm:w-auto bg-indigo-600 hover:bg-indigo-700 text-white font-medium py-2 px-4 rounded-md flex items-center justify-center gap-1.5 transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500 ring-offset-1 ring-offset-gray-800 disabled:bg-gray-600 disabled:text-gray-400 text-xs shadow"
                        >
                            <span className="material-icons-outlined text-base">{isCheckingSolution ? 'hourglass_empty' : 'check_circle'}</span>
                            {isCheckingSolution ? 'Checking...' : "Check Solution"}
                        </button>
                    </div>

                    {solutionError && <div className="mt-2.5"><ErrorMessage message={solutionError} /></div>}

                    {userSolutionAnalysis && !isCheckingSolution && (
                        <div className="mt-4 p-3.5 bg-gray-700/30 rounded-lg border border-gray-600/50 shadow-md">
                            <h4 className="text-sm font-semibold text-gray-100 mb-2 flex items-center gap-1.5">
                                <span className="material-icons-outlined text-base text-indigo-400">comment</span>AI Feedback:
                            </h4>
                            {typeof userSolutionAnalysis.isCorrect === 'boolean' && (
                                 <div className={`mb-2 p-2 rounded-md text-xs font-medium flex items-center border ${
                                     userSolutionAnalysis.isCorrect 
                                     ? 'bg-indigo-600/10 border-indigo-600/25 text-indigo-300' 
                                     : 'bg-red-700/20 border-red-600/40 text-red-300' 
                                 }`}>
                                   <span className={`material-icons-outlined mr-1.5 text-sm ${
                                       userSolutionAnalysis.isCorrect 
                                       ? 'text-indigo-400' 
                                       : 'text-red-400' 
                                       }`}>
                                       {userSolutionAnalysis.isCorrect ? 'verified' : 'error_outline'} 
                                    </span>
                                    {userSolutionAnalysis.isCorrect ? 'AI Assessment: Looks Correct!' : 'AI Assessment: Needs Revision.'}
                                </div>
                            )}
                            <TerminalOutput output={userSolutionAnalysis.predictedOutput} title="Predicted Output of Your Solution" />
                            <div className="mt-2.5">
                                <h5 className="text-xs font-semibold text-gray-200 mb-1">Detailed Feedback:</h5>
                                <div className="text-xs text-gray-300 leading-relaxed whitespace-pre-wrap prose prose-xs prose-invert max-w-none">
                                    {userSolutionAnalysis.feedback.split('\n').map((line, index) => <p key={index}>{line}</p>)}
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </section>
            )}
        </div>
    );
};

export const ResultDisplay = React.memo(ResultDisplayComponent);