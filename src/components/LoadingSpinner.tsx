
import React from 'react';

interface LoadingSpinnerProps {
    loadingText?: string;
}

export const LoadingSpinner: React.FC<LoadingSpinnerProps> = ({ loadingText = "Analyzing..." }) => {
    return (
        <div className="flex flex-col justify-center items-center py-10 sm:py-12 text-center w-full">
            <div className="w-8 h-8 sm:w-10 sm:h-10 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin mb-3 sm:mb-4"></div>
            <p className="text-gray-100 text-base sm:text-lg font-semibold tracking-wide">{loadingText}</p>
            <p className="text-gray-400 text-xs sm:text-sm mt-1 max-w-xs">
                The AI is processing your request. This may take a moment.
            </p>
        </div>
    );
};
