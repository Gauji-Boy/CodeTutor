import React from 'react';

interface TerminalOutputProps {
    output: string | null | undefined;
    title?: string;
}

const TerminalOutputComponent: React.FC<TerminalOutputProps> = ({ output, title = "Output" }) => {
    if (typeof output !== 'string') {
        if (output === null || output === undefined) return null; // Render nothing if truly null/undefined
    }

    const isEmptyOutput = !output || output.trim() === "";
    // Differentiate between truly empty and output that is just whitespace
    const finalOutput = (!output || output.trim() === "" && output.length > 0) ? "[Output consists of only whitespace]" : output;
    
    const displayOutput = isEmptyOutput ? 
        <span className="text-[var(--text-muted)] italic select-none text-center block w-full text-xs">[No direct output produced or output is empty]</span> 
        : finalOutput;

    return (
        <div className="mt-2 bg-[var(--bg-secondary)]/60 rounded-md shadow-inner border border-[var(--border-color)] overflow-hidden">
            <h4 className="text-xs font-medium text-[var(--text-muted)] px-2.5 py-1 bg-[var(--bg-tertiary)]/80 border-b border-[var(--border-color)]">
                {title}:
            </h4>
            <pre className={`text-[var(--text-primary)] p-2.5 rounded-b-md overflow-x-auto text-xs font-fira-code min-h-[3em] sm:min-h-[3.5em] leading-normal custom-scrollbar-small whitespace-pre-wrap ${isEmptyOutput ? 'flex items-center justify-center' : ''}`}>
                {displayOutput}
            </pre>
        </div>
    );
};

export const TerminalOutput = React.memo(TerminalOutputComponent);