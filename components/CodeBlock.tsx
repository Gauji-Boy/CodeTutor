import React, { useState } from 'react';
import toast from 'react-hot-toast';
import { SupportedLanguage } from '../types';

interface CodeBlockProps {
    code: string;
    language: SupportedLanguage;
    idSuffix?: string;
}

export const CodeBlock: React.FC<CodeBlockProps> = ({ code, language, idSuffix = "" }) => {
    const [copied, setCopied] = useState(false);

    // Syntax highlighting definitions (keywords, types, literals for various languages)
    const keywordsPy = ['def', 'class', 'import', 'from', 'return', 'if', 'else', 'elif', 'for', 'while', 'try', 'except', 'finally', 'with', 'as', 'is', 'in', 'not', 'and', 'or', 'pass', 'break', 'continue', 'lambda', 'yield', 'global', 'nonlocal', 'assert', 'del', 'async', 'await'];
    const literalsPy = ['True', 'False', 'None'];
    
    const keywordsJava = ['public', 'private', 'protected', 'static', 'final', 'void', 'class', 'interface', 'enum', 'import', 'package', 'return', 'if', 'else', 'for', 'while', 'try', 'catch', 'finally', 'new', 'this', 'super', 'extends', 'implements', 'throws', 'throw', 'instanceof'];
    const typesJava = ['int', 'double', 'float', 'long', 'short', 'byte', 'char', 'boolean', 'String'];
    const literalsJava = ['true', 'false', 'null'];

    const keywordsC = ['auto', 'break', 'case', 'char', 'const', 'continue', 'default', 'do', 'double', 'else', 'enum', 'extern', 'float', 'for', 'goto', 'if', 'int', 'long', 'register', 'return', 'short', 'signed', 'sizeof', 'static', 'struct', 'switch', 'typedef', 'union', 'unsigned', 'void', 'volatile', 'while', '#include', '#define'];
    const literalsC = ['NULL'];

    const keywordsCpp = [...keywordsC, 'class', 'virtual', 'friend', 'template', 'typename', 'namespace', 'using', 'delete', 'try', 'const_cast', 'static_cast', 'dynamic_cast', 'reinterpret_cast', 'bool', 'std', 'cout', 'cin', 'endl', 'vector', 'string', 'map', 'set'];
    const literalsCpp = ['true', 'false', 'nullptr', ...literalsC];
    
    const keywordsRs = ['fn', 'struct', 'enum', 'impl', 'mod', 'use', 'crate', 'pub', 'let', 'mut', 'const', 'static', 'if', 'else', 'match', 'loop', 'while', 'for', 'in', 'return', 'break', 'continue', 'async', 'await', 'try', 'self', 'Self', 'super', 'trait', 'unsafe', 'where', 'as', 'dyn', 'move'];
    const typesRs = ['Vec', 'String', 'str', 'usize', 'i8', 'i16', 'i32', 'i64', 'i128', 'u8', 'u16', 'u32', 'u64', 'u128', 'f32', 'f64', 'bool', 'char', 'Option', 'Result'];
    const literalsRs = ['true', 'false'];


    let keywords: string[] = [];
    let types: string[] = typesJava; // Default to Java types for wider coverage if specific lang types are not set
    let literals: string[] = [];

    switch (language) {
        case SupportedLanguage.PYTHON: keywords = keywordsPy; types = []; literals = literalsPy; break;
        case SupportedLanguage.JAVA: keywords = keywordsJava; types = typesJava; literals = literalsJava; break;
        case SupportedLanguage.C: keywords = keywordsC; types = []; literals = literalsC; break;
        case SupportedLanguage.CPP: keywords = keywordsCpp; types = ['bool', ...typesJava]; literals = literalsCpp; break;
        case SupportedLanguage.RUST: keywords = keywordsRs; types = typesRs; literals = literalsRs; break;
        default: keywords = []; types = []; literals = [];
    }
    
    const keywordRegex = new RegExp(`\\b(${keywords.join('|')})\\b`, 'g');
    const typeRegex = types.length > 0 ? new RegExp(`\\b(${types.join('|')})\\b`, 'g') : null;
    const literalRegex = new RegExp(`\\b(${literals.join('|')})\\b`, 'g');
    
    let highlightedCode = code
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;");

    if (keywords.length > 0) highlightedCode = highlightedCode.replace(keywordRegex, '<span class="text-sky-400 font-medium">$1</span>');
    if (typeRegex) highlightedCode = highlightedCode.replace(typeRegex, '<span class="text-teal-400">$1</span>');
    if (literals.length > 0) highlightedCode = highlightedCode.replace(literalRegex, '<span class="text-purple-400">$1</span>');
    
    highlightedCode = highlightedCode
        .replace(/(\b\d+\.?\d*[fLd]?\b)/g, '<span class="text-amber-400">$1</span>') // Numbers (int, float, with suffixes)
        .replace(/(\/\/[^\n]*|\/\*[\s\S]*?\*\/|#.*)/g, '<span class="text-slate-500 italic">$1</span>') // Comments
        .replace(/(["'`].*?["'`])/g, '<span class="text-emerald-400">$1</span>'); // Strings

    const copyCodeToClipboard = () => {
        navigator.clipboard.writeText(code).then(() => {
            setCopied(true);
            toast.success('Code copied to clipboard!');
            setTimeout(() => setCopied(false), 2000);
        }).catch(err => {
            console.error('Failed to copy code: ', err);
            toast.error('Failed to copy code.');
        });
    };

    return (
        <div className="relative group">
            <pre className="bg-slate-900/80 text-slate-200 p-4 pr-12 rounded-lg overflow-x-auto text-sm font-fira-code leading-relaxed ring-1 ring-slate-700/70 custom-scrollbar-small shadow-inner">
                <code dangerouslySetInnerHTML={{ __html: highlightedCode }} />
            </pre>
            <button
                onClick={copyCodeToClipboard}
                title="Copy code"
                aria-label="Copy code to clipboard"
                className="absolute top-2.5 right-2.5 p-1.5 bg-slate-700/60 hover:bg-sky-500/80 text-slate-400 hover:text-white rounded-md opacity-0 group-hover:opacity-100 focus:opacity-100 transition-all duration-150"
            >
                <span className="material-icons text-lg">
                    {copied ? 'done_all' : 'content_copy'}
                </span>
            </button>
        </div>
    );
};
