import React from 'react';
import { DebugResult, IdentifiedError, SupportedLanguage } from '../types';
import { DiffViewer } from './DiffViewer';
import { CodeBlock } from './CodeBlock';

interface DebugResultDisplayProps {
    result: DebugResult;
    originalCode: string;
    language: SupportedLanguage;
}

const ErrorCard: React.FC<{ error: IdentifiedError, index: number }> = ({ error, index }) => {
    const errorTypeColors: Record<IdentifiedError['errorType'], string> = {
        'Syntax': 'bg-red-600/20 border-red-500/30 text-red-300',
        'Logic': 'bg-yellow-600/20 border-yellow-500/30 text-yellow-300',
        'Best Practice': 'bg-blue-600/20 border-blue-500/30 text-blue-300',
        'Other': 'bg-gray-600/20 border-gray-500/30 text-gray-300',
    };

    return (
        <div className="bg-gray-700/30 p-3 rounded-lg border border-gray-600/50">
            <div className="flex justify-between items-center mb-2">
                <h4 className="font-semibold text-sm text-gray-100 flex items-center">
                    <span className="material-icons-outlined text-base text-indigo-400 mr-2">error</span>
                    Error #{index + 1} {error.errorLine ? `(Line ${error.errorLine})` : ''}
                </h4>
                <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${errorTypeColors[error.errorType]}`}>
                    {error.errorType}
                </span>
            </div>
            <p className="text-sm text-gray-300 leading-relaxed mb-3">{error.explanation}</p>
            <div>
                <div className="mb-2">
                    <p className="text-xs font-semibold text-red-400 mb-1">Erroneous Code:</p>
                    <CodeBlock code={error.erroneousCode} language={SupportedLanguage.UNKNOWN} />
                </div>
                <div>
                    <p className="text-xs font-semibold text-green-400 mb-1">Suggested Fix:</p>
                    <CodeBlock code={error.suggestedFix} language={SupportedLanguage.UNKNOWN} />
                </div>
            </div>
        </div>
    );
};

const DebugResultDisplayComponent: React.FC<DebugResultDisplayProps> = ({ result, originalCode, language }) => {
    return (
        <div className="w-full text-left space-y-6 sm:space-y-8">
            <section aria-labelledby="debug-summary-title">
                <h3 id="debug-summary-title" className="text-lg font-semibold text-white mb-2 flex items-center">
                    <span className="material-icons-outlined text-indigo-400 mr-2 text-xl">summarize</span>
                    AI Debugging Summary
                </h3>
                <p className="text-sm text-gray-300 bg-gray-700/20 p-3 rounded-md border border-gray-600/40 leading-relaxed">
                    {result.summary}
                </p>
            </section>

            <section aria-labelledby="code-corrections-title">
                <h3 id="code-corrections-title" className="text-lg font-semibold text-white mb-3 flex items-center">
                    <span className="material-icons-outlined text-indigo-400 mr-2 text-xl">difference</span>
                    Code Corrections (Diff View)
                </h3>
                <DiffViewer oldCode={originalCode} newCode={result.correctedCode} language={language} />
            </section>

            {result.errorAnalysis && result.errorAnalysis.length > 0 && (
                <section aria-labelledby="detailed-errors-title">
                    <h3 id="detailed-errors-title" className="text-lg font-semibold text-white mb-3 flex items-center">
                        <span className="material-icons-outlined text-indigo-400 mr-2 text-xl">playlist_add_check</span>
                        Detailed Error Analysis
                    </h3>
                    <div className="space-y-4">
                        {result.errorAnalysis.map((error, index) => (
                            <ErrorCard key={index} error={error} index={index} />
                        ))}
                    </div>
                </section>
            )}
        </div>
    );
};

export const DebugResultDisplay = React.memo(DebugResultDisplayComponent);