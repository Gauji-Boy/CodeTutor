import React, { useState, useEffect, useMemo } from 'react';
import { SupportedLanguage } from '../types';
import { escapeHtml } from '../utils/textUtils';

declare var Prism: any; // Declare Prism to satisfy TypeScript since it's loaded globally

// Helper function to map SupportedLanguage to Prism language strings
export const getPrismLanguageString = (lang: SupportedLanguage | null | undefined): string => {
    if (!lang) return 'clike'; // Default or for unknown
    switch (lang) {
        case SupportedLanguage.PYTHON: return 'python';
        case SupportedLanguage.CPP: return 'cpp';
        case SupportedLanguage.C: return 'c';
        case SupportedLanguage.JAVA: return 'java';
        case SupportedLanguage.RUST: return 'rust';
        case SupportedLanguage.JAVASCRIPT: return 'javascript';
        case SupportedLanguage.TYPESCRIPT: return 'typescript';
        case SupportedLanguage.GO: return 'go';
        case SupportedLanguage.HTML: return 'markup'; // Prism uses 'markup' for HTML, XML etc.
        case SupportedLanguage.CSS: return 'css';
        case SupportedLanguage.JSON: return 'json';
        case SupportedLanguage.MARKDOWN: return 'markdown';
        case SupportedLanguage.SHELL: return 'bash'; // 'bash' is a good general purpose for shell scripts
        case SupportedLanguage.LUA: return 'lua';
        default: return 'clike'; // Fallback for other unknown languages
    }
};

interface CodeBlockProps {
    code: string;
    language: SupportedLanguage;
    idSuffix?: string;
    showLineNumbers?: boolean;
    containerClassName?: string;
}

const CodeBlockComponent: React.FC<CodeBlockProps> = ({ code, language, idSuffix = "", showLineNumbers = false, containerClassName = "" }) => {
    const [copied, setCopied] = useState(false);
    const [highlightedHtml, setHighlightedHtml] = useState<string>('');

    useEffect(() => {
        let isMounted = true;

        const highlightCode = () => {
            if (typeof Prism !== 'undefined' && Prism.highlight && code) {
                const prismLang = getPrismLanguageString(language);

                const applyHighlight = (grammar: any, lang: string) => {
                    try {
                        const html = Prism.highlight(code, grammar, lang);
                        if (isMounted) setHighlightedHtml(html);
                    } catch (e) {
                        console.warn(`Prism highlighting failed for ${lang}:`, e);
                        if (isMounted) setHighlightedHtml(escapeHtml(code));
                    }
                };

                if (Prism.languages[prismLang]) {
                    applyHighlight(Prism.languages[prismLang], prismLang);
                } else if (Prism.plugins?.autoloader) {
                    Prism.plugins.autoloader.loadLanguages(prismLang, () => {
                        if (isMounted && Prism.languages[prismLang]) {
                            applyHighlight(Prism.languages[prismLang], prismLang);
                        } else if (isMounted) {
                            console.warn(`Prism autoloader could not load ${prismLang}.`);
                            setHighlightedHtml(escapeHtml(code));
                        }
                    });
                } else {
                    console.warn(`Prism grammar for ${prismLang} not found.`);
                    setHighlightedHtml(escapeHtml(code));
                }
            } else if (code) {
                setHighlightedHtml(escapeHtml(code));
            } else {
                setHighlightedHtml('');
            }
        };

        const timer = setTimeout(highlightCode, 0);

        return () => {
            isMounted = false;
            clearTimeout(timer);
        };
    }, [code, language]);
    
    const codeLines = useMemo(() => code.split('\n'), [code]);

    const copyCodeToClipboard = () => {
        navigator.clipboard.writeText(code).then(() => {
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        }).catch(err => {
            console.error('Failed to copy code: ', err);
        });
    };

    const prismLanguageClass = `language-${getPrismLanguageString(language)}`;

    return (
        <div className={`relative group bg-[var(--bg-primary)]/60 text-[var(--text-primary)] rounded-lg border border-[var(--border-color)] overflow-auto custom-scrollbar-small ${containerClassName}`}>
            <div className="flex text-sm font-fira-code leading-relaxed relative">
                {showLineNumbers && (
                    <div className="sticky left-0 z-10 bg-[var(--bg-secondary)]/80 backdrop-blur-sm text-right text-[var(--text-muted)] select-none p-4 pr-3 border-r border-[var(--border-color)]">
                        {codeLines.map((_, i) => <div key={i}>{i + 1}</div>)}
                    </div>
                )}
                <pre className={`p-4 ${showLineNumbers ? '' : 'w-full'}`}>
                    <code className={prismLanguageClass} dangerouslySetInnerHTML={{ __html: highlightedHtml || escapeHtml(code || '') }} />
                </pre>
            </div>
            <button
                onClick={copyCodeToClipboard}
                title="Copy code"
                aria-label="Copy code to clipboard"
                className="absolute top-2.5 right-2.5 p-1.5 bg-[var(--bg-tertiary)]/80 hover:bg-[var(--accent-primary)] text-[var(--text-secondary)] hover:text-white rounded-md opacity-0 group-hover:opacity-100 focus:opacity-100 transition-all duration-150 z-20"
            >
                <span className="material-icons text-lg">
                    {copied ? 'done_all' : 'content_copy'}
                </span>
            </button>
        </div>
    );
};

export const CodeBlock = React.memo(CodeBlockComponent);