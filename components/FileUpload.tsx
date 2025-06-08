
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
        event.preventDefault();
        event.stopPropagation();
        if (isLoading) return;
        document.getElementById('file-drop-zone')?.classList.remove('border-sky-500', 'bg-slate-700/80');
        document.getElementById('file-drop-zone')?.classList.add('border-slate-600', 'bg-slate-700/40');
        if (event.dataTransfer.files && event.dataTransfer.files[0]) {
            onFileSelect(event.dataTransfer.files[0]);
        }
    };

    const handleDragOver = (event: React.DragEvent<HTMLDivElement>) => {
        event.preventDefault();
        event.stopPropagation();
        if (isLoading) return;
        document.getElementById('file-drop-zone')?.classList.add('border-sky-500', 'bg-slate-700/80');
        document.getElementById('file-drop-zone')?.classList.remove('border-slate-600', 'bg-slate-700/40');
    };

    const handleDragLeave = (event: React.DragEvent<HTMLDivElement>) => {
        event.preventDefault();
        event.stopPropagation();
        document.getElementById('file-drop-zone')?.classList.remove('border-sky-500', 'bg-slate-700/80');
        document.getElementById('file-drop-zone')?.classList.add('border-slate-600', 'bg-slate-700/40');
    };
    
    return (
        <div className="space-y-8">
             <div>
                <h2 className="text-2xl font-semibold text-sky-300 mb-5 border-b border-slate-700 pb-3">Submit Your Code</h2>
                <label htmlFor="file-upload-input" className="block text-base font-medium text-slate-300 mb-2">
                    Upload File
                </label>
                <div 
                    id="file-drop-zone"
                    className={`mt-2 flex flex-col items-center justify-center px-6 py-12 border-2 ${selectedFile ? 'border-sky-500' : 'border-slate-600'} border-dashed rounded-xl hover:border-sky-400 transition-all duration-200 ease-in-out bg-slate-700/40 hover:bg-slate-700/60 cursor-pointer group`}
                    onDrop={handleDrop}
                    onDragOver={handleDragOver}
                    onDragLeave={handleDragLeave}
                    onClick={() => !isLoading && document.getElementById('file-upload-input')?.click()}
                    role="button"
                    aria-label="File upload zone"
                >
                    <div className="text-center">
                        <span className={`material-icons text-6xl mb-3 transition-colors duration-200 ${selectedFile ? 'text-sky-400' : 'text-slate-500 group-hover:text-sky-500'}`}>
                            {selectedFile ? 'file_present' : 'cloud_upload'}
                        </span>
                        <div className="flex text-base text-slate-300 justify-center items-center">
                            <span
                                className="relative bg-slate-800/80 rounded-lg font-medium text-sky-300 hover:text-sky-200 focus-within:outline-none focus-within:ring-2 focus-within:ring-offset-2 focus-within:ring-offset-slate-900 focus-within:ring-sky-500 px-4 py-2.5 transition-colors shadow-md hover:shadow-lg"
                            >
                                <span>{selectedFile ? 'Change File' : 'Choose File'}</span>
                                <input id="file-upload-input" name="file-upload-input" type="file" className="sr-only" onChange={handleFileChange} accept={AcceptedFileExtensions} disabled={isLoading} />
                            </span>
                            {!selectedFile && <p className="pl-2.5 self-center text-slate-400">or drag and drop</p>}
                        </div>
                        <p className="text-sm text-slate-500 mt-3">{AcceptedFileExtensions.split(',').map(ext => ext.substring(1).toUpperCase()).join(', ')} files. Max 1MB recommended.</p>
                    </div>
                </div>
                {selectedFile && (
                    <div className="mt-4 p-3.5 bg-slate-700/60 rounded-lg border border-slate-600/80 shadow">
                        <p className="text-base text-slate-200 truncate">Selected: <span className="font-semibold text-sky-300">{selectedFile.name}</span></p>
                        <p className="text-sm text-slate-400">Size: {(selectedFile.size / 1024).toFixed(2)} KB</p>
                    </div>
                )}
            </div>

            {selectedFile && (
                 <div className="relative">
                    <label htmlFor="language-select" className="block text-base font-medium text-slate-300 mb-2">
                        Detected Language (Override if needed)
                    </label>
                    <div className="relative group">
                        <select
                            id="language-select"
                            name="language-select"
                            className="block w-full appearance-none pl-4 pr-12 py-3 text-base border border-slate-600 bg-slate-700/80 text-slate-100 focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-sky-500 sm:text-sm rounded-lg disabled:opacity-60 transition-all duration-150 shadow-md hover:border-slate-500"
                            value={selectedLanguage || ''}
                            onChange={handleLanguageSelectChange}
                            disabled={isLoading}
                        >
                            {selectedLanguage === LangEnum.UNKNOWN && <option value={LangEnum.UNKNOWN} disabled>Select language...</option>}
                            {languageOptions.map(opt => (
                                <option key={opt.value} value={opt.value}>{opt.label}</option>
                            ))}
                        </select>
                        <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-3.5 text-slate-400 group-hover:text-sky-400 transition-colors">
                            <span className="material-icons text-2xl">unfold_more</span>
                        </div>
                    </div>
                </div>
            )}

            <button
                type="button"
                onClick={onSubmit}
                disabled={isLoading || !selectedFile || !selectedLanguage || selectedLanguage === LangEnum.UNKNOWN}
                className="w-full flex items-center justify-center py-3.5 px-5 border border-transparent rounded-lg shadow-lg text-lg font-semibold text-white bg-gradient-to-r from-sky-500 to-cyan-500 hover:from-sky-400 hover:to-cyan-400 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-slate-800 focus:ring-sky-400 disabled:from-slate-600 disabled:to-slate-700 disabled:text-slate-400 disabled:cursor-not-allowed transition-all duration-200 ease-in-out group transform hover:scale-102 active:scale-98"
            >
                <span className={`material-icons mr-2.5 text-2xl group-disabled:opacity-50 transition-opacity ${isLoading ? 'hidden' : 'inline-block'}`}>
                    insights
                </span>
                 {isLoading && (
                    <svg className="animate-spin h-6 w-6 text-white mr-2.5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                )}
                <span>{isLoading ? 'Analyzing...' : 'Analyze Code'}</span>
            </button>
        </div>
    );
};
