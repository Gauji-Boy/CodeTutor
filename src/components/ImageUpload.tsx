import React from 'react';

interface ImageUploadProps {
    onFileSelect: (file: File) => void;
    selectedFile: File | null;
    previewUrl: string | null;
    isLoading: boolean;
}

const AcceptedImageExtensions = "image/jpeg,image/png,image/webp,image/gif";

export const ImageUpload: React.FC<ImageUploadProps> = ({
    onFileSelect,
    selectedFile,
    previewUrl,
    isLoading,
}) => {
    const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        if (event.target.files && event.target.files[0]) {
            onFileSelect(event.target.files[0]);
        }
    };

    const handleDrop = (event: React.DragEvent<HTMLDivElement>) => {
        event.preventDefault(); event.stopPropagation(); if (isLoading) return;
        event.currentTarget.classList.remove('border-[var(--accent-primary)]', 'bg-[var(--bg-tertiary)]/50');
        if (event.dataTransfer.files && event.dataTransfer.files[0]) {
            if (event.dataTransfer.files[0].type.startsWith('image/')) {
                onFileSelect(event.dataTransfer.files[0]);
            }
        }
    };

    const handleDragOver = (event: React.DragEvent<HTMLDivElement>) => {
        event.preventDefault(); event.stopPropagation(); if (isLoading) return;
        event.currentTarget.classList.add('border-[var(--accent-primary)]', 'bg-[var(--bg-tertiary)]/50');
    };

    const handleDragLeave = (event: React.DragEvent<HTMLDivElement>) => {
        event.preventDefault(); event.stopPropagation();
        event.currentTarget.classList.remove('border-[var(--accent-primary)]', 'bg-[var(--bg-tertiary)]/50');
    };

    const fileInputId = 'image-upload-input-main';

    return (
        <div className="flex flex-col space-y-3 pt-3 border-t border-[var(--border-color)]">
            <div>
                <h3 className="text-sm sm:text-base font-medium text-[var(--text-primary)] mb-2">Upload Image with Code</h3>
                <div 
                    className={`border-2 border-dashed ${selectedFile ? 'border-[var(--accent-primary)]' : 'border-[var(--border-color)]'} rounded-lg p-4 flex flex-col items-center justify-center text-center mb-2 hover:border-[var(--accent-primary)] transition-colors cursor-pointer min-h-[160px] bg-transparent hover:bg-[var(--bg-tertiary)]/40`}
                    onClick={() => !isLoading && document.getElementById(fileInputId)?.click()}
                    onDrop={handleDrop}
                    onDragOver={handleDragOver}
                    onDragLeave={handleDragLeave}
                >
                    {previewUrl ? (
                        <img src={previewUrl} alt="Code preview" className="max-h-32 w-auto object-contain rounded-md" />
                    ) : (
                        <>
                            <span className="material-icons-outlined text-4xl mb-2 text-[var(--text-muted)]">image</span>
                            <p className="text-[var(--text-secondary)] text-sm mb-1">
                                <span className="text-[var(--accent-primary)] font-medium">Choose Image</span> or drag and drop
                            </p>
                            <p className="text-xs text-[var(--text-muted)]">PNG, JPG, WEBP, GIF</p>
                        </>
                    )}
                    <input id={fileInputId} type="file" className="sr-only" onChange={handleFileChange} accept={AcceptedImageExtensions} disabled={isLoading} />
                </div>
                {selectedFile && (
                    <div className="mt-1 p-1.5 bg-[var(--bg-tertiary)]/60 rounded-md border border-[var(--border-color)] text-xs">
                        <p className="text-[var(--text-secondary)] truncate">Selected: <span className="font-medium text-[var(--accent-primary)]">{selectedFile.name}</span></p>
                    </div>
                )}
            </div>
        </div>
    );
};