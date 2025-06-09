
import React from 'react';
// import { Card } from './Card'; // Card might not be needed if this is part of a larger panel
import { CodeBlock } from './CodeBlock';
import { SupportedLanguage, LanguageDisplayNames } from '../types';

interface FileContentViewerProps {
    codeContent: string;
    language: SupportedLanguage;
}

export const FileContentViewer: React.FC<FileContentViewerProps> = ({ codeContent, language }) => {
    const languageName = LanguageDisplayNames[language] || "Source Code";
    return (
        // The parent container (e.g., in HomePage) will have the glassmorphism
        // This component now just provides the content for that panel
        <div className="w-full">
            <h2 className="text-xl font-semibold text-white mb-3 flex items-center">
                <span className="material-icons text-indigo-400 mr-2">description</span>
                Your Uploaded {languageName} Code
            </h2>
            <CodeBlock code={codeContent} language={language} />
        </div>
    );
};
