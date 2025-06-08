
import React from 'react';

interface TerminalOutputProps {
    output: string | null | undefined;
    title?: string;
}

export const TerminalOutput: React.FC<TerminalOutputProps> = ({ output, title = "Output" }) => {
    if (typeof output !== 'string') {
        if (output === null || output === undefined) return null; // Render nothing if truly null/undefined
    }

    const isEmptyOutput = output.trim() === "";
    const displayOutput = isEmptyOutput ? 
        <span className="text-slate-500 italic">[No direct output expected or produced by this code snippet]</span> 
        : output;

    return (
        <div id="terminal-output-container" className="mt-4 bg-slate-900/70 backdrop-blur-sm rounded-lg shadow-inner ring-1 ring-slate-700/60 overflow-hidden">
            <h4 className="text-sm font-semibold text-slate-400 mb-0 px-4 py-2.5 bg-slate-700/40 border-b border-slate-700/60">
                {title}:
            </h4>
            <pre className={`text-slate-200 p-4 rounded-b-lg overflow-x-auto text-xs sm:text-sm font-fira-code min-h-[5em] leading-relaxed custom-scrollbar-small whitespace-pre-wrap ${isEmptyOutput ? 'flex items-center' : ''}`}>
                {displayOutput}
            </pre>
        </div>
    );
};