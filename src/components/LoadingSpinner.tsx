
import React from 'react';

interface LoadingSpinnerProps {
    loadingText?: string;
}

export const LoadingSpinner: React.FC<LoadingSpinnerProps> = ({ loadingText = "Analyzing..." }) => {
    return (
        <div className="flex flex-col justify-center items-center py-12 text-center">
            <div className="w-10 h-10 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mb-4"></div>
            <p className="text-slate-200 text-lg font-semibold">{loadingText}</p>
            <p className="text-slate-400 text-sm mt-1.5 max-w-xs">
                AI is processing your request. This may take a moment.
            </p>
        </div>
    );
};