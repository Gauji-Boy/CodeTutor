
import React from 'react';

interface TerminalOutputProps {
    output: string | null | undefined;
    title?: string;
}

export const TerminalOutput: React.FC<TerminalOutputProps> = ({ output, title = "Output" }) => {
    if (typeof output !== 'string') {
        if (output === null || output === undefined) return null; 
    }

    const isEmptyOutput = !output || output.trim() === "";
    const finalOutput = (!output || output.trim() === "" && output.length > 0) ? "[Output consists of only whitespace]" : output;
    
    const displayOutput = isEmptyOutput ? 
        <span className="text-gray-500 italic select-none text-center block w-full text-xs">[No direct output produced or output is empty]</span> 
        : finalOutput;

    return (
        <div className="mt-2 bg-gray-700/50 rounded-md shadow-inner border border-gray-600/70 overflow-hidden">
            <h4 className="text-xs font-medium text-gray-400 px-2.5 py-1 bg-gray-600/40 border-b border-gray-600/60">
                {title}:
            </h4>
            <pre className={`text-gray-300 p-2.5 rounded-b-md overflow-x-auto text-xs font-fira-code min-h-[3em] sm:min-h-[3.5em] leading-normal custom-scrollbar-small whitespace-pre-wrap ${isEmptyOutput ? 'flex items-center justify-center' : ''}`}>
                {displayOutput}
            </pre>
        </div>
    );
};
