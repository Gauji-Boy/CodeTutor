import React, { useState, useCallback } from 'react';
import toast from 'react-hot-toast';
import { AnalysisResult, UserSolutionAnalysis, SupportedLanguage } from '../types'; 
import { LanguageDisplayNames } from '../types'; 
import { Card } from './Card';
import { TerminalOutput } from './TerminalOutput';
import { checkUserSolutionWithGemini } from '../services/geminiService'; 
import { ErrorMessage } from './ErrorMessage'; 
import { CodeBlock } from './CodeBlock'; // Import the extracted CodeBlock

interface ResultDisplayProps {
    result: AnalysisResult;
    language: SupportedLanguage; 
}

export const ResultDisplay: React.FC<ResultDisplayProps> = ({ result, language }) => {
    const [showExampleOutput, setShowExampleOutput] = useState(false);
    const [practiceSolution, setPracticeSolution] = useState('');

    const [userSolutionAnalysis, setUserSolutionAnalysis] = useState<UserSolutionAnalysis | null>(null);
    const [isCheckingSolution, setIsCheckingSolution] = useState<boolean>(false);
    const [solutionError, setSolutionError] = useState<string | null>(null);

    const handleCheckSolution = useCallback(async () => {
        if (!practiceSolution.trim()) {
            setSolutionError("Please enter your solution code before checking.");
            setUserSolutionAnalysis(null);
            return;
        }
        setIsCheckingSolution(true);
        setSolutionError(null);
        setUserSolutionAnalysis(null);

        try {
            if (!language || language === SupportedLanguage.UNKNOWN) {
                 throw new Error("Language not identified, cannot check solution.");
            }
            const analysis = await checkUserSolutionWithGemini(
                practiceSolution,
                language,
                result.practiceQuestion,
                result.topicExplanation
            );
            setUserSolutionAnalysis(analysis);
        } catch (err) {
            if (err instanceof Error) {
                setSolutionError(err.message);
            } else {
                setSolutionError("An unknown error occurred while checking your solution.");
            }
            console.error("Error checking solution:", err);
        } finally {
            setIsCheckingSolution(false);
        }
    }, [practiceSolution, language, result.practiceQuestion, result.topicExplanation]);


    return (
        <div className="space-y-6 lg:space-y-8">
            <Card title="Topic Explanation">
                <p className="text-slate-300 leading-relaxed whitespace-pre-wrap text-base">{result.topicExplanation}</p>
            </Card>

            <Card title="Example Code">
                <CodeBlock code={result.exampleCode} language={language} idSuffix="example" />
                <div className="mt-4">
                    <button
                        type="button"
                        onClick={() => setShowExampleOutput(!showExampleOutput)}
                        className="inline-flex items-center px-4 py-2 border border-slate-600/70 text-sm font-medium rounded-lg shadow-sm text-sky-300 bg-slate-700/60 hover:bg-slate-600/80 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-slate-900 focus:ring-sky-500 transition-all duration-150"
                        aria-expanded={showExampleOutput}
                        aria-controls="example-output-terminal"
                    >
                        {showExampleOutput ? 'Hide' : 'Show'} Example Output
                         <span className={`material-icons text-xl ml-1.5 transform transition-transform duration-200 ${showExampleOutput ? 'rotate-180' : 'rotate-0'}`}>
                            expand_more
                        </span>
                    </button>
                    {showExampleOutput && (
                        <TerminalOutput output={result.exampleCodeOutput} title="Example Code Output" />
                    )}
                </div>
            </Card>

            <Card title="Practice Question">
                <p className="text-slate-300 leading-relaxed whitespace-pre-wrap mb-6 text-base">{result.practiceQuestion}</p>
                
                <div>
                    <label htmlFor="practice-solution" className="block text-base font-medium text-sky-300 mb-2">
                        Your Solution ({LanguageDisplayNames[language || SupportedLanguage.UNKNOWN]}):
                    </label>
                    <textarea
                        id="practice-solution"
                        name="practice-solution"
                        rows={12}
                        className="mt-1 block w-full p-3.5 shadow-inner focus:ring-2 focus:ring-sky-500 focus:border-sky-500 border border-slate-600/80 bg-slate-900/90 text-slate-100 text-sm rounded-lg font-fira-code disabled:opacity-70 transition-colors custom-scrollbar-small placeholder-slate-500"
                        placeholder={`// Enter your ${LanguageDisplayNames[language || SupportedLanguage.UNKNOWN]} code here...\n// Tip: Use the copy icon above to grab the example code as a starting point.`}
                        value={practiceSolution}
                        onChange={(e) => setPracticeSolution(e.target.value)}
                        aria-label="Practice solution input area"
                        disabled={isCheckingSolution}
                    />
                    <button
                        type="button"
                        onClick={handleCheckSolution}
                        disabled={isCheckingSolution || !practiceSolution.trim()}
                        className="mt-5 w-full flex items-center justify-center py-3 px-4 border border-transparent rounded-lg shadow-lg text-base font-semibold text-white bg-gradient-to-r from-emerald-600 to-green-600 hover:from-emerald-500 hover:to-green-500 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-slate-800 focus:ring-emerald-500 disabled:from-slate-600 disabled:to-slate-700 disabled:text-slate-400 disabled:cursor-not-allowed transition-all duration-200 ease-in-out group transform hover:scale-101 active:scale-98"
                    >
                         <span className={`material-icons mr-2 text-xl group-disabled:opacity-50 transition-opacity ${isCheckingSolution ? 'hidden' : 'inline-block'}`}>
                            checklist_rtl
                        </span>
                        {isCheckingSolution && (
                            <svg className="animate-spin h-5 w-5 text-white mr-2" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                            </svg>
                        )}
                        <span>{isCheckingSolution ? 'Checking Solution...' : "Check My Solution (AI Feedback)"}</span>
                    </button>

                    {solutionError && <div className="mt-5"><ErrorMessage message={solutionError} /></div>}
                    
                    {userSolutionAnalysis && !isCheckingSolution && (
                        <div className="mt-6 p-5 bg-slate-700/30 backdrop-blur-sm rounded-xl ring-1 ring-slate-700/50 shadow-lg">
                            <h4 className="text-xl font-semibold text-sky-300 mb-4 border-b border-slate-700/50 pb-3">AI Feedback on Your Solution:</h4>
                            {typeof userSolutionAnalysis.isCorrect === 'boolean' && (
                                <div className={`mb-4 p-3 rounded-md text-base font-semibold flex items-center border ${userSolutionAnalysis.isCorrect ? 'bg-emerald-600/20 border-emerald-500/40 text-emerald-300' : 'bg-yellow-600/20 border-yellow-500/40 text-yellow-300'}`}>
                                   <span className="material-icons mr-2 text-2xl">{userSolutionAnalysis.isCorrect ? 'verified' : 'tips_and_updates'}</span>
                                    {userSolutionAnalysis.isCorrect ? 'AI Assessment: Looks Correct!' : 'AI Assessment: Needs Revision.'}
                                </div>
                            )}
                            <TerminalOutput output={userSolutionAnalysis.predictedOutput} title="Predicted Output of Your Solution" />
                            <div className="mt-5">
                                <h5 className="text-lg font-semibold text-slate-200 mb-2">Detailed Feedback:</h5>
                                <p className="text-slate-300 text-base leading-relaxed whitespace-pre-wrap">{userSolutionAnalysis.feedback}</p>
                            </div>
                        </div>
                    )}
                </div>
            </Card>

            <Card title="Instructions to Solve">
                 <div className="text-slate-300 leading-relaxed space-y-2.5 whitespace-pre-wrap text-base">
                    {result.instructions.split('\n').map((line, index) => {
                        const trimmedLine = line.trim();
                        if (trimmedLine.match(/^\s*(\d+\.|-|\*|\u2022|Step\s*\d*:)\s*/i)) {
                             const content = trimmedLine.replace(/^\s*(\d+\.|-|\*|\u2022|Step\s*\d*:)\s*/i, '').trim();
                            return (
                                <div key={index} className="flex items-start">
                                    <span className="material-icons text-sky-400 text-xl mr-2.5 mt-0.5 flex-shrink-0">arrow_right_alt</span>
                                    <p>{content}</p>
                                </div>
                            );
                        }
                        // For lines that are not list items but might be part of a multi-line instruction detail
                        if (trimmedLine) {
                           return <p key={index} className="pl-8">{trimmedLine}</p>; 
                        }
                        return null; // Skip empty lines
                    })}
                </div>
            </Card>
        </div>
    );
};
