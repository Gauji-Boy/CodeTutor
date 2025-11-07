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
        dropZone?.classList.remove('border-[var(--accent-primary)]', 'bg-[var(--bg-tertiary)]/50');
        dropZone?.classList.add('border-[var(--border-color)]', 'bg-transparent'); // Revert to base style
        if (event.dataTransfer.files && event.dataTransfer.files[0]) {
            onFileSelect(event.dataTransfer.files[0]);
        }
    };

    const handleDragOver = (event: React.DragEvent<HTMLDivElement>) => {
        event.preventDefault(); event.stopPropagation(); if (isLoading) return;
        const dropZone = event.currentTarget;
        dropZone?.classList.add('border-[var(--accent-primary)]', 'bg-[var(--bg-tertiary)]/50'); // Highlight style
        dropZone?.classList.remove('border-[var(--border-color)]', 'bg-transparent');
    };

    const handleDragLeave = (event: React.DragEvent<HTMLDivElement>) => {
        event.preventDefault(); event.stopPropagation();
        const dropZone = event.currentTarget;
        dropZone?.classList.remove('border-[var(--accent-primary)]', 'bg-[var(--bg-tertiary)]/50');
        dropZone?.classList.add('border-[var(--border-color)]', 'bg-transparent');
    };
        
    // Generate a shorter list of extensions for display
    const displayFileExtensionsShort = "PY, JS, TS, Java, C++, HTML, CSS, etc.";

    return (
        <div className="flex flex-col space-y-3 pt-3 border-t border-[var(--border-color)]">
            <div>
                <h3 className="text-sm sm:text-base font-medium text-[var(--text-primary)] mb-2">Upload Your Code File</h3>
                <label htmlFor={fileInputId} className="sr-only">
                    Code File
                </label>
                <div 
                    id={fileUploadZoneId}
                    className={`border-2 border-dashed ${selectedFile ? 'border-[var(--accent-primary)]' : 'border-[var(--border-color)]'} rounded-lg p-4 flex flex-col items-center justify-center text-center mb-2 hover:border-[var(--accent-primary)] transition-colors cursor-pointer min-h-[160px] bg-transparent hover:bg-[var(--bg-tertiary)]/40`}
                    onDrop={handleDrop}
                    onDragOver={handleDragOver}
                    onDragLeave={handleDragLeave}
                    onClick={() => !isLoading && document.getElementById(fileInputId)?.click()}
                    role="button"
                    aria-label="File upload zone"
                    tabIndex={isLoading ? -1 : 0}
                    onKeyPress={(e) => { if (e.key === 'Enter' || e.key === ' ') !isLoading && document.getElementById(fileInputId)?.click(); }}
                >
                    <span className={`material-icons-outlined text-3xl sm:text-4xl mb-1 sm:mb-2 transition-colors ${selectedFile ? 'text-[var(--accent-primary)]' : 'text-[var(--text-muted)] group-hover:text-[var(--accent-primary)]'}`}>
                        {selectedFile ? 'file_present' : 'cloud_upload'}
                    </span>
                    <p className="text-[var(--text-secondary)] text-xs sm:text-sm mb-1">
                        <span className="text-[var(--accent-primary)] hover:text-[var(--accent-primary-hover)] font-medium">{selectedFile ? 'Change File' : 'Choose File'}</span>
                        {!selectedFile && <span className="text-[var(--text-muted)]"> or drag and drop</span>}
                    </p>
                    <p className="text-xs text-[var(--text-muted)] leading-tight px-1">{displayFileExtensionsShort}</p>
                    <input id={fileInputId} name={fileInputId} type="file" className="sr-only" onChange={handleFileChange} accept={AcceptedFileExtensions} disabled={isLoading} />
                </div>
                {selectedFile && (
                    <div className="mt-1 p-1.5 bg-[var(--bg-tertiary)]/60 rounded-md border border-[var(--border-color)] text-xs">
                        <p className="text-[var(--text-secondary)] truncate">Selected: <span className="font-medium text-[var(--accent-primary)]">{selectedFile.name}</span></p>
                        <p className="text-[var(--text-muted)]">Size: {(selectedFile.size / 1024).toFixed(2)} KB</p>
                    </div>
                )}
            </div>

            {selectedFile && (
                 <div className="relative">
                    <label htmlFor="language-select-file" className="block text-xs text-[var(--text-muted)] mb-1">
                        Language (Override if needed)
                    </label>
                    <select
                        id="language-select-file" // Ensure unique ID if multiple selects exist on page
                        name="language-select-file"
                        className="w-full bg-[var(--bg-tertiary)] border border-[var(--border-color)] text-[var(--text-primary)] rounded-md p-2.5 text-sm focus:ring-1 focus:ring-[var(--accent-primary)] focus:border-[var(--accent-primary)] appearance-none bg-no-repeat bg-right-2.5"
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