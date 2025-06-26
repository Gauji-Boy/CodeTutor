
import React from 'react';
import { CodeBlock } from './CodeBlock';
import { SupportedLanguage, LanguageDisplayNames } from '../types';

interface FileContentViewerProps {
    codeContent: string;
    language: SupportedLanguage;
    onViewFull?: () => void; // New prop
}

const FileContentViewerComponent: React.FC<FileContentViewerProps> = ({ codeContent, language, onViewFull }) => {
    const languageName = LanguageDisplayNames[language] || "Source Code";
    return (
        <div className="w-full">
            <div className="flex justify-between items-center mb-2">
                <h3 className="text-sm font-medium text-white flex items-center">
                    <span className="material-icons-outlined text-indigo-400 mr-1.5 text-lg">description</span>
                    Your Uploaded {languageName}
                </h3>
                {onViewFull && (
                    <button
                        onClick={onViewFull}
                        className="text-gray-400 hover:text-white p-1 rounded-full hover:bg-gray-600/70 transition-colors focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:ring-offset-1 focus:ring-offset-gray-800"
                        title="View full code"
                        aria-label="View full code in a modal"
                    >
                        <span className="material-icons-outlined text-base">open_in_full</span>
                    </button>
                )}
            </div>
            <div className="max-h-64 overflow-y-auto custom-scrollbar-small rounded-md border border-gray-600/70">
                 <CodeBlock code={codeContent} language={language} />
            </div>
        </div>
    );
};

export const FileContentViewer = React.memo(FileContentViewerComponent);