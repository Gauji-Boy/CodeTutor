
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
        event.currentTarget.classList.remove('border-indigo-500', 'bg-gray-700/30');
        if (event.dataTransfer.files && event.dataTransfer.files[0]) {
            if (event.dataTransfer.files[0].type.startsWith('image/')) {
                onFileSelect(event.dataTransfer.files[0]);
            }
        }
    };

    const handleDragOver = (event: React.DragEvent<HTMLDivElement>) => {
        event.preventDefault(); event.stopPropagation(); if (isLoading) return;
        event.currentTarget.classList.add('border-indigo-500', 'bg-gray-700/30');
    };

    const handleDragLeave = (event: React.DragEvent<HTMLDivElement>) => {
        event.preventDefault(); event.stopPropagation();
        event.currentTarget.classList.remove('border-indigo-500', 'bg-gray-700/30');
    };

    const fileInputId = 'image-upload-input-main';

    return (
        <div className="flex flex-col space-y-3 pt-3 border-t border-gray-700/70">
            <div>
                <h3 className="text-sm sm:text-base font-medium text-white mb-2">Upload Image with Code</h3>
                <div 
                    className={`border-2 border-dashed ${selectedFile ? 'border-indigo-500' : 'border-gray-600'} rounded-lg p-4 flex flex-col items-center justify-center text-center mb-2 hover:border-indigo-400 transition-colors cursor-pointer min-h-[160px] bg-transparent hover:bg-gray-700/20`}
                    onClick={() => !isLoading && document.getElementById(fileInputId)?.click()}
                    onDrop={handleDrop}
                    onDragOver={handleDragOver}
                    onDragLeave={handleDragLeave}
                >
                    {previewUrl ? (
                        <img src={previewUrl} alt="Code preview" className="max-h-32 w-auto object-contain rounded-md" />
                    ) : (
                        <>
                            <span className="material-icons-outlined text-4xl mb-2 text-gray-500">image</span>
                            <p className="text-gray-300 text-sm mb-1">
                                <span className="text-indigo-400 font-medium">Choose Image</span> or drag and drop
                            </p>
                            <p className="text-xs text-gray-500">PNG, JPG, WEBP, GIF</p>
                        </>
                    )}
                    <input id={fileInputId} type="file" className="sr-only" onChange={handleFileChange} accept={AcceptedImageExtensions} disabled={isLoading} />
                </div>
                {selectedFile && (
                    <div className="mt-1 p-1.5 bg-gray-700/40 rounded-md border border-gray-600/50 text-xs">
                        <p className="text-gray-300 truncate">Selected: <span className="font-medium text-indigo-400">{selectedFile.name}</span></p>
                    </div>
                )}
            </div>
        </div>
    );
};
