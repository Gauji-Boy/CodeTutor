import React, { useState, useCallback, useEffect } from 'react';
import { Toaster } from 'react-hot-toast';
import { FileUpload } from './components/FileUpload';
import { ResultDisplay } from './components/ResultDisplay';
import { LoadingSpinner } from './components/LoadingSpinner';
import { ErrorMessage } from './components/ErrorMessage';
import { FileContentViewer } from './components/FileContentViewer'; // Import new component
import { analyzeCodeWithGemini } from './services/geminiService';
import { AnalysisResult, SupportedLanguage } from './types';
import { LanguageExtensions } from './types';

const App: React.FC = () => {
    const [selectedFile, setSelectedFile] = useState<File | null>(null);
    const [codeContent, setCodeContent] = useState<string | null>(null);
    const [language, setLanguage] = useState<SupportedLanguage | null>(null);
    const [analysisResult, setAnalysisResult] = useState<AnalysisResult | null>(null);
    const [isLoading, setIsLoading] = useState<boolean>(false);
    const [error, setError] = useState<string | null>(null);
    const [apiKeyMissing, setApiKeyMissing] = useState<boolean>(false);

    useEffect(() => {
        if (!process.env.API_KEY) {
            setApiKeyMissing(true);
            setError("Critical Setup Error: The API_KEY is missing. AI functionalities are disabled. Please configure the API_KEY for the application to work.");
        }
    }, []);

    const handleFileSelect = useCallback((file: File) => {
        setSelectedFile(file);
        setError(null); // Clear general errors
        setAnalysisResult(null); // Clear previous analysis results
        setCodeContent(null); // Clear previous code content
        setLanguage(null); // Clear previous language

        const reader = new FileReader();
        reader.onload = (e) => {
            const content = e.target?.result as string;
            setCodeContent(content);

            const extension = file.name.substring(file.name.lastIndexOf('.')).toLowerCase();
            const detectedLang = LanguageExtensions[extension] || SupportedLanguage.UNKNOWN;
            setLanguage(detectedLang);

            if (detectedLang === SupportedLanguage.UNKNOWN) {
                setError(`Unsupported file type: ${extension}. Please upload one of the supported file types: ${Object.keys(LanguageExtensions).map(ext => ext.slice(1).toUpperCase()).join(', ')}.`);
                setSelectedFile(null); // Clear file if unsupported
                setCodeContent(null); // Clear content if unsupported
                setLanguage(null); // Clear language if unsupported
            }
        };
        reader.onerror = () => {
            setError("Error: Failed to read the selected file. Please try again or select a different file.");
            setSelectedFile(null);
            setCodeContent(null);
            setLanguage(null);
        };
        reader.readAsText(file);
    }, []);

    const handleLanguageChange = useCallback((newLanguage: SupportedLanguage) => {
        setLanguage(newLanguage);
        if (error && error.startsWith("Unsupported file type")) { // Clear file type error if language is manually changed
            setError(null);
        }
    }, [error]);

    const handleSubmit = async () => {
        if (apiKeyMissing) {
            setError("Action Required: API_KEY is not configured. Analysis cannot proceed.");
            return;
        }
        if (!codeContent || !language || language === SupportedLanguage.UNKNOWN) {
            setError("Please select a valid code file and ensure its language is correctly identified before analysis.");
            return;
        }

        setIsLoading(true);
        setError(null);
        setAnalysisResult(null); 

        try {
            const result = await analyzeCodeWithGemini(codeContent, language);
            setAnalysisResult(result);
        } catch (err) {
            if (err instanceof Error) {
                setError(`Analysis Error: ${err.message}`);
            } else {
                setError("An unexpected error occurred during the code analysis process.");
            }
            console.error(err);
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <>
            <Toaster 
                position="top-center"
                toastOptions={{
                    duration: 3500,
                    style: {
                        background: '#1E293B', // slate-800
                        color: '#E2E8F0', // slate-200
                        boxShadow: '0 10px 15px -3px rgba(0,0,0,0.2), 0 4px 6px -2px rgba(0,0,0,0.15)',
                        borderRadius: '0.5rem',
                        padding: '12px 18px',
                        fontSize: '0.95rem'
                    },
                    success: {
                        iconTheme: { primary: '#22D3EE', secondary: '#0F1A2A' },
                    },
                     error: {
                        iconTheme: { primary: '#F87171', secondary: '#0F1A2A' },
                    },
                }}
            />
            <div className="min-h-screen flex flex-col text-slate-300">
                <header className="w-full py-3.5 px-4 sm:px-6 lg:px-8 bg-slate-800/50 backdrop-blur-lg shadow-xl sticky top-0 z-50 border-b border-slate-700/70">
                    <div className="max-w-screen-2xl mx-auto flex items-center">
                        <span className="material-icons text-sky-400 text-4xl mr-2.5 transform -rotate-12">code_off</span>
                        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-sky-400 via-cyan-300 to-teal-400">
                            CodeTutor AI
                        </h1>
                    </div>
                </header>

                <main className="flex-1 w-full max-w-screen-2xl mx-auto p-4 sm:p-6 lg:p-8">
                    <div className="lg:flex lg:gap-x-8">
                        {/* Left Column: Input & Controls */}
                        <aside className="lg:w-[400px] xl:w-[440px] lg:flex-shrink-0 space-y-6 mb-8 lg:mb-0 lg:sticky lg:top-28 h-fit">
                             <div className="bg-slate-800/70 backdrop-blur-lg shadow-2xl rounded-xl p-6 ring-1 ring-slate-700/50">
                                <FileUpload
                                    onFileSelect={handleFileSelect}
                                    selectedFile={selectedFile}
                                    selectedLanguage={language}
                                    onLanguageChange={handleLanguageChange}
                                    onSubmit={handleSubmit}
                                    isLoading={isLoading || apiKeyMissing}
                                />
                                 {apiKeyMissing && !error?.includes("Critical Setup Error") && (
                                    <div className="mt-4">
                                        <ErrorMessage message="Warning: API_KEY is not set. AI features will be disabled until configured." />
                                    </div>
                                )}
                            </div>
                        </aside>

                        {/* Right Column: Content Viewer & Results */}
                        <section className="flex-1 min-w-0 space-y-6 lg:space-y-8">
                            {/* Display uploaded file content if available */}
                            {codeContent && language && language !== SupportedLanguage.UNKNOWN && !error?.startsWith("Unsupported file type") && (
                                <FileContentViewer codeContent={codeContent} language={language} />
                            )}

                            {/* Display loading spinner for analysis */}
                            {isLoading && (
                                <div className="flex justify-center items-center h-full min-h-[300px] bg-slate-800/50 backdrop-blur-md rounded-xl shadow-xl ring-1 ring-slate-700/50">
                                    <LoadingSpinner />
                                </div>
                            )}
                            
                            {/* Display errors (file reading errors or analysis errors) */}
                            {error && !isLoading && <ErrorMessage message={error} />}
                            
                            {/* Display analysis results */}
                            {analysisResult && !isLoading && !error && language && (
                                <ResultDisplay result={analysisResult} language={language} />
                            )}
                            
                            {/* Welcome message: shown if no file content, not loading, no analysis result, and no critical error */}
                            {!codeContent && !isLoading && !analysisResult && (!error || error?.includes("Critical Setup Error")) && (
                                 <div className="flex flex-col justify-center items-center h-full min-h-[500px] bg-slate-800/50 backdrop-blur-md text-center p-10 rounded-xl shadow-xl ring-1 ring-slate-700/50">
                                    <span className="material-icons text-7xl text-sky-500/60 mb-6 opacity-80 transform -rotate-6">school</span>
                                    <h2 className="text-3xl font-semibold text-slate-100 mb-3">Welcome to Your AI Code Companion</h2>
                                    <p className="text-slate-400 max-w-lg text-lg leading-relaxed">
                                        Upload a code file to begin. The AI will delve into its concepts, provide examples,
                                        pose practice questions, and guide you towards mastery.
                                    </p>
                                    <p className="text-sm text-slate-500 mt-8">
                                        Supported languages: Python, C++, C, Java, Rust.
                                    </p>
                                    {error && error.includes("Critical Setup Error") && <div className="mt-6 w-full max-w-md"><ErrorMessage message={error} /></div>}
                                </div>
                            )}
                        </section>
                    </div>
                </main>

                <footer className="w-full text-center py-8 text-xs text-slate-500/80 border-t border-slate-700/50 mt-12">
                    Powered by Gemini AI. Ensure API_KEY is handled securely and responsibly.
                    <br />
                    CodeTutor AI &copy; {new Date().getFullYear()}
                </footer>
            </div>
        </>
    );
};

export default App;
