
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

    const handleDrop = (event: React.DragEvent<HTMLDivElement>) => {
        event.preventDefault(); event.stopPropagation(); if (isLoading) return;
        const dropZone = event.currentTarget;
        dropZone?.classList.remove('border-blue-500', 'bg-slate-800/70');
        dropZone?.classList.add('border-slate-700', 'bg-slate-800/50');
        if (event.dataTransfer.files && event.dataTransfer.files[0]) {
            onFileSelect(event.dataTransfer.files[0]);
        }
    };

    const handleDragOver = (event: React.DragEvent<HTMLDivElement>) => {
        event.preventDefault(); event.stopPropagation(); if (isLoading) return;
        const dropZone = event.currentTarget;
        dropZone?.classList.add('border-blue-500', 'bg-slate-800/70');
        dropZone?.classList.remove('border-slate-700', 'bg-slate-800/50');
    };

    const handleDragLeave = (event: React.DragEvent<HTMLDivElement>) => {
        event.preventDefault(); event.stopPropagation();
        const dropZone = event.currentTarget;
        dropZone?.classList.remove('border-blue-500', 'bg-slate-800/70');
        dropZone?.classList.add('border-slate-700', 'bg-slate-800/50');
    };
    
    const isSubmitDisabled = isLoading || !selectedFile || !selectedLanguage || selectedLanguage === LangEnum.UNKNOWN;
    const acceptedExtUpper = AcceptedFileExtensions.replace(/\./g, '').toUpperCase().split(',').join(', ');

    return (
        <>
            <div>
                <h2 className="text-lg font-semibold mb-3 text-slate-100">Upload Your Code</h2>
                <label htmlFor="file-upload-input" className="block text-sm font-medium text-slate-400 mb-1.5">
                    Code File
                </label>
                <div 
                    id="file-drop-zone"
                    className={`mt-1 flex flex-col items-center justify-center px-5 py-8 border-2 ${selectedFile ? 'border-blue-500' : 'border-slate-700'} border-dashed rounded-lg hover:border-blue-400 transition-colors duration-150 ease-in-out bg-slate-800/50 hover:bg-slate-800/70 cursor-pointer group`}
                    onDrop={handleDrop}
                    onDragOver={handleDragOver}
                    onDragLeave={handleDragLeave}
                    onClick={() => !isLoading && document.getElementById('file-upload-input')?.click()}
                    role="button"
                    aria-label="File upload zone"
                    tabIndex={isLoading ? -1 : 0}
                    onKeyPress={(e) => { if (e.key === 'Enter' || e.key === ' ') !isLoading && document.getElementById('file-upload-input')?.click(); }}
                >
                    <div className="text-center">
                        <span className={`material-icons-outlined text-5xl mb-2 transition-colors duration-150 ${selectedFile ? 'text-blue-400' : 'text-slate-500 group-hover:text-blue-500'}`}>
                            {selectedFile ? 'file_present' : 'cloud_upload'}
                        </span>
                        <div className="flex text-sm text-slate-300 justify-center items-center">
                            <span
                                className="relative bg-slate-700/60 rounded-md font-medium text-blue-400 hover:text-blue-300 focus-within:outline-none focus-within:ring-2 focus-within:ring-offset-2 focus-within:ring-offset-slate-900 focus-within:ring-blue-500 px-3 py-1.5 transition-colors shadow-sm"
                            >
                                <span>{selectedFile ? 'Change File' : 'Choose File'}</span>
                                <input id="file-upload-input" name="file-upload-input" type="file" className="sr-only" onChange={handleFileChange} accept={AcceptedFileExtensions} disabled={isLoading} />
                            </span>
                            {!selectedFile && <p className="pl-2 self-center text-slate-400">or drag and drop</p>}
                        </div>
                        <p className="text-xs text-slate-500 mt-2.5">{acceptedExtUpper} files. Max 1MB.</p>
                    </div>
                </div>
                {selectedFile && (
                    <div className="mt-3 p-2.5 bg-slate-800/60 rounded-md border border-slate-700/80">
                        <p className="text-xs text-slate-300 truncate">Selected: <span className="font-medium text-blue-400">{selectedFile.name}</span></p>
                        <p className="text-xs text-slate-500">Size: {(selectedFile.size / 1024).toFixed(2)} KB</p>
                    </div>
                )}
            </div>

            {selectedFile && (
                 <div className="relative">
                    <label htmlFor="language-select" className="block text-sm font-medium text-slate-400 mb-1.5">
                        Language (Override if needed)
                    </label>
                    <select
                        id="language-select"
                        name="language-select"
                        className="w-full bg-slate-800 border border-slate-700 text-slate-200 rounded-lg p-2.5 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 appearance-none bg-no-repeat bg-right-2.5"
                        style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 20 20' fill='%2394a3b8'%3E%3Cpath fill-rule='evenodd' d='M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z' clip-rule='evenodd' /%3E%3C/svg%3E")`, backgroundSize: '1.25em' }}
                        value={selectedLanguage || ''}
                        onChange={handleLanguageSelectChange}
                        disabled={isLoading}
                        aria-label="Select programming language"
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
                className="w-full bg-blue-600 hover:bg-blue-500 text-white font-medium py-3 px-4 rounded-lg flex items-center justify-center gap-2 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:ring-offset-slate-900 disabled:bg-slate-700 disabled:text-slate-500 disabled:cursor-not-allowed"
                aria-label="Analyze code"
            >
                {isLoading ? (
                    <div className="w-5 h-5 border-[3px] border-white border-t-transparent rounded-full animate-spin"></div>
                ) : (
                    <span className="material-icons-outlined text-xl">insights</span>
                )}
                <span>{isLoading ? 'Analyzing...' : 'Analyze Code'}</span>
            </button>
        </>
    );
};