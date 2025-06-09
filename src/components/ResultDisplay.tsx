
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
    ExampleDifficultyDisplayNames
} from '../types'; 
import { LanguageDisplayNames } from '../types'; 
// Card component might not be used directly if sections are part of a larger panel
// import { Card } from './Card'; 
import { TerminalOutput } from './TerminalOutput';
import { 
    checkUserSolutionWithGemini, 
    getExampleByDifficulty,
    getMoreExplanationWithGemini,
    askFollowUpQuestionWithGemini
} from '../services/geminiService'; 
import { ErrorMessage } from './ErrorMessage'; 
import { CodeBlock, getPrismLanguageString } from './CodeBlock'; 

interface ResultDisplayProps {
    result: AnalysisResult;
    language: SupportedLanguage; 
    difficultyOfProvidedExample: ExampleDifficulty;
    originalInputContext: string; 
    originalInputType: 'code' | 'concept';
}

const escapeHtml = (unsafe: string): string => {
    if (typeof unsafe !== 'string') return '';
    return unsafe
         .replace(/&/g, "&amp;")
         .replace(/</g, "&lt;")
         .replace(/>/g, "&gt;")
         .replace(/"/g, "&quot;")
         .replace(/'/g, "&#039;");
};

export const ResultDisplay: React.FC<ResultDisplayProps> = ({ 
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

    const [currentTopicExplanation, setCurrentTopicExplanation] = useState<string>(result.topicExplanation);
    const [isFetchingMoreExplanation, setIsFetchingMoreExplanation] = useState<boolean>(false);
    const [moreExplanationError, setMoreExplanationError] = useState<string | null>(null);
    const [followUpQuestionText, setFollowUpQuestionText] = useState<string>('');
    const [followUpAnswer, setFollowUpAnswer] = useState<string | null>(null);
    const [isAskingFollowUp, setIsAskingFollowUp] = useState<boolean>(false);
    const [followUpError, setFollowUpError] = useState<string | null>(null);

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
        setCurrentTopicExplanation(result.topicExplanation);
        setIsFetchingMoreExplanation(false);
        setMoreExplanationError(null);
        setFollowUpQuestionText('');
        setFollowUpAnswer(null);
        setIsAskingFollowUp(false);
        setFollowUpError(null);
    }, [result, difficultyOfProvidedExample]);

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
            const exampleData = await getExampleByDifficulty(result.topicExplanation, language, newDifficulty);
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
    }, [selectedExampleDifficulty, isExampleLoading, language, result.topicExplanation, exampleError]);

    const handleCheckSolution = useCallback(async () => {
        if (!practiceSolution.trim()) {
            setSolutionError("Please enter your solution code before checking."); setUserSolutionAnalysis(null); return;
        }
        setIsCheckingSolution(true); setSolutionError(null); setUserSolutionAnalysis(null);

        try {
            if (!language || language === SupportedLanguage.UNKNOWN) throw new Error("Language not identified, cannot check solution.");
            const analysis = await checkUserSolutionWithGemini(practiceSolution, language, result.practiceQuestion, result.topicExplanation);
            setUserSolutionAnalysis(analysis);
            toast.success("AI feedback on your solution received!");
        } catch (err) {
            const msg = err instanceof Error ? err.message : "An unknown error occurred while checking your solution.";
            setSolutionError(msg); toast.error(msg); console.error(err);
        } finally {
            setIsCheckingSolution(false);
        }
    }, [practiceSolution, language, result.practiceQuestion, result.topicExplanation]);

    const handleFetchMoreExplanation = useCallback(async () => {
        if (isFetchingMoreExplanation) return;
        setIsFetchingMoreExplanation(true);
        setMoreExplanationError(null);
        toast("Fetching more details...", { icon: '⏳' });
        try {
            const moreDetails = await getMoreExplanationWithGemini(currentTopicExplanation, language, originalInputContext, originalInputType);
            setCurrentTopicExplanation(prev => prev + "\n\n**Further Details:**\n" + moreDetails);
            toast.success("Explanation expanded!");
        } catch (err) {
            const msg = err instanceof Error ? err.message : "Could not fetch more details.";
            setMoreExplanationError(msg); toast.error(msg);
        } finally {
            setIsFetchingMoreExplanation(false);
        }
    }, [currentTopicExplanation, language, originalInputContext, originalInputType, isFetchingMoreExplanation]);

    const handleAskFollowUpQuestion = useCallback(async () => {
        if (!followUpQuestionText.trim() || isAskingFollowUp) return;
        setIsAskingFollowUp(true);
        setFollowUpError(null);
        setFollowUpAnswer(null);
        toast("Asking AI your question...", { icon: '💬' });
        try {
            const answer = await askFollowUpQuestionWithGemini(followUpQuestionText, currentTopicExplanation, language, originalInputContext, originalInputType);
            setFollowUpAnswer(answer);
            toast.success("AI has responded!");
        } catch (err) {
            const msg = err instanceof Error ? err.message : "Could not get an answer from AI.";
            setFollowUpError(msg); toast.error(msg);
        } finally {
            setIsAskingFollowUp(false);
        }
    }, [followUpQuestionText, currentTopicExplanation, language, originalInputContext, originalInputType, isAskingFollowUp]);

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
    
    // Helper for rendering paragraph text
    const renderParagraphs = (text: string) => {
        return text.split('\n').filter(p => p.trim() !== "").map((paragraph, index) => (
            <p key={index} className="mb-2 last:mb-0">{paragraph.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')}</p>
        ));
    };

    return (
        <div className="w-full text-left space-y-6 sm:space-y-8">
            {/* Topic Explanation Section */}
            <section aria-labelledby="topic-explanation-title">
                <h2 id="topic-explanation-title" className="text-xl font-semibold text-white mb-3 flex items-center">
                    <span className="material-icons text-indigo-400 mr-2">lightbulb</span>Topic Explanation
                </h2>
                <div className="text-sm text-gray-300 leading-relaxed space-y-2 prose prose-sm prose-invert max-w-none">
                   {renderParagraphs(currentTopicExplanation)}
                </div>
                <div className="mt-4 pt-4 border-t border-gray-700 space-y-4">
                    <div>
                        <button
                            type="button" onClick={handleFetchMoreExplanation} disabled={isFetchingMoreExplanation}
                            className="w-full sm:w-auto bg-gray-700 hover:bg-gray-600 text-gray-300 font-medium py-2 px-3.5 rounded-lg flex items-center justify-center gap-1.5 transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 focus:ring-offset-gray-800 disabled:opacity-60 disabled:cursor-wait text-xs shadow"
                        >
                            {isFetchingMoreExplanation ? <div className="w-4 h-4 border-2 border-gray-400 border-t-transparent rounded-full animate-spin"></div> : <span className="material-icons text-base">expand_more</span>}
                            {isFetchingMoreExplanation ? 'Loading More...' : 'Show More Explanation'}
                        </button>
                        {moreExplanationError && <div className="mt-2"><ErrorMessage message={moreExplanationError}/></div>}
                    </div>
                    <div>
                        <label htmlFor="follow-up-question" className="block text-xs font-medium text-gray-400 mb-1">Ask a Follow-up Question:</label>
                        <textarea
                            id="follow-up-question" rows={3} value={followUpQuestionText} onChange={(e) => setFollowUpQuestionText(e.target.value)}
                            placeholder="Type your question about this topic..."
                            className="w-full bg-gray-700/80 border border-gray-600 text-gray-200 rounded-lg p-2.5 text-xs focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 placeholder-gray-500 transition-colors custom-scrollbar-small"
                            disabled={isAskingFollowUp}
                        />
                        <button
                            type="button" onClick={handleAskFollowUpQuestion} disabled={isAskingFollowUp || !followUpQuestionText.trim()}
                            className="mt-2 w-full sm:w-auto bg-indigo-500 hover:bg-indigo-600 text-white font-medium py-2 px-3.5 rounded-lg flex items-center justify-center gap-1.5 transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 focus:ring-offset-gray-800 disabled:bg-gray-600 disabled:text-gray-400 text-xs shadow"
                        >
                             {isAskingFollowUp ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div> : <span className="material-icons text-base">question_answer</span>}
                            {isAskingFollowUp ? 'Asking AI...' : 'Ask AI'}
                        </button>
                        {followUpError && <div className="mt-2"><ErrorMessage message={followUpError}/></div>}
                        {followUpAnswer && !isAskingFollowUp && (
                            <div className="mt-3 p-3 bg-gray-700/50 rounded-lg border border-gray-600/70">
                                <h5 className="text-xs font-semibold text-gray-100 mb-1.5 flex items-center gap-1">
                                    <span className="material-icons text-base text-indigo-400">assistant</span>AI's Answer:
                                </h5>
                                <div className="text-xs text-gray-300 leading-relaxed whitespace-pre-wrap prose prose-xs prose-invert max-w-none">
                                   {renderParagraphs(followUpAnswer)}
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </section>

            {/* Example Code Section */}
            <section aria-labelledby="example-code-title">
                <h2 id="example-code-title" className="text-xl font-semibold text-white mb-3 flex items-center">
                    <span className="material-icons text-indigo-400 mr-2">code_blocks</span>Example Code
                </h2>
                <div className="flex flex-wrap items-center gap-2 mb-3">
                    <span className="text-xs text-gray-400 mr-1">Difficulty:</span>
                    {ExampleDifficultyLevels.map(level => (
                        <button
                            key={level} type="button" onClick={() => handleDifficultyChange(level)} disabled={isExampleLoading}
                            className={`px-2.5 py-1 rounded-full text-xs font-medium transition-colors focus:outline-none focus:ring-2 ring-offset-1 ring-offset-gray-800 shadow-sm
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
                    <div className="flex items-center justify-center p-3 bg-gray-700/30 rounded-md my-2 text-xs">
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
                                className="bg-gray-700 hover:bg-gray-600 text-gray-300 border border-gray-600 hover:border-gray-500 py-1.5 px-3 rounded-md text-xs flex items-center gap-1 transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500 ring-offset-1 ring-offset-gray-800 shadow"
                                aria-expanded={showExampleOutput} aria-controls="example-output-terminal"
                            >
                                {showExampleOutput ? 'Hide' : 'Show'} Output
                                <span className={`material-icons text-base transition-transform duration-200 ${showExampleOutput ? 'rotate-180' : ''}`}>expand_more</span>
                            </button>
                            {showExampleOutput && <TerminalOutput output={currentExampleCodeOutput} title="Example Code Output" />}
                        </div>
                    </>
                )}
            </section>

            {/* Practice Question Section */}
            <section aria-labelledby="practice-question-title">
                <h2 id="practice-question-title" className="text-xl font-semibold text-white mb-3 flex items-center">
                    <span className="material-icons text-indigo-400 mr-2">quiz</span>Practice Question
                </h2>
                <p className="text-sm text-gray-300 mb-3 leading-relaxed prose prose-sm prose-invert max-w-none">{result.practiceQuestion}</p>
                
                <div>
                    <label htmlFor="practice-solution" className="block text-sm font-medium text-gray-400 mb-1">
                        Your Solution ({LanguageDisplayNames[language || SupportedLanguage.UNKNOWN]}):
                    </label>
                    <div className="bg-gray-800 border border-gray-600 rounded-lg overflow-hidden focus-within:ring-2 focus-within:ring-indigo-500 focus-within:border-indigo-500 custom-scrollbar-small shadow-sm">
                        <Editor
                            value={practiceSolution} onValueChange={code => setPracticeSolution(code)}
                            highlight={robustPracticeSolutionHighlight} padding={12} 
                            textareaClassName="code-editor-textarea !text-gray-200" preClassName="code-editor-pre"
                            className="font-fira-code text-sm min-h-[180px] max-h-[350px] overflow-y-auto"
                            disabled={isCheckingSolution}
                            placeholder={`// Enter your ${LanguageDisplayNames[language || SupportedLanguage.UNKNOWN]} code here...`}
                            aria-label="Practice solution input area"
                        />
                    </div>
                     <div className="mt-3 flex flex-col sm:flex-row justify-end items-center gap-2.5">
                        {isCheckingSolution && <div className="w-5 h-5 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin order-first sm:order-none"></div>}
                        <button
                            type="button" onClick={handleCheckSolution} disabled={isCheckSolutionDisabled}
                            className="w-full sm:w-auto bg-indigo-500 hover:bg-indigo-600 text-white font-medium py-2 px-4 rounded-lg flex items-center justify-center gap-1.5 transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500 ring-offset-2 ring-offset-gray-800 disabled:bg-gray-600 disabled:text-gray-400 text-sm shadow"
                        >
                            <span className="material-icons text-base">{isCheckingSolution ? 'hourglass_empty' : 'check_circle'}</span>
                            {isCheckingSolution ? 'Checking...' : "Check Solution"}
                        </button>
                    </div>

                    {solutionError && <div className="mt-2"><ErrorMessage message={solutionError} /></div>}
                    
                    {userSolutionAnalysis && !isCheckingSolution && (
                        <div className="mt-4 p-3.5 bg-gray-700/40 rounded-lg border border-gray-600/60 shadow-md">
                            <h4 className="text-sm font-semibold text-gray-100 mb-2 flex items-center gap-1.5">
                                <span className="material-icons text-lg text-indigo-400">comment</span>AI Feedback:
                            </h4>
                            {typeof userSolutionAnalysis.isCorrect === 'boolean' && (
                                 <div className={`mb-2 p-2 rounded-md text-xs font-medium flex items-center border ${
                                     userSolutionAnalysis.isCorrect ? 'bg-indigo-600/15 border-indigo-600/30 text-indigo-300' : 'bg-yellow-600/15 border-yellow-600/30 text-yellow-300'
                                 }`}>
                                   <span className={`material-icons mr-1.5 text-base ${userSolutionAnalysis.isCorrect ? 'text-indigo-400' : 'text-yellow-400'}`}>
                                       {userSolutionAnalysis.isCorrect ? 'verified' : 'tips_and_updates'}
                                    </span>
                                    {userSolutionAnalysis.isCorrect ? 'Assessment: Looks Correct!' : 'Assessment: Needs Revision.'}
                                </div>
                            )}
                            <TerminalOutput output={userSolutionAnalysis.predictedOutput} title="Predicted Output of Your Solution" />
                            <div className="mt-2.5">
                                <h5 className="text-xs font-semibold text-gray-200 mb-1">Detailed Feedback:</h5>
                                <div className="text-xs text-gray-300 leading-relaxed whitespace-pre-wrap prose prose-xs prose-invert max-w-none">
                                    {renderParagraphs(userSolutionAnalysis.feedback)}
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </section>

            {/* Instructions Section */}
            <section aria-labelledby="instructions-title">
                 <h2 id="instructions-title" className="text-xl font-semibold text-white mb-3 flex items-center">
                    <span className="material-icons text-indigo-400 mr-2">rule</span>Instructions to Solve
                </h2>
                 <ul className="list-disc list-inside text-sm text-gray-300 space-y-1.5 leading-relaxed prose prose-sm prose-invert max-w-none">
                    {result.instructions.split('\n').map((line, index) => {
                        const trimmedLine = line.trim().replace(/^(\d+\.|-|\*|\u2022|Step\s*\d*:)\s*/i, '');
                        if (trimmedLine) return <li key={index} className="pl-1">{trimmedLine}</li>; 
                        return null;
                    })}
                </ul>
            </section>
        </div>
    );
};
