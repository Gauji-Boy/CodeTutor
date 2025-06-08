

import React, { useState, useCallback, useEffect, useRef } from 'react';
import { Toaster, toast } from 'react-hot-toast';
import { FileUpload } from '../components/FileUpload';
import { ResultDisplay } from '../components/ResultDisplay';
import { LoadingSpinner } from '../components/LoadingSpinner';
import { ErrorMessage } from '../components/ErrorMessage';
import { FileContentViewer } from '../components/FileContentViewer';
import { SettingsPanel } from '../components/SettingsPanel'; 
import { useGlobalSettings } from '../hooks/useGlobalSettings'; 
import { analyzeCodeWithGemini, analyzeConceptWithGemini } from '../services/geminiService';
import { AnalysisResult, SupportedLanguage, LanguageExtensions, LanguageDisplayNames, SupportedLanguage as LangEnum, ExampleDifficulty } from '../types';

type InputMode = 'fileUpload' | 'conceptTyping';

const HomePage: React.FC = () => {
    const [isLoading, setIsLoading] = useState<boolean>(false);
    const [error, setError] = useState<string | null>(null);
    const [analysisResult, setAnalysisResult] = useState<AnalysisResult | null>(null);
    const [apiKeyMissing, setApiKeyMissing] = useState<boolean>(false);
    
    const { preferredInitialDifficulty } = useGlobalSettings();

    const [inputMode, setInputMode] = useState<InputMode>('fileUpload'); // Default to file upload

    const [selectedFile, setSelectedFile] = useState<File | null>(null);
    const [codeContent, setCodeContent] = useState<string | null>(null);
    const [fileLanguage, setFileLanguage] = useState<SupportedLanguage | null>(null);

    const [conceptText, setConceptText] = useState<string>('');
    const [conceptLanguage, setConceptLanguage] = useState<SupportedLanguage | null>(LangEnum.PYTHON); // Default to Python for concept if switched

    const [currentLanguageForAnalysis, setCurrentLanguageForAnalysis] = useState<SupportedLanguage | null>(null);
    const [difficultyForCurrentAnalysis, setDifficultyForCurrentAnalysis] = useState<ExampleDifficulty | null>(null);

    const [isSettingsPanelOpen, setIsSettingsPanelOpen] = useState(false);
    const settingsPanelRef = useRef<HTMLDivElement>(null);
    const settingsButtonRef = useRef<HTMLButtonElement>(null);

    const languageOptions = Object.values(LangEnum)
                              .filter(lang => lang !== LangEnum.UNKNOWN)
                              .map(lang => ({
                                  value: lang,
                                  label: LanguageDisplayNames[lang]
                              }));

    useEffect(() => {
        if (!process.env.API_KEY) {
            setApiKeyMissing(true);
            const errMsg = "Critical Setup Error: The API_KEY environment variable is missing. AI functionalities are disabled.";
            setError(errMsg);
            toast.error(errMsg, { duration: 5000, id: 'critical-api-key-error' });
        }
    }, []);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (
                isSettingsPanelOpen &&
                settingsPanelRef.current &&
                !settingsPanelRef.current.contains(event.target as Node) &&
                settingsButtonRef.current &&
                !settingsButtonRef.current.contains(event.target as Node)
            ) {
                setIsSettingsPanelOpen(false);
            }
        };
        if (isSettingsPanelOpen) document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [isSettingsPanelOpen]);

    const toggleSettingsPanel = () => setIsSettingsPanelOpen(prev => !prev);

    const resetAnalysisState = useCallback(() => {
        setError(null);
        setAnalysisResult(null);
        setCurrentLanguageForAnalysis(null);
        setDifficultyForCurrentAnalysis(null);
    }, []);

    const handleInputModeChange = (newMode: InputMode) => {
        if (inputMode !== newMode) {
            setInputMode(newMode);
            resetAnalysisState();
            if (newMode === 'conceptTyping') {
                setSelectedFile(null); setCodeContent(null); setFileLanguage(null);
                 if(!conceptLanguage) setConceptLanguage(LangEnum.PYTHON); // Ensure a default if null
            } else {
                setConceptText(''); 
                // Don't reset conceptLanguage if user might switch back and forth
            }
        }
    };

    const handleFileSelect = useCallback((file: File) => {
        setSelectedFile(file);
        resetAnalysisState();
        setCodeContent(null); setFileLanguage(null);
        const reader = new FileReader();
        reader.onload = (e) => {
            const content = e.target?.result as string;
            setCodeContent(content);
            const extension = file.name.substring(file.name.lastIndexOf('.')).toLowerCase();
            const detectedLang = LanguageExtensions[extension] || LangEnum.UNKNOWN;
            setFileLanguage(detectedLang);
            if (detectedLang === LangEnum.UNKNOWN) {
                const errMsg = `Unsupported file type: ${extension}. Supported: ${Object.keys(LanguageExtensions).map(ext => ext.slice(1).toUpperCase()).join(', ')}.`;
                setError(errMsg); toast.error(errMsg);
                setSelectedFile(null); setCodeContent(null); setFileLanguage(null);
            } else {
                toast.success(`Loaded "${file.name}". Language: ${LanguageDisplayNames[detectedLang]}.`);
            }
        };
        reader.onerror = () => {
            const errMsg = "Error reading file.";
            setError(errMsg); toast.error(errMsg);
            setSelectedFile(null);setCodeContent(null);setFileLanguage(null);
        };
        reader.readAsText(file);
    }, [resetAnalysisState]);

    const handleFileLanguageChange = useCallback((newLanguage: SupportedLanguage) => {
        setFileLanguage(newLanguage);
        if (error?.startsWith("Unsupported file type")) setError(null);
        toast(`Language set to ${LanguageDisplayNames[newLanguage]}.`);
    }, [error]);
    
    const handleConceptTextChange = (event: React.ChangeEvent<HTMLInputElement>) => { // Changed to HTMLInputElement
        setConceptText(event.target.value);
        if (event.target.value.trim() && (analysisResult || error)) resetAnalysisState();
    };

    const handleConceptLanguageChange = (event: React.ChangeEvent<HTMLSelectElement>) => {
        const newLang = event.target.value as SupportedLanguage;
        setConceptLanguage(newLang);
        if (analysisResult || error) resetAnalysisState();
        if (newLang && newLang !== LangEnum.UNKNOWN) toast(`Language context: ${LanguageDisplayNames[newLang]}.`);
    };

    const handleSubmit = async () => {
        if (apiKeyMissing) {
            const errMsg = "API_KEY not configured. Analysis cannot proceed.";
            setError(errMsg); toast.error(errMsg, {id: 'api-key-submit-error'});
            return;
        }

        setIsLoading(true);
        resetAnalysisState();
        const initialDifficultyForThisAnalysis = preferredInitialDifficulty;

        try {
            let result: AnalysisResult;
            let currentLang: SupportedLanguage | null = null;

            if (inputMode === 'fileUpload') {
                if (!codeContent || !fileLanguage || fileLanguage === LangEnum.UNKNOWN) {
                    const errMsg = "Select a valid code file and language.";
                    setError(errMsg); toast.error(errMsg); setIsLoading(false); return;
                }
                currentLang = fileLanguage;
                result = await analyzeCodeWithGemini(codeContent, fileLanguage, initialDifficultyForThisAnalysis);
                toast.success("Code analysis complete!");
            } else { // conceptTyping
                if (!conceptText.trim() || !conceptLanguage || conceptLanguage === LangEnum.UNKNOWN) {
                    const errMsg = "Enter concept and select language context.";
                    setError(errMsg); toast.error(errMsg); setIsLoading(false); return;
                }
                currentLang = conceptLanguage;
                result = await analyzeConceptWithGemini(conceptText, conceptLanguage, initialDifficultyForThisAnalysis);
                toast.success("Concept analysis complete!");
            }
            setAnalysisResult(result);
            setCurrentLanguageForAnalysis(currentLang);
            setDifficultyForCurrentAnalysis(initialDifficultyForThisAnalysis);
        } catch (err) {
            const errMessage = err instanceof Error ? err.message : "Analysis error.";
            setError(errMessage); toast.error(errMessage); console.error(err);
        } finally {
            setIsLoading(false);
        }
    };
    
    const isAnalyzeButtonDisabled = isLoading || apiKeyMissing || 
        (inputMode === 'fileUpload' && (!selectedFile || !fileLanguage || fileLanguage === LangEnum.UNKNOWN)) ||
        (inputMode === 'conceptTyping' && (!conceptText.trim() || !conceptLanguage || conceptLanguage === LangEnum.UNKNOWN));

    const analyzeButtonText = inputMode === 'fileUpload' ? 'Analyze Code' : 'Analyze Concept';
    const loadingTextKey = inputMode === 'fileUpload' ? 'Analyzing Code...' : 'Analyzing Concept...';
    const submitIcon = inputMode === 'fileUpload' ? 'insights' : 'psychology';

    const welcomeTitle = inputMode === 'fileUpload' ? "AI Code Companion" : "Explore Programming Concepts";
    const welcomeText = inputMode === 'fileUpload' ? 
        "Upload a code file. The AI will explain concepts, show examples, and offer practice." :
        "Type a concept (e.g., 'Linked List', 'Recursion') and select language. The AI explains, gives examples, and practice.";
    const showWelcomeMessage = !isLoading && !analysisResult && (!error || error?.includes("Critical Setup Error"));
    const showFileContent = inputMode === 'fileUpload' && codeContent && fileLanguage && fileLanguage !== LangEnum.UNKNOWN && !error?.startsWith("Unsupported file type");
    
    const supportedLanguagesText = "Python, C++, C, Java, Rust, JS, TS, Go, Swift, Kotlin, PHP, Ruby, Scala, C#, Shell, Lua.";


    return (
        <>
            <Toaster 
                position="top-center"
                toastOptions={{
                    duration: 3000,
                    style: { background: '#1e293b', color: '#e2e8f0', borderRadius: '0.375rem', padding: '10px 16px', fontSize: '0.875rem' }, // slate-800, slate-200
                    success: { iconTheme: { primary: '#3b82f6', secondary: '#0f172a' } }, // blue-500, slate-900
                    error: { iconTheme: { primary: '#ef4444', secondary: '#0f172a' } }, // red-500, slate-900
                }}
            />
            <div className="min-h-screen flex flex-col">
                <header className="sticky top-0 z-50 bg-slate-950/80 backdrop-blur-md p-4 flex justify-between items-center border-b border-slate-800/50 shadow-sm">
                    <div className="flex items-center space-x-3">
                        <span className="material-icons-outlined text-blue-500 text-3xl">school</span>
                        <h1 className="text-2xl font-semibold text-slate-100 font-lexend">CodeTutor AI</h1>
                    </div>
                    <div className="relative">
                        <button
                            ref={settingsButtonRef}
                            onClick={toggleSettingsPanel}
                            className="text-slate-400 hover:text-blue-400 transition-colors p-2 rounded-full hover:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:ring-offset-slate-950"
                            aria-label="Open settings"
                            aria-expanded={isSettingsPanelOpen}
                            aria-controls="settings-panel-popover"
                        >
                            <span className="material-icons">settings</span>
                        </button>
                        {isSettingsPanelOpen && (
                            <div id="settings-panel-popover" ref={settingsPanelRef} className="absolute top-full right-0 mt-2 z-50" role="dialog" aria-modal="true">
                                <SettingsPanel />
                            </div>
                        )}
                    </div>
                </header>

                <main className="flex-grow flex flex-col lg:flex-row p-4 sm:p-6 lg:p-8 gap-6 lg:gap-8">
                    <aside className="w-full lg:w-[380px] xl:w-[420px] bg-slate-900 p-5 sm:p-6 rounded-xl shadow-2xl space-y-6 sticky top-24 self-start border border-slate-800/60 lg:flex-shrink-0 h-fit">
                        <div>
                            <h2 className="text-lg font-semibold mb-3 text-slate-100">Input Method</h2>
                            <div className="flex space-x-2">
                                <button
                                    onClick={() => handleInputModeChange('fileUpload')}
                                    className={`flex-1 py-2.5 px-3 sm:px-4 rounded-lg text-sm transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-1 focus:ring-offset-slate-900
                                        ${inputMode === 'fileUpload' ? 'bg-blue-600 hover:bg-blue-500 text-white font-medium' : 'bg-slate-700/50 hover:bg-slate-700 text-slate-300'}`}
                                >
                                    Upload Code
                                </button>
                                <button
                                    onClick={() => handleInputModeChange('conceptTyping')}
                                    className={`flex-1 py-2.5 px-3 sm:px-4 rounded-lg text-sm transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-1 focus:ring-offset-slate-900
                                        ${inputMode === 'conceptTyping' ? 'bg-blue-600 hover:bg-blue-500 text-white font-medium' : 'bg-slate-700/50 hover:bg-slate-700 text-slate-300'}`}
                                >
                                    Type Concept
                                </button>
                            </div>
                        </div>

                        {inputMode === 'fileUpload' && (
                            <FileUpload
                                onFileSelect={handleFileSelect}
                                selectedFile={selectedFile}
                                selectedLanguage={fileLanguage}
                                onLanguageChange={handleFileLanguageChange}
                                onSubmit={handleSubmit}
                                isLoading={isLoading}
                            />
                        )}

                        {inputMode === 'conceptTyping' && (
                            <>
                                <div>
                                    <h2 className="text-lg font-semibold mb-3 text-slate-100">Define Your Concept</h2>
                                    <div className="mb-4">
                                        <label className="block text-sm font-medium text-slate-400 mb-1.5" htmlFor="programming-concept">Programming Concept</label>
                                        <input
                                            className="w-full bg-slate-800 border border-slate-700 text-slate-200 rounded-lg p-2.5 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 placeholder-slate-500 transition-colors"
                                            id="programming-concept"
                                            placeholder="e.g., Linked List, Recursion"
                                            type="text"
                                            value={conceptText}
                                            onChange={handleConceptTextChange}
                                            disabled={isLoading}
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-slate-400 mb-1.5" htmlFor="language-context">Language Context</label>
                                        <select
                                            className="w-full bg-slate-800 border border-slate-700 text-slate-200 rounded-lg p-2.5 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 appearance-none bg-no-repeat bg-right-2.5"
                                            id="language-context"
                                            style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 20 20' fill='%2394a3b8'%3E%3Cpath fill-rule='evenodd' d='M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z' clip-rule='evenodd' /%3E%3C/svg%3E")`, backgroundSize: '1.25em' }}
                                            value={conceptLanguage || ''}
                                            onChange={handleConceptLanguageChange}
                                            disabled={isLoading}
                                        >
                                            <option value="" disabled>Select language...</option>
                                            {languageOptions.map(opt => (
                                                <option key={opt.value} value={opt.value}>{opt.label}</option>
                                            ))}
                                        </select>
                                    </div>
                                </div>
                                <button
                                    type="button"
                                    onClick={handleSubmit}
                                    disabled={isAnalyzeButtonDisabled}
                                    className="w-full bg-blue-600 hover:bg-blue-500 text-white font-medium py-3 px-4 rounded-lg flex items-center justify-center gap-2 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:ring-offset-slate-900"
                                >
                                    {isLoading ? (
                                        <div className="w-5 h-5 border-[3px] border-white border-t-transparent rounded-full animate-spin"></div>
                                    ) : (
                                        <span className="material-icons-outlined text-xl">{submitIcon}</span>
                                    )}
                                    {isLoading ? loadingTextKey : analyzeButtonText}
                                </button>
                            </>
                        )}
                        {apiKeyMissing && !error?.includes("Critical Setup Error") && (
                            <div className="mt-4"><ErrorMessage message="Warning: API_KEY not set. AI features disabled." /></div>
                        )}
                    </aside>

                    <section className="flex-grow flex flex-col gap-6 lg:gap-8 min-w-0"> {/* Added min-w-0 for flex child content */}
                        {showFileContent && (
                            <FileContentViewer codeContent={codeContent!} language={fileLanguage!} />
                        )}
                        {isLoading && (
                            <div className="flex-grow flex justify-center items-center bg-slate-900 p-6 rounded-xl shadow-2xl border border-slate-800/60 min-h-[300px]">
                                <LoadingSpinner loadingText={loadingTextKey} />
                            </div>
                        )}
                        {error && !isLoading && <ErrorMessage message={error} />}
                        {analysisResult && currentLanguageForAnalysis && difficultyForCurrentAnalysis && !isLoading && !error && (
                            <ResultDisplay 
                                result={analysisResult} 
                                language={currentLanguageForAnalysis} 
                                difficultyOfProvidedExample={difficultyForCurrentAnalysis}
                            />
                        )}
                        {showWelcomeMessage && (
                             <div className="flex-grow flex flex-col justify-center items-center text-center bg-slate-900 p-8 sm:p-10 rounded-xl shadow-2xl border border-slate-800/60 min-h-[400px] lg:min-h-[500px]">
                                <span className="material-icons-outlined text-6xl sm:text-7xl text-blue-500/80 mb-5 sm:mb-6 opacity-90 transform -rotate-6">
                                    {inputMode === 'fileUpload' ? 'description' : 'emoji_objects'}
                                </span>
                                <h2 className="text-2xl sm:text-3xl font-semibold text-slate-100 mb-3 font-lexend">{welcomeTitle}</h2>
                                <p className="text-slate-400 max-w-md sm:max-w-lg text-base sm:text-lg leading-relaxed">
                                    {welcomeText}
                                </p>
                                <p className="text-xs sm:text-sm text-slate-500 mt-8 px-2">
                                    Supported languages: {supportedLanguagesText}
                                </p>
                                {error && error.includes("Critical Setup Error") && <div className="mt-5 w-full max-w-sm"><ErrorMessage message={error} /></div>}
                            </div>
                        )}
                    </section>
                </main>

                <footer className="text-center p-6 text-sm text-slate-500 border-t border-slate-800/50 mt-auto">
                    Powered by Gemini AI. Ensure API_KEY is handled securely.
                    <br />
                    CodeTutor AI &copy; {new Date().getFullYear()}
                </footer>
            </div>
        </>
    );
};

export default HomePage;