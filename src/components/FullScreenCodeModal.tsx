
import React, { useEffect, useRef } from 'react';
import { CodeBlock } from './CodeBlock';
import { SupportedLanguage } from '../types';

interface FullScreenCodeModalProps {
    isOpen: boolean;
    code: string;
    language: SupportedLanguage;
    onClose: () => void;
}

const FullScreenCodeModalComponent: React.FC<FullScreenCodeModalProps> = ({ isOpen, code, language, onClose }) => {
    const modalRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const handleKeyDown = (event: KeyboardEvent) => {
            if (event.key === 'Escape') {
                onClose();
            }
        };

        if (isOpen) {
            document.addEventListener('keydown', handleKeyDown);
            modalRef.current?.focus(); // Focus the modal for screen readers and escape key
        } else {
            document.removeEventListener('keydown', handleKeyDown);
        }

        return () => {
            document.removeEventListener('keydown', handleKeyDown);
        };
    }, [isOpen, onClose]);

    if (!isOpen) {
        return null;
    }

    return (
        <div
            className="fixed inset-0 bg-gray-900/80 backdrop-blur-md flex items-center justify-center z-[100] p-4 sm:p-6"
            onClick={onClose} // Close on backdrop click
            role="dialog"
            aria-modal="true"
            aria-labelledby="fullscreen-code-modal-title"
        >
            <div
                ref={modalRef}
                className="bg-gray-800 w-full max-w-7xl h-[95vh] rounded-xl shadow-2xl flex flex-col overflow-hidden ring-1 ring-gray-700/80"
                onClick={(e) => e.stopPropagation()} // Prevent closing when clicking inside modal content
                tabIndex={-1} // Make it focusable
            >
                <header className="p-3 sm:p-4 border-b border-gray-700/70 flex justify-between items-center flex-shrink-0">
                    <h2 id="fullscreen-code-modal-title" className="text-base sm:text-lg font-semibold text-white flex items-center">
                        <span className="material-icons-outlined text-indigo-400 mr-2 text-xl">code_blocks</span>
                        Full Code View
                    </h2>
                    <button
                        onClick={onClose}
                        className="text-gray-400 hover:text-white transition-colors p-1.5 rounded-full hover:bg-gray-700/70 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                        aria-label="Close full code view"
                    >
                        <span className="material-icons-outlined">close</span>
                    </button>
                </header>

                <div className="flex-grow flex flex-col p-0 overflow-hidden">
                    <CodeBlock code={code} language={language} showLineNumbers containerClassName="flex-grow min-h-0" />
                </div>
                 <footer className="p-3 sm:p-4 border-t border-gray-700/70 text-right flex-shrink-0">
                    <button
                        onClick={onClose}
                        className="bg-indigo-600 hover:bg-indigo-700 text-white font-medium py-2 px-4 rounded-md text-sm transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 focus:ring-offset-gray-800"
                    >
                        Close
                    </button>
                </footer>
            </div>
        </div>
    );
};

export const FullScreenCodeModal = React.memo(FullScreenCodeModalComponent);