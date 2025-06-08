
import React from 'react';
import { InputMode } from '../types';

interface InputModeSelectorProps {
    currentMode: InputMode;
    onModeChange: (mode: InputMode) => void;
}

const commonButtonClasses = "flex-1 py-2.5 px-3 text-sm font-medium rounded-lg focus:outline-none focus:ring-2 focus:ring-sky-500 focus:ring-offset-2 focus:ring-offset-slate-800 transition-all duration-150 ease-in-out shadow-sm flex items-center justify-center";
const activeButtonClasses = "bg-sky-600 text-white hover:bg-sky-500";
const inactiveButtonClasses = "bg-slate-700 text-slate-300 hover:bg-slate-600";


export const InputModeSelector: React.FC<InputModeSelectorProps> = ({ currentMode, onModeChange }) => {
    return (
        <div className="mb-6">
            <h2 className="text-xl font-semibold text-sky-300 mb-3.5 border-b border-slate-700 pb-2.5">
                Choose Input Method
            </h2>
            <div className="flex space-x-3 p-1 bg-slate-900/70 rounded-xl" role="tablist" aria-label="Input method selection">
                <button
                    type="button"
                    id="file-upload-tab"
                    role="tab"
                    aria-selected={currentMode === InputMode.FILE_UPLOAD}
                    aria-controls="file-upload-panel"
                    onClick={() => onModeChange(InputMode.FILE_UPLOAD)}
                    className={`${commonButtonClasses} ${currentMode === InputMode.FILE_UPLOAD ? activeButtonClasses : inactiveButtonClasses}`}
                >
                    <span className="material-icons text-lg mr-1.5 align-middle">upload_file</span>
                    Upload Code File
                </button>
                <button
                    type="button"
                    id="type-concept-tab"
                    role="tab"
                    aria-selected={currentMode === InputMode.CONCEPT_TYPING}
                    aria-controls="concept-typing-panel"
                    onClick={() => onModeChange(InputMode.CONCEPT_TYPING)}
                    className={`${commonButtonClasses} ${currentMode === InputMode.CONCEPT_TYPING ? activeButtonClasses : inactiveButtonClasses}`}
                >
                     <span className="material-icons text-lg mr-1.5 align-middle">lightbulb</span>
                    Type a Concept
                </button>
            </div>
        </div>
    );
};
