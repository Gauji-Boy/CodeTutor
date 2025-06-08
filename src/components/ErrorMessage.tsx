
import React from 'react';

interface ErrorMessageProps {
    message: string;
}

export const ErrorMessage: React.FC<ErrorMessageProps> = ({ message }) => {
    let errorTitle = "Error Occurred";
    let errorDetails = message;

    const titleSeparators = [": ", " - "];
    for (const separator of titleSeparators) {
        const parts = message.split(separator);
        if (parts.length > 1 && parts[0].length < 80 && parts[0].length > 3) { 
            errorTitle = parts[0];
            errorDetails = parts.slice(1).join(separator);
            break;
        }
    }
    
    return (
        <div 
            className="bg-red-900/20 border border-red-700/50 text-red-300 px-4 py-3 rounded-lg relative my-4 shadow-md flex items-start"
            role="alert"
        >
            <span className="material-icons-outlined text-red-400 mr-2.5 text-xl flex-shrink-0 pt-px">error_outline</span>
            <div className="flex-grow">
                <strong className="font-medium text-red-200 block text-sm mb-0.5">{errorTitle}</strong>
                <span className="text-xs sm:text-sm leading-relaxed text-red-300/80">{errorDetails}</span>
            </div>
        </div>
    );
};