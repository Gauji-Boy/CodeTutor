
import React from 'react';
import type { SupportedLanguage } from '../types';
import { LanguageDisplayNames, AcceptedFileExtensions, SupportedLanguage as LangEnum } from '../types';

interface FileUploadProps {
    onFileSelect: (file: File) => void;
    selectedFile: File | null;
    selectedLanguage: SupportedLanguage | null;
    onLanguageChange: (language: SupportedLanguage) => void;
    onSubmit: () => void;
    isLoading: boolean;
}

export const FileUpload: React.FC<FileUploadProps> = ({
    onFileSelect,
    selectedFile,
    selectedLanguage,
    onLanguageChange,
    onSubmit,
    isLoading,
}) => {
    const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        if (event.target.files && event.target.files[0]) {
            onFileSelect(event.target.files[0]);
        }
    };

    const handleLanguageSelectChange = (event: React.ChangeEvent<HTMLSelectElement>) => {
        onLanguageChange(event.target.value as SupportedLanguage);
    };
    
    const languageOptions = Object.values(LangEnum).filter(lang => lang !== LangEnum.UNKNOWN).map(lang => ({
        value: lang,
        label: LanguageDisplayNames[lang]
    }));

    const fileUploadZoneId = "file-drop-zone-main";
    const fileInputId = "file-upload-input-main";

    const handleDrop = (event: React.DragEvent<HTMLDivElement>) => {
        event.preventDefault(); event.stopPropagation(); if (isLoading) return;
        const dropZone = event.currentTarget;
        dropZone?.classList.remove('border-indigo-500', 'bg-gray-700/50');
        dropZone?.classList.add('border-gray-600', 'bg-transparent');
        if (event.dataTransfer.files && event.dataTransfer.files[0]) {
            onFileSelect(event.dataTransfer.files[0]);
        }
    };

    const handleDragOver = (event: React.DragEvent<HTMLDivElement>) => {
        event.preventDefault(); event.stopPropagation(); if (isLoading) return;
        const dropZone = event.currentTarget;
        dropZone?.classList.add('border-indigo-500', 'bg-gray-700/50');
        dropZone?.classList.remove('border-gray-600', 'bg-transparent');
    };

    const handleDragLeave = (event: React.DragEvent<HTMLDivElement>) => {
        event.preventDefault(); event.stopPropagation();
        const dropZone = event.currentTarget;
        dropZone?.classList.remove('border-indigo-500', 'bg-gray-700/50');
        dropZone?.classList.add('border-gray-600', 'bg-transparent');
    };
    
    const isSubmitDisabled = isLoading || !selectedFile || !selectedLanguage || selectedLanguage === LangEnum.UNKNOWN;
    // Using the extensive list from the example for display purposes
    const displayFileExtensions = "PY, PYW, CPP, HPP, CXX, CC, HH, C, H, JAVA, RB, GO, JS, JSX, TS, TSX, HTML, CSS, PHP, SWIFT, KOTLIN, RUST, SCALA, PERL, LUA, SQL, JSON, MD, MARKDOWN, SH, BASH, ZSH, Fish, Max 1MB.";

    return (
        <div className="flex flex-col flex-grow space-y-4">
            <div>
                <h3 className="text-md font-medium text-white mb-2">Upload Your Code</h3>
                <label htmlFor={fileInputId} className="block text-sm text-gray-400 mb-1 cursor-pointer">
                    Code File
                </label>
                <div 
                    id={fileUploadZoneId}
                    className={`border-2 border-dashed ${selectedFile ? 'border-indigo-500' : 'border-gray-600'} rounded-lg p-6 sm:p-8 flex flex-col items-center justify-center text-center mb-2 hover:border-indigo-500 transition-colors cursor-pointer flex-grow min-h-[180px] sm:min-h-[200px] bg-transparent hover:bg-gray-700/30`}
                    onDrop={handleDrop}
                    onDragOver={handleDragOver}
                    onDragLeave={handleDragLeave}
                    onClick={() => !isLoading && document.getElementById(fileInputId)?.click()}
                    role="button"
                    aria-label="File upload zone"
                    tabIndex={isLoading ? -1 : 0}
                    onKeyPress={(e) => { if (e.key === 'Enter' || e.key === ' ') !isLoading && document.getElementById(fileInputId)?.click(); }}
                >
                    <span className={`material-icons text-4xl sm:text-5xl mb-2 sm:mb-3 transition-colors ${selectedFile ? 'text-indigo-400' : 'text-gray-500 group-hover:text-indigo-500'}`}>
                        {selectedFile ? 'file_present' : 'cloud_upload'}
                    </span>
                    <p className="text-gray-300 text-sm mb-1">
                        <span className="text-indigo-400 hover:text-indigo-300 font-medium">{selectedFile ? 'Change File' : 'Choose File'}</span>
                        {!selectedFile && <span className="text-gray-500"> or drag and drop</span>}
                    </p>
                    <p className="text-xs text-gray-500 leading-tight px-2">{displayFileExtensions}</p>
                    <input id={fileInputId} name={fileInputId} type="file" className="sr-only" onChange={handleFileChange} accept={AcceptedFileExtensions} disabled={isLoading} />
                </div>
                {selectedFile && (
                    <div className="mt-1 p-2 bg-gray-700/50 rounded-md border border-gray-600/70">
                        <p className="text-xs text-gray-300 truncate">Selected: <span className="font-medium text-indigo-400">{selectedFile.name}</span></p>
                        <p className="text-xs text-gray-500">Size: {(selectedFile.size / 1024).toFixed(2)} KB</p>
                    </div>
                )}
            </div>

            {selectedFile && (
                 <div className="relative">
                    <label htmlFor="language-select-file" className="block text-sm text-gray-400 mb-1">
                        Language (Override if needed)
                    </label>
                    <select
                        id="language-select-file"
                        name="language-select-file"
                        className="w-full bg-gray-700/80 border border-gray-600 text-gray-200 rounded-lg p-2.5 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 appearance-none bg-no-repeat bg-right-2.5"
                        style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 20 20' fill='%239ca3af'%3E%3Cpath fill-rule='evenodd' d='M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z' clip-rule='evenodd' /%3E%3C/svg%3E")`, backgroundSize: '1.25em' }}
                        value={selectedLanguage || ''}
                        onChange={handleLanguageSelectChange}
                        disabled={isLoading}
                        aria-label="Select programming language for uploaded file"
                    >
                        {selectedLanguage === LangEnum.UNKNOWN && <option value={LangEnum.UNKNOWN} disabled>Select language...</option>}
                        {languageOptions.map(opt => (
                            <option key={opt.value} value={opt.value}>{opt.label}</option>
                        ))}
                    </select>
                </div>
            )}

            <button
                type="button"
                onClick={onSubmit}
                disabled={isSubmitDisabled}
                className="w-full mt-auto bg-indigo-500 hover:bg-indigo-600 text-white py-3 px-4 rounded-lg flex items-center justify-center space-x-2 transition-colors font-medium disabled:bg-gray-600 disabled:text-gray-400 disabled:cursor-not-allowed"
                aria-label="Analyze uploaded code"
            >
                {isLoading ? (
                    <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                ) : (
                    <span className="material-icons text-lg">analytics</span>
                )}
                <span>{isLoading ? 'Analyzing...' : 'Analyze Code'}</span>
            </button>
        </div>
    );
};
