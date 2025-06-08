
import React from 'react';

interface ApiKeyHelpModalProps {
    isOpen: boolean;
    onClose: () => void;
}

export const ApiKeyHelpModal: React.FC<ApiKeyHelpModalProps> = ({ isOpen, onClose }) => {
    if (!isOpen) return null;

    return (
        <div
            className="fixed inset-0 bg-slate-900/80 backdrop-blur-sm flex items-center justify-center z-[100] p-4"
            onClick={onClose} 
            aria-modal="true"
            role="dialog"
            aria-labelledby="apiKeyHelpModalTitle"
        >
            <div
                className="bg-slate-800 p-6 sm:p-8 rounded-xl shadow-2xl max-w-2xl w-full ring-1 ring-slate-700/50 relative"
                onClick={(e) => e.stopPropagation()} 
            >
                <button
                    onClick={onClose}
                    className="absolute top-3.5 right-3.5 text-slate-400 hover:text-sky-300 transition-colors p-1 rounded-full focus:outline-none focus:ring-2 focus:ring-sky-500"
                    aria-label="Close API Key Help"
                >
                    <span className="material-icons text-3xl">close</span>
                </button>
                <h2 id="apiKeyHelpModalTitle" className="text-2xl font-semibold text-sky-300 mb-5 border-b border-slate-700 pb-3.5">
                    API Key Configuration
                </h2>
                <div className="text-slate-300 space-y-4 text-base leading-relaxed max-h-[70vh] overflow-y-auto custom-scrollbar-small pr-2">
                    <p>
                        To enable the AI-powered features of CodeTutor AI, you need to provide a Gemini API Key.
                    </p>
                    <p>
                        Follow these steps to set it up:
                    </p>
                    <ol className="list-decimal list-inside space-y-3 pl-2">
                        <li>
                            <strong>Locate Project Root:</strong> Find the main directory of this project on your computer. This is where files like 
                            <code className="font-fira-code bg-slate-700/80 px-1.5 py-0.5 rounded text-sky-300 mx-0.5">package.json</code> and
                            <code className="font-fira-code bg-slate-700/80 px-1.5 py-0.5 rounded text-sky-300 mx-0.5">vite.config.js</code> are located.
                        </li>
                        <li>
                            <strong>Create <code className="font-fira-code bg-slate-700/80 px-1.5 py-0.5 rounded text-sky-300">.env</code> File:</strong>
                            If it doesn't already exist, create a new file in the project root directory and name it exactly <code className="font-fira-code bg-slate-700/80 px-1.5 py-0.5 rounded text-sky-300">.env</code>.
                        </li>
                        <li>
                            <strong>Add API Key:</strong> Open the <code className="font-fira-code bg-slate-700/80 px-1.5 py-0.5 rounded text-sky-300">.env</code> file with a text editor.
                            Add your Gemini API key using the variable name <strong className="text-amber-300">API_KEY</strong>, like this:
                            <pre className="bg-slate-900 p-3.5 mt-2 rounded-md text-sm font-fira-code ring-1 ring-slate-700/70 overflow-x-auto custom-scrollbar-small">
                                API_KEY="YOUR_ACTUAL_GEMINI_API_KEY"
                            </pre>
                             Replace <code className="font-fira-code bg-slate-700/80 px-1.5 py-0.5 rounded text-sky-300">YOUR_ACTUAL_GEMINI_API_KEY</code> with your real, valid Gemini API key.
                             <br />
                             <span className="text-yellow-400 font-medium">Important:</span> The variable name must be exactly <code className="font-fira-code bg-slate-700/80 px-1.5 py-0.5 rounded text-sky-300">API_KEY</code>. Other names (like <code className="font-fira-code bg-slate-700/80 px-1.5 py-0.5 rounded text-red-400 line-through">GEMINI_API_KEY</code>) will not work.
                        </li>
                        <li>
                            <strong>Restart Development Server:</strong> If the application is currently running (e.g., via <code className="font-fira-code bg-slate-700/80 px-1.5 py-0.5 rounded text-sky-300">npm run dev</code>),
                            you <strong>must stop it and restart it</strong> for the new API key to be recognized by the application.
                        </li>
                    </ol>
                    <p className="text-sm text-slate-400 mt-5 pt-3 border-t border-slate-700">
                        The application is designed to securely access this key from your local environment variables at build/startup time. It is not stored by the application or transmitted elsewhere beyond its necessary use with the Gemini API.
                    </p>
                     <p className="text-sm text-slate-400">
                        If you don't have a Gemini API Key, you can obtain one from the Google AI Studio website.
                    </p>
                </div>
                 <div className="mt-6 pt-4 border-t border-slate-700/50 text-right">
                    <button
                        type="button"
                        onClick={onClose}
                        className="inline-flex justify-center rounded-lg border border-transparent bg-sky-600 px-6 py-2.5 text-base font-medium text-white hover:bg-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-500 focus:ring-offset-2 focus:ring-offset-slate-800 transition-colors shadow-md hover:shadow-lg"
                    >
                        Got it
                    </button>
                 </div>
            </div>
        </div>
    );
};
