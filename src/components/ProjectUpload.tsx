import React from 'react';
import toast from 'react-hot-toast';

interface ProjectUploadProps {
    onProjectFilesSelected: (files: FileList) => void;
    projectName: string | null;
    fileCount: number;
    isLoading: boolean;
}

export const ProjectUpload: React.FC<ProjectUploadProps> = ({
    onProjectFilesSelected,
    projectName,
    fileCount,
    isLoading
}) => {
    const fileInputId = 'project-upload-input-home';

    const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        if (event.target.files) {
            onProjectFilesSelected(event.target.files);
        }
    };

    const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
        e.preventDefault();
        toast.error('Drag-and-drop is not supported for folders. Please click to select a folder.', { icon: 'ℹ️' });
    };

    const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
        e.preventDefault(); // Necessary to allow drop
    };

    return (
        <div className="flex flex-col space-y-3 pt-3 border-t border-gray-700/70">
            <div>
                <h3 className="text-sm sm:text-base font-medium text-white mb-2">Select Project Folder</h3>
                <div 
                    className={`border-2 border-dashed ${projectName ? 'border-indigo-500' : 'border-gray-600'} rounded-lg p-4 flex flex-col items-center justify-center text-center mb-2 hover:border-indigo-400 transition-colors cursor-pointer min-h-[140px] sm:min-h-[160px] bg-transparent hover:bg-gray-700/20`}
                    onClick={() => !isLoading && document.getElementById(fileInputId)?.click()}
                    onDrop={handleDrop}
                    onDragOver={handleDragOver}
                    role="button"
                    aria-label="Project folder upload zone"
                    tabIndex={isLoading ? -1 : 0}
                    onKeyPress={(e) => { if (e.key === 'Enter' || e.key === ' ') !isLoading && document.getElementById(fileInputId)?.click(); }}
                >
                    <span className={`material-icons-outlined text-3xl sm:text-4xl mb-1 sm:mb-2 transition-colors ${projectName ? 'text-indigo-400' : 'text-gray-500'}`}>
                        {projectName ? 'folder_special' : 'folder_open'}
                    </span>
                    <p className="text-gray-300 text-xs sm:text-sm mb-1">
                        <span className="text-indigo-400 hover:text-indigo-300 font-medium">
                            {projectName ? 'Change Folder' : 'Choose Folder'}
                        </span>
                    </p>
                    <p className="text-xs text-gray-500 leading-tight px-1">Sub-folders will be included.</p>
                    <input 
                        id={fileInputId} 
                        type="file" 
                        className="sr-only" 
                        onChange={handleFileChange} 
                        disabled={isLoading}
                        {...{ webkitdirectory: "", directory: "", multiple: true }}
                        aria-hidden="true"
                    />
                </div>
                {projectName && (
                    <div className="mt-1 p-1.5 bg-gray-700/40 rounded-md border border-gray-600/50 text-xs">
                        <p className="text-gray-300 truncate">Project: <span className="font-medium text-indigo-400">{projectName}</span></p>
                        <p className="text-gray-500">Files read: {fileCount}</p>
                    </div>
                )}
            </div>
        </div>
    );
};