
import React from 'react';

export const LoadingSpinner: React.FC = () => {
    return (
        <div className="flex flex-col justify-center items-center py-20 text-center">
            <div className="relative h-20 w-20 mb-6">
                <div className="absolute inset-0 border-4 border-sky-500/30 rounded-full"></div>
                <div className="absolute inset-0 border-t-4 border-sky-500 rounded-full animate-spin"></div>
            </div>
            <p className="text-slate-100 text-2xl font-semibold tracking-wide">Analyzing Your Code...</p>
            <p className="text-slate-400 text-lg mt-2 max-w-sm">
                The AI is processing your submission. This might take a few moments.
            </p>
        </div>
    );
};