import React from 'react';
import { Card } from './Card';
import { CodeBlock } from './CodeBlock';
import { SupportedLanguage, LanguageDisplayNames } from '../types';

interface FileContentViewerProps {
    codeContent: string;
    language: SupportedLanguage;
}

export const FileContentViewer: React.FC<FileContentViewerProps> = ({ codeContent, language }) => {
    const languageName = LanguageDisplayNames[language] || "Source Code";
    return (
        <Card title={`Your Uploaded ${languageName} Code`}>
            <CodeBlock code={codeContent} language={language} />
        </Card>
    );
};
