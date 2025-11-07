import React from 'react';

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
        console.error('Drag-and-drop is not supported for folders. Please click to select a folder.');
    };

    const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
        e.preventDefault(); // Necessary to allow drop
    };

    return (
        <div className="flex flex-col space-y-3 pt-3 border-t border-[var(--border-color)]">
            <div>
                <h3 className="text-sm sm:text-base font-medium text-[var(--text-primary)] mb-2">Select Project Folder</h3>
                <div 
                    className={`border-2 border-dashed ${projectName ? 'border-[var(--accent-primary)]' : 'border-[var(--border-color)]'} rounded-lg p-4 flex flex-col items-center justify-center text-center mb-2 hover:border-[var(--accent-primary)] transition-colors cursor-pointer min-h-[160px] bg-transparent hover:bg-[var(--bg-tertiary)]/40`}
                    onClick={() => !isLoading && document.getElementById(fileInputId)?.click()}
                    onDrop={handleDrop}
                    onDragOver={handleDragOver}
                    role="button"
                    aria-label="Project folder upload zone"
                    tabIndex={isLoading ? -1 : 0}
                    onKeyPress={(e) => { if (e.key === 'Enter' || e.key === ' ') !isLoading && document.getElementById(fileInputId)?.click(); }}
                >
                    <span className={`material-icons-outlined text-3xl sm:text-4xl mb-1 sm:mb-2 transition-colors ${projectName ? 'text-[var(--accent-primary)]' : 'text-[var(--text-muted)]'}`}>
                        {projectName ? 'folder_special' : 'folder_open'}
                    </span>
                    <p className="text-[var(--text-secondary)] text-xs sm:text-sm mb-1">
                        <span className="text-[var(--accent-primary)] hover:text-[var(--accent-primary-hover)] font-medium">
                            {projectName ? 'Change Folder' : 'Choose Folder'}
                        </span>
                    </p>
                    <p className="text-xs text-[var(--text-muted)] leading-tight px-1">Sub-folders will be included.</p>
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
                    <div className="mt-1 p-1.5 bg-[var(--bg-tertiary)]/60 rounded-md border border-[var(--border-color)] text-xs">
                        <p className="text-[var(--text-secondary)] truncate">Project: <span className="font-medium text-[var(--accent-primary)]">{projectName}</span></p>
                        <p className="text-[var(--text-muted)]">Files read: {fileCount}</p>
                    </div>
                )}
            </div>
        </div>
    );
};