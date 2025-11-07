import React from 'react';
import { CodeBlock } from './CodeBlock';
import { SupportedLanguage, LanguageDisplayNames } from '../types';

interface FileContentViewerProps {
    codeContent: string;
    language: SupportedLanguage;
    onViewFull?: () => void;
    title: string;
}

const FileContentViewerComponent: React.FC<FileContentViewerProps> = ({ codeContent, language, onViewFull, title }) => {
    return (
        <div className="w-full">
            <div className="flex justify-between items-center mb-2">
                <h3 className="text-sm font-medium text-[var(--text-primary)] flex items-center">
                    <span className="material-icons-outlined text-[var(--accent-primary)] mr-1.5 text-lg">description</span>
                    {title}
                </h3>
                {onViewFull && (
                    <button
                        onClick={onViewFull}
                        className="text-[var(--text-muted)] hover:text-[var(--text-primary)] p-1 rounded-full hover:bg-[var(--bg-tertiary)] transition-colors focus:outline-none focus:ring-1 focus:ring-[var(--accent-primary)] focus:ring-offset-1 focus:ring-offset-[var(--bg-secondary)]"
                        title="View full code"
                        aria-label="View full code in a modal"
                    >
                        <span className="material-icons-outlined text-base">open_in_full</span>
                    </button>
                )}
            </div>
            <CodeBlock code={codeContent} language={language} showLineNumbers containerClassName="max-h-64" />
        </div>
    );
};

export const FileContentViewer = React.memo(FileContentViewerComponent);