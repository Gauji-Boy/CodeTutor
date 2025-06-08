
import React, { useState, useCallback, useEffect } from 'react';
import toast from 'react-hot-toast';
import { 
    AnalysisResult, 
    UserSolutionAnalysis, 
    SupportedLanguage,
    ExampleDifficulty,
    ExampleDifficultyLevels,
    ExampleDifficultyDisplayNames
} from '../types'; 
import { LanguageDisplayNames } from '../types'; 
import { Card } from './Card';
import { TerminalOutput } from './TerminalOutput';
import { checkUserSolutionWithGemini, getExampleByDifficulty } from '../services/geminiService'; 
import { ErrorMessage } from './ErrorMessage'; 
import { CodeBlock } from './CodeBlock'; 

interface ResultDisplayProps {
    result: AnalysisResult;
    language: SupportedLanguage; 
    difficultyOfProvidedExample: ExampleDifficulty;
}

export const ResultDisplay: React.FC<ResultDisplayProps> = ({ result, language, difficultyOfProvidedExample }) => {
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
    }, [result, difficultyOfProvidedExample]);

    const handleDifficultyChange = useCallback(async (newDifficulty: ExampleDifficulty) => {
        if (newDifficulty === selectedExampleDifficulty && !exampleError && !isExampleLoading) {
            toast(`Already: ${ExampleDifficultyDisplayNames[newDifficulty]} example.`, { icon: 'ℹ️' });
            return;
        }
        if (isExampleLoading) return;

        setIsExampleLoading(true);
        setExampleError(null);
        setShowExampleOutput(false); 

        try {
            if (!language || language === SupportedLanguage.UNKNOWN) throw new Error("Language not set.");
            toast(`Fetching ${ExampleDifficultyDisplayNames[newDifficulty]} example...`, { icon: '⏳', duration: 2000 });
            const exampleData = await getExampleByDifficulty(result.topicExplanation, language, newDifficulty);
            setCurrentExampleCode(exampleData.exampleCode);
            setCurrentExampleCodeOutput(exampleData.exampleCodeOutput);
            setSelectedExampleDifficulty(newDifficulty);
            toast.success(`${ExampleDifficultyDisplayNames[newDifficulty]} example loaded!`);
        } catch (err) {
            const errorMsg = err instanceof Error ? err.message : "Failed to get example.";
            setExampleError(errorMsg); toast.error(errorMsg); console.error(err);
        } finally {
            setIsExampleLoading(false);
        }
    }, [selectedExampleDifficulty, isExampleLoading, language, result.topicExplanation, exampleError]);


    const handleCheckSolution = useCallback(async () => {
        if (!practiceSolution.trim()) {
            setSolutionError("Enter your solution code."); setUserSolutionAnalysis(null); return;
        }
        setIsCheckingSolution(true); setSolutionError(null); setUserSolutionAnalysis(null);

        try {
            if (!language || language === SupportedLanguage.UNKNOWN) throw new Error("Language not identified.");
            const analysis = await checkUserSolutionWithGemini(practiceSolution, language, result.practiceQuestion, result.topicExplanation);
            setUserSolutionAnalysis(analysis);
            toast.success("Solution feedback received!");
        } catch (err) {
            const msg = err instanceof Error ? err.message : "Error checking solution.";
            setSolutionError(msg); toast.error(msg); console.error(err);
        } finally {
            setIsCheckingSolution(false);
        }
    }, [practiceSolution, language, result.practiceQuestion, result.topicExplanation]);

    const isCheckSolutionDisabled = isCheckingSolution || !practiceSolution.trim();

    return (
        <div className="flex flex-col gap-6 lg:gap-8">
            <Card title="Topic Explanation" icon="lightbulb" iconColor="text-blue-400">
                <div className="prose prose-sm prose-invert max-w-none text-slate-300 leading-relaxed space-y-4">
                   {result.topicExplanation.split('\n').map((paragraph, index) => (
                        <p key={index}>{paragraph}</p>
                    ))}
                </div>
            </Card>

            <Card title="Example Code" icon="code" iconColor="text-blue-400">
                <div className="flex items-center space-x-3 mb-4">
                    <span className="text-sm text-slate-400">Example Difficulty:</span>
                    {ExampleDifficultyLevels.map(level => (
                        <button
                            key={level}
                            type="button"
                            onClick={() => handleDifficultyChange(level)}
                            disabled={isExampleLoading}
                            className={`px-3 py-1 rounded-full text-xs font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-offset-1 focus:ring-offset-slate-900
                                ${selectedExampleDifficulty === level 
                                    ? 'bg-blue-600/30 text-blue-300 hover:bg-blue-600/50 focus:ring-blue-500' // Changed active state to blue
                                    : 'bg-slate-700/50 hover:bg-slate-700 text-slate-300 focus:ring-blue-500'}
                                ${isExampleLoading ? 'cursor-not-allowed opacity-70' : ''}
                            `}
                            aria-pressed={selectedExampleDifficulty === level}
                        >
                            {ExampleDifficultyDisplayNames[level]}
                        </button>
                    ))}
                </div>

                {isExampleLoading && (
                    <div className="flex items-center justify-center p-4 bg-slate-800/60 rounded-md my-3">
                        <div className="w-4 h-4 border-2 border-blue-400 border-t-transparent rounded-full animate-spin mr-2.5"></div>
                        <span className="text-slate-400 text-xs">Generating example...</span>
                    </div>
                )}
                {exampleError && !isExampleLoading && (
                    <div className="my-2"> <ErrorMessage message={`Failed to load example: ${exampleError}`} /> </div>
                )}

                {!isExampleLoading && currentExampleCode && (
                    <>
                        <CodeBlock code={currentExampleCode} language={language} idSuffix="example" />
                        <div className="mt-4">
                            <button
                                type="button"
                                onClick={() => setShowExampleOutput(!showExampleOutput)}
                                className="bg-slate-800/50 hover:bg-blue-800/60 text-blue-300 hover:text-blue-200 border border-blue-700/50 hover:border-blue-600/70 py-2 px-3.5 rounded-lg text-sm flex items-center gap-1.5 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-1 focus:ring-offset-slate-900"
                                aria-expanded={showExampleOutput}
                                aria-controls="example-output-terminal"
                            >
                                {showExampleOutput ? 'Hide' : 'Show'} Example Output
                                <span className={`material-icons-outlined text-lg transition-transform duration-200 ${showExampleOutput ? 'rotate-180' : ''}`}>
                                    expand_more
                                </span>
                            </button>
                            {showExampleOutput && (
                                <TerminalOutput output={currentExampleCodeOutput} title="Example Code Output" />
                            )}
                        </div>
                    </>
                )}
            </Card>

            <Card title="Practice Question" icon="quiz" iconColor="text-blue-400">
                <p className="text-slate-300 mb-4 leading-relaxed prose prose-sm prose-invert max-w-none">{result.practiceQuestion}</p>
                
                <div>
                    <label htmlFor="practice-solution" className="block text-sm font-medium text-slate-400 mb-1.5">
                        Your Solution ({LanguageDisplayNames[language || SupportedLanguage.UNKNOWN]}):
                    </label>
                    <textarea
                        id="practice-solution"
                        name="practice-solution"
                        rows={10}
                        className="w-full bg-slate-800 border border-slate-700 text-slate-200 rounded-lg p-3 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 placeholder-slate-500 transition-colors font-fira-code custom-scrollbar-small"
                        placeholder={`// Enter your ${LanguageDisplayNames[language || SupportedLanguage.UNKNOWN]} code here...\n// Tip: Use the copy icon on example code as a starting point.`}
                        value={practiceSolution}
                        onChange={(e) => setPracticeSolution(e.target.value)}
                        aria-label="Practice solution input area"
                        disabled={isCheckingSolution}
                    />
                     <div className="mt-4 flex flex-col sm:flex-row justify-end items-center gap-3">
                        {isCheckingSolution && (
                            <div className="w-6 h-6 border-4 border-blue-500 border-t-transparent rounded-full animate-spin order-first sm:order-none"></div>
                        )}
                        <button
                            type="button"
                            onClick={handleCheckSolution}
                            disabled={isCheckSolutionDisabled}
                            className="w-full sm:w-auto bg-blue-600 hover:bg-blue-500 text-white font-medium py-2.5 px-5 rounded-lg flex items-center justify-center gap-2 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:ring-offset-slate-900 disabled:bg-slate-700 disabled:text-slate-500 disabled:cursor-not-allowed"
                        >
                            <span className="material-icons-outlined text-base">
                                {isCheckingSolution ? 'hourglass_empty' : 'check_circle_outline'}
                            </span>
                            {isCheckingSolution ? 'Checking...' : "Check My Solution"}
                        </button>
                    </div>

                    {solutionError && <div className="mt-3"><ErrorMessage message={solutionError} /></div>}
                    
                    {userSolutionAnalysis && !isCheckingSolution && (
                        <div className="mt-5 p-4 bg-slate-800/70 rounded-lg border border-slate-700/60">
                            <h4 className="text-md font-semibold text-slate-100 mb-2.5 flex items-center gap-1.5">
                                <span className="material-icons-outlined text-lg text-blue-400">comment</span>
                                AI Feedback:
                            </h4>
                            {typeof userSolutionAnalysis.isCorrect === 'boolean' && (
                                 <div className={`mb-3 p-2.5 rounded-md text-sm font-medium flex items-center border ${
                                     userSolutionAnalysis.isCorrect 
                                     ? 'bg-blue-600/10 border-blue-600/30 text-blue-300' // Blue for correct
                                     : 'bg-sky-600/10 border-sky-600/30 text-sky-300' // Sky blue for needs revision
                                 }`}>
                                   <span className={`material-icons-outlined mr-2 text-lg ${userSolutionAnalysis.isCorrect ? 'text-blue-400' : 'text-sky-400'}`}>
                                       {userSolutionAnalysis.isCorrect ? 'verified' : 'tips_and_updates'}
                                    </span>
                                    {userSolutionAnalysis.isCorrect ? 'Assessment: Looks Correct!' : 'Assessment: Needs Revision.'}
                                </div>
                            )}
                            <TerminalOutput output={userSolutionAnalysis.predictedOutput} title="Predicted Output of Your Solution" />
                            <div className="mt-3">
                                <h5 className="text-sm font-semibold text-slate-200 mb-1">Detailed Feedback:</h5>
                                <div className="prose prose-sm prose-invert max-w-none text-slate-300/90 leading-relaxed whitespace-pre-wrap">
                                    {userSolutionAnalysis.feedback.split('\n').map((p, i) => <p key={i}>{p}</p>)}
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </Card>

            <Card title="Instructions to Solve" icon="integration_instructions" iconColor="text-blue-400">
                 <ul className="list-disc list-inside text-slate-300 space-y-2.5 text-sm leading-relaxed prose prose-sm prose-invert max-w-none">
                    {result.instructions.split('\n').map((line, index) => {
                        const trimmedLine = line.trim().replace(/^(\d+\.|-|\*|\u2022|Step\s*\d*:)\s*/i, '');
                        if (trimmedLine) {
                           return <li key={index}>{trimmedLine}</li>; 
                        }
                        return null;
                    })}
                </ul>
            </Card>
        </div>
    );
};