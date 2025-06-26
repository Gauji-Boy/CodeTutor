
import React from 'react';

interface LoadingSpinnerProps {
    loadingText?: string;
}

const LoadingSpinnerComponent: React.FC<LoadingSpinnerProps> = ({ loadingText = "Analyzing..." }) => {
    return (
        <div className="flex flex-col justify-center items-center py-8 sm:py-10 text-center w-full flex-grow">
            <div className="w-7 h-7 sm:w-9 sm:h-9 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin mb-2.5 sm:mb-3.5"></div>
            <p className="text-gray-100 text-sm sm:text-base font-medium tracking-wide">{loadingText}</p>
            <p className="text-gray-400 text-xs sm:text-sm mt-0.5 max-w-xs">
                AI processing your request. This may take a moment.
            </p>
        </div>
    );
};

export const LoadingSpinner = React.memo(LoadingSpinnerComponent);