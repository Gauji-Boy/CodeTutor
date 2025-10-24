
import React, { useState, useEffect } from 'react';
import toast from 'react-hot-toast';
import { SupportedLanguage } from '../types';
import { escapeHtml } from '../utils/textUtils'; // Import centralized utility

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
    idSuffix?: string; // Optional suffix for unique IDs if multiple blocks are on a page
    showLineNumbers?: boolean;
    containerClassName?: string;
}

const CodeBlockComponent: React.FC<CodeBlockProps> = ({ code, language, idSuffix = "", showLineNumbers = false, containerClassName = '' }) => {
    const [copied, setCopied] = useState(false);
    const [highlightedHtml, setHighlightedHtml] = useState<string>('');

    useEffect(() => {
        let isMounted = true; // To prevent state updates on unmounted component

        const highlightCode = () => {
            if (typeof Prism !== 'undefined' && Prism.highlight && code) {
                const prismLang = getPrismLanguageString(language);

                // Check if language is loaded, try to autoload if not
                if (!Prism.languages[prismLang] && Prism.plugins && Prism.plugins.autoloader) {
                    Prism.plugins.autoloader.loadLanguages(prismLang, () => {
                        if (isMounted && Prism.languages[prismLang]) {
                            try {
                                const html = Prism.highlight(code, Prism.languages[prismLang], prismLang);
                                setHighlightedHtml(html);
                            } catch (e) {
                                console.warn(`Prism highlighting failed for ${prismLang} after load:`, e);
                                setHighlightedHtml(escapeHtml(code)); // Fallback to escaped raw code
                            }
                        } else if (isMounted) {
                             console.warn(`Prism grammar for ${prismLang} still not available after trying to load. Displaying raw code.`);
                             setHighlightedHtml(escapeHtml(code));
                        }
                    });
                } else if (Prism.languages[prismLang]) {
                     try {
                        const html = Prism.highlight(code, Prism.languages[prismLang], prismLang);
                        setHighlightedHtml(html);
                    } catch (e) {
                        console.warn(`Prism highlighting failed for ${prismLang}:`, e);
                        setHighlightedHtml(escapeHtml(code));
                    }
                } else {
                    // Autoloader might not be present, or language truly not supported by current Prism setup
                    console.warn(`Prism grammar for ${prismLang} not available. Displaying raw code.`);
                    setHighlightedHtml(escapeHtml(code));
                }
            } else if (code) {
                // Prism not available or no code, just escape HTML
                setHighlightedHtml(escapeHtml(code));
            } else {
                setHighlightedHtml(''); // Handle empty code string
            }
        };

        // Defer highlighting slightly to avoid blocking initial render for complex code blocks
        // This can improve perceived performance.
        const timer = setTimeout(highlightCode, 0); 

        return () => {
            isMounted = false;
            clearTimeout(timer);
        };
    }, [code, language]);

    const copyCodeToClipboard = () => {
        navigator.clipboard.writeText(code).then(() => {
            setCopied(true);
            toast.success('Code copied!');
            setTimeout(() => setCopied(false), 2000);
        }).catch(err => {
            toast.error('Failed to copy code.');
            console.error('Failed to copy code: ', err);
        });
    };

    const prismLanguageClass = `language-${getPrismLanguageString(language)}`;
    const lineCount = code.split('\n').length;

    return (
        <div className="relative group">
            <div className={`bg-gray-900/60 rounded-md flex text-xs font-fira-code leading-relaxed overflow-auto custom-scrollbar-small ${containerClassName}`}>
                {showLineNumbers && (
                    <div className="sticky left-0 z-10 p-3.5 text-right text-gray-500 select-none bg-gray-900/60 border-r border-gray-700/50">
                        {Array.from({ length: lineCount }, (_, i) => (
                            <div key={`ln-${idSuffix}-${i + 1}`}>{i + 1}</div>
                        ))}
                    </div>
                )}
                <pre
                    className={`!m-0 p-3.5 ${showLineNumbers ? 'flex-grow' : 'w-full'}`}
                    style={{ tabSize: 4 }}
                >
                    <code
                        className={`!text-gray-200 whitespace-pre ${prismLanguageClass}`}
                        dangerouslySetInnerHTML={{ __html: highlightedHtml || escapeHtml(code || '') }}
                    />
                </pre>
            </div>
            <button
                onClick={copyCodeToClipboard}
                title={copied ? "Copied!" : "Copy code"}
                aria-label="Copy code to clipboard"
                className="absolute top-1.5 right-1.5 bg-gray-600 hover:bg-indigo-600 text-gray-300 hover:text-white p-1 rounded-md text-xs opacity-0 group-hover:opacity-100 transition-all duration-150 focus:opacity-100 focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:ring-offset-gray-700 flex items-center gap-0.5 shadow-md"
            >
                <span className="material-icons-outlined text-sm">
                    {copied ? 'done' : 'content_copy'}
                </span>
            </button>
        </div>
    );
};
// Memoize the component for performance, as code/language props might not change frequently for a given block.
export const CodeBlock = React.memo(CodeBlockComponent);