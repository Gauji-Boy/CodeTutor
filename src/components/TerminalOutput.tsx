
import React from 'react';

interface TerminalOutputProps {
    output: string | null | undefined;
    title?: string;
}

export const TerminalOutput: React.FC<TerminalOutputProps> = ({ output, title = "Output" }) => {
    if (typeof output !== 'string') {
        if (output === null || output === undefined) return null; 
    }

    const isEmptyOutput = output.trim() === "";
    const displayOutput = isEmptyOutput ? 
        <span className="text-slate-500 italic select-none">[No direct output produced]</span> 
        : output;

    return (
        <div className="mt-3 bg-slate-900 rounded-lg shadow-md border border-slate-800/60 overflow-hidden">
            <h4 className="text-xs font-medium text-slate-400 px-3 py-1.5 bg-slate-800/70 border-b border-slate-800/60">
                {title}:
            </h4>
            <pre className={`bg-slate-950 text-slate-300 p-3.5 rounded-b-lg overflow-x-auto text-xs font-fira-code min-h-[4em] leading-normal custom-scrollbar-small whitespace-pre-wrap ${isEmptyOutput ? 'flex items-center text-center justify-center' : ''}`}>
                {displayOutput}
            </pre>
        </div>
    );
};