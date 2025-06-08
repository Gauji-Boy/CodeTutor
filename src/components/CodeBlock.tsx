

import React, { useState, useEffect } from 'react';
import toast from 'react-hot-toast';
import { SupportedLanguage } from '../types';

declare var Prism: any;

interface CodeBlockProps {
    code: string;
    language: SupportedLanguage;
    idSuffix?: string;
}

const getPrismLanguageString = (lang: SupportedLanguage): string => {
    switch (lang) {
        case SupportedLanguage.PYTHON: return 'python';
        case SupportedLanguage.CPP: return 'cpp';
        case SupportedLanguage.C: return 'c';
        case SupportedLanguage.JAVA: return 'java';
        case SupportedLanguage.RUST: return 'rust';
        case SupportedLanguage.JAVASCRIPT: return 'javascript';
        case SupportedLanguage.TYPESCRIPT: return 'tsx'; // Use 'tsx' for .ts and .tsx files, covers TS features + JSX
        case SupportedLanguage.GO: return 'go';
        case SupportedLanguage.SWIFT: return 'swift';
        case SupportedLanguage.KOTLIN: return 'kotlin';
        case SupportedLanguage.PHP: return 'php';
        case SupportedLanguage.RUBY: return 'ruby';
        case SupportedLanguage.SCALA: return 'scala';
        case SupportedLanguage.CSHARP: return 'csharp';
        case SupportedLanguage.SHELL: return 'bash'; // Use 'bash' for .sh and .bash files
        case SupportedLanguage.LUA: return 'lua'; // Added Lua
        default: return 'clike'; 
    }
};

export const CodeBlock: React.FC<CodeBlockProps> = ({ code, language, idSuffix = "" }) => {
    const [copied, setCopied] = useState(false);
    const [highlightedHtml, setHighlightedHtml] = useState<string>('');

    useEffect(() => {
        if (typeof Prism !== 'undefined' && Prism.highlight && code) {
            const prismLang = getPrismLanguageString(language);
            if (Prism.languages[prismLang]) {
                try {
                    const html = Prism.highlight(code, Prism.languages[prismLang], prismLang);
                    setHighlightedHtml(html);
                } catch (e) {
                    console.warn(`Prism highlighting failed for ${prismLang}:`, e);
                    // Fallback: display code without syntax highlighting but HTML escaped
                    setHighlightedHtml(code.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;"));
                }
            } else {
                console.warn(`Prism grammar for ${prismLang} not loaded. Ensure it's included in index.html. Raw code displayed.`);
                setHighlightedHtml(code.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;"));
            }
        } else if (code) {
             // Fallback if Prism is not available or code is empty
            setHighlightedHtml(code.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;"));
        } else {
            setHighlightedHtml('');
        }
    }, [code, language]);

    const copyCodeToClipboard = () => {
        navigator.clipboard.writeText(code).then(() => { 
            setCopied(true);
            toast.success('Code copied!');
            setTimeout(() => setCopied(false), 2000);
        }).catch(err => {
            toast.error('Copy failed.');
            console.error('Failed to copy: ', err);
        });
    };

    const prismLanguageClass = `language-${getPrismLanguageString(language)}`;

    return (
        <div className="relative group">
            <pre 
                className={`bg-slate-900 p-4 rounded-lg overflow-x-auto text-sm border border-slate-700/70 custom-scrollbar-small ${prismLanguageClass}`} // Ensure consistent background
            >
                <code 
                    className={`font-fira-code text-slate-300 ${prismLanguageClass}`}
                    dangerouslySetInnerHTML={{ __html: highlightedHtml }} 
                />
            </pre>
            <button
                onClick={copyCodeToClipboard}
                title={copied ? "Copied!" : "Copy code"}
                aria-label="Copy code to clipboard"
                className="absolute top-2 right-2 bg-slate-700/50 hover:bg-blue-700/60 text-slate-300 hover:text-blue-200 p-1.5 rounded-md text-xs opacity-0 group-hover:opacity-100 transition-opacity focus:opacity-100 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-1 focus:ring-offset-slate-900 flex items-center gap-1"
            >
                <span className="material-icons-outlined text-sm">
                    {copied ? 'done' : 'content_copy'}
                </span>
                {copied ? 'Copied' : 'Copy'}
            </button>
        </div>
    );
};