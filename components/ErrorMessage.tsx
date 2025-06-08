
import React from 'react';

interface ErrorMessageProps {
    message: string;
}

export const ErrorMessage: React.FC<ErrorMessageProps> = ({ message }) => {
    // Split message into title and details if a common pattern like "Title: Details" exists
    let errorTitle = "Oops! An Error Occurred";
    let errorDetails = message;

    const titleSeparators = [": ", " - "];
    for (const separator of titleSeparators) {
        const parts = message.split(separator);
        if (parts.length > 1 && parts[0].length < 60) { // Heuristic for a "title"
            errorTitle = parts[0];
            errorDetails = parts.slice(1).join(separator);
            break;
        }
    }
    
    return (
        <div className="bg-red-700/30 border border-red-600/50 text-red-200 px-5 py-4 rounded-xl relative my-6 shadow-xl flex items-start" role="alert">
            <span className="material-icons text-red-300 mr-4 text-3xl flex-shrink-0 pt-0.5">report_problem</span>
            <div className="flex-grow">
                <strong className="font-semibold text-red-100 block text-lg mb-1">{errorTitle}</strong>
                <span className="text-sm sm:text-base leading-relaxed">{errorDetails}</span>
            </div>
        </div>
    );
};