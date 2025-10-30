
import React from 'react';
import type { SupportedLanguage } from '../types';
import { LanguageDisplayNames, AcceptedFileExtensions, SupportedLanguage as LangEnum } from '../types';

interface FileUploadProps {
    onFileSelect: (file: File) => void;
    selectedFile: File | null;
    selectedLanguage: SupportedLanguage | null;
    onLanguageChange: (language: SupportedLanguage) => void;
    onSubmit: () => void; // This prop is still passed but the button is removed from render
    isLoading: boolean;
}

const FileUploadComponent: React.FC<FileUploadProps> = ({
    onFileSelect,
    selectedFile,
    selectedLanguage,
    onLanguageChange,
    // onSubmit, // Button is removed from this component
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

    const fileUploadZoneId = "file-drop-zone-main"; // Unique ID
    const fileInputId = "file-upload-input-main"; // Unique ID

    const handleDrop = (event: React.DragEvent<HTMLDivElement>) => {
        event.preventDefault(); event.stopPropagation(); if (isLoading) return;
        const dropZone = event.currentTarget;
        dropZone?.classList.remove('border-indigo-500', 'bg-gray-700/30');
        dropZone?.classList.add('border-gray-600', 'bg-transparent'); // Revert to base style
        if (event.dataTransfer.files && event.dataTransfer.files[0]) {
            onFileSelect(event.dataTransfer.files[0]);
        }
    };

    const handleDragOver = (event: React.DragEvent<HTMLDivElement>) => {
        event.preventDefault(); event.stopPropagation(); if (isLoading) return;
        const dropZone = event.currentTarget;
        dropZone?.classList.add('border-indigo-500', 'bg-gray-700/30'); // Highlight style
        dropZone?.classList.remove('border-gray-600', 'bg-transparent');
    };

    const handleDragLeave = (event: React.DragEvent<HTMLDivElement>) => {
        event.preventDefault(); event.stopPropagation();
        const dropZone = event.currentTarget;
        dropZone?.classList.remove('border-indigo-500', 'bg-gray-700/30');
        dropZone?.classList.add('border-gray-600', 'bg-transparent');
    };
        
    // Generate a shorter list of extensions for display
    const displayFileExtensionsShort = "PY, JS, TS, Java, C++, HTML, CSS, etc.";

    return (
        <div className="flex flex-col space-y-3 pt-3 border-t border-gray-700/70">
            <div>
                <h3 className="text-sm sm:text-base font-medium text-white mb-2">Upload Your Code File</h3>
                <label htmlFor={fileInputId} className="sr-only">
                    Code File
                </label>
                <div 
                    id={fileUploadZoneId}
                    className={`border-2 border-dashed ${selectedFile ? 'border-indigo-500' : 'border-gray-600'} rounded-lg p-4 flex flex-col items-center justify-center text-center mb-2 hover:border-indigo-400 transition-colors cursor-pointer min-h-[140px] sm:min-h-[160px] bg-transparent hover:bg-gray-700/20`}
                    onDrop={handleDrop}
                    onDragOver={handleDragOver}
                    onDragLeave={handleDragLeave}
                    onClick={() => !isLoading && document.getElementById(fileInputId)?.click()}
                    role="button"
                    aria-label="File upload zone"
                    tabIndex={isLoading ? -1 : 0}
                    onKeyPress={(e) => { if (e.key === 'Enter' || e.key === ' ') !isLoading && document.getElementById(fileInputId)?.click(); }}
                >
                    <span className={`material-icons-outlined text-3xl sm:text-4xl mb-1 sm:mb-2 transition-colors ${selectedFile ? 'text-indigo-400' : 'text-gray-500 group-hover:text-indigo-500'}`}>
                        {selectedFile ? 'file_present' : 'cloud_upload'}
                    </span>
                    <p className="text-gray-300 text-xs sm:text-sm mb-1">
                        <span className="text-indigo-400 hover:text-indigo-300 font-medium">{selectedFile ? 'Change File' : 'Choose File'}</span>
                        {!selectedFile && <span className="text-gray-500"> or drag and drop</span>}
                    </p>
                    <p className="text-xs text-gray-500 leading-tight px-1">{displayFileExtensionsShort}</p>
                    <input id={fileInputId} name={fileInputId} type="file" className="sr-only" onChange={handleFileChange} accept={AcceptedFileExtensions} disabled={isLoading} />
                </div>
                {selectedFile && (
                    <div className="mt-1 p-1.5 bg-gray-700/40 rounded-md border border-gray-600/50 text-xs">
                        <p className="text-gray-300 truncate">Selected: <span className="font-medium text-indigo-400">{selectedFile.name}</span></p>
                        <p className="text-gray-500">Size: {(selectedFile.size / 1024).toFixed(2)} KB</p>
                    </div>
                )}
            </div>

            {selectedFile && (
                 <div className="relative">
                    <label htmlFor="language-select-file" className="block text-xs text-gray-400 mb-1">
                        Language (Override if needed)
                    </label>
                    <select
                        id="language-select-file" // Ensure unique ID if multiple selects exist on page
                        name="language-select-file"
                        className="w-full bg-gray-700/80 border border-gray-600 text-gray-200 rounded-md p-2.5 text-sm focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 appearance-none bg-no-repeat bg-right-2.5"
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
            {/* The main submit button is now in HomePage.tsx */}
        </div>
    );
};

export const FileUpload = React.memo(FileUploadComponent);