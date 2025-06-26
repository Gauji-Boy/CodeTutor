
import React from 'react';

interface ErrorMessageProps {
    message: string;
}

const ErrorMessageComponent: React.FC<ErrorMessageProps> = ({ message }) => {
    // Attempt to split message into a title and details for better formatting
    let errorTitle = "Error Occurred";
    let errorDetails = message;

    const titleSeparators = [": ", " - "]; // Common separators
    for (const separator of titleSeparators) {
        const parts = message.split(separator);
        // Heuristic: If first part is reasonably short and there's a second part, use it as title
        if (parts.length > 1 && parts[0].length < 80 && parts[0].length > 3) { 
            errorTitle = parts[0];
            errorDetails = parts.slice(1).join(separator);
            break;
        }
    }
    
    return (
        <div 
            className="bg-red-700/20 border border-red-600/40 text-red-200 px-3.5 py-2.5 rounded-lg relative my-3 shadow-md flex items-start w-full"
            role="alert"
        >
            <span className="material-icons-outlined text-red-400 mr-2 text-lg flex-shrink-0 pt-px">error_outline</span>
            <div className="flex-grow">
                <strong className="font-medium text-red-100 block text-sm mb-0.5">{errorTitle}</strong>
                <span className="text-xs sm:text-sm leading-relaxed text-red-200/90">{errorDetails}</span>
            </div>
        </div>
    );
};

export const ErrorMessage = React.memo(ErrorMessageComponent);