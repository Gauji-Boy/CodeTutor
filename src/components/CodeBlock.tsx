
import React, { useState, useEffect } from 'react';
import toast from 'react-hot-toast';
import { SupportedLanguage } from '../types';

declare var Prism: any; 

export const getPrismLanguageString = (lang: SupportedLanguage): string => {
    switch (lang) {
        case SupportedLanguage.PYTHON: return 'python';
        case SupportedLanguage.CPP: return 'cpp';
        case SupportedLanguage.C: return 'c';
        case SupportedLanguage.JAVA: return 'java';
        case SupportedLanguage.RUST: return 'rust';
        case SupportedLanguage.JAVASCRIPT: return 'javascript';
        case SupportedLanguage.TYPESCRIPT: return 'typescript';
        case SupportedLanguage.GO: return 'go';
        case SupportedLanguage.HTML: return 'markup'; // Prism uses 'markup' for HTML
        case SupportedLanguage.CSS: return 'css';
        case SupportedLanguage.JSON: return 'json';
        case SupportedLanguage.MARKDOWN: return 'markdown';
        case SupportedLanguage.SHELL: return 'bash'; // 'bash' covers sh, zsh generally
        case SupportedLanguage.LUA: return 'lua';
        default: return 'clike'; // Fallback for unknown, or specific like 'plaintext'
    }
};

interface CodeBlockProps {
    code: string;
    language: SupportedLanguage;
    idSuffix?: string;
}

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
                    setHighlightedHtml(code.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;"));
                }
            } else {
                console.warn(`Prism grammar for ${prismLang} not immediately available. Displaying raw code.`);
                setHighlightedHtml(code.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;"));
                 // Consider calling Prism.highlightAll() or a targeted re-highlight if autoloader is used
            }
        } else if (code) { // Fallback for when Prism is not available
            setHighlightedHtml(code.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;"));
        } else {
            setHighlightedHtml('');
        }
    }, [code, language]);

    const copyCodeToClipboard = () => {
        navigator.clipboard.writeText(code).then(() => { 
            setCopied(true);
            toast.success('Code copied to clipboard!');
            setTimeout(() => setCopied(false), 2500);
        }).catch(err => {
            toast.error('Failed to copy code.');
            console.error('Failed to copy code: ', err);
        });
    };

    const prismLanguageClass = `language-${getPrismLanguageString(language)}`;

    return (
        <div className="relative group bg-gray-800 rounded-lg border border-gray-700 shadow-md">
            <pre 
                className={`p-3.5 sm:p-4 overflow-x-auto text-sm custom-scrollbar-small ${prismLanguageClass}`}
                style={{ tabSize: 4 }} 
            >
                <code 
                    className={`font-fira-code text-gray-300 whitespace-pre ${prismLanguageClass}`}
                    dangerouslySetInnerHTML={{ __html: highlightedHtml }} 
                />
            </pre>
            <button
                onClick={copyCodeToClipboard}
                title={copied ? "Copied!" : "Copy code"}
                aria-label="Copy code to clipboard"
                className="absolute top-1.5 right-1.5 sm:top-2 sm:right-2 bg-gray-600 hover:bg-indigo-600 text-gray-300 hover:text-white p-1.5 rounded-md text-xs opacity-0 group-hover:opacity-100 transition-all duration-150 focus:opacity-100 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-1 focus:ring-offset-gray-800 flex items-center gap-1 shadow"
            >
                <span className="material-icons text-sm">
                    {copied ? 'done' : 'content_copy'}
                </span>
                <span className="hidden sm:inline text-xs">{copied ? 'Copied' : 'Copy'}</span>
            </button>
        </div>
    );
};
