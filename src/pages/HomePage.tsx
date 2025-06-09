
import React, { useState, useCallback, useEffect, useRef } from 'react';
import { Toaster, toast } from 'react-hot-toast';
import Editor from 'react-simple-code-editor';
declare var Prism: any; 

import { FileUpload } from '../components/FileUpload';
import { ResultDisplay } from '../components/ResultDisplay';
import { LoadingSpinner } from '../components/LoadingSpinner';
import { ErrorMessage } from '../components/ErrorMessage';
import { FileContentViewer } from '../components/FileContentViewer';
import { SettingsPanel } from '../components/SettingsPanel';
import { useGlobalSettings } from '../hooks/useGlobalSettings';
import { analyzeCodeWithGemini, analyzeConceptWithGemini } from '../services/geminiService';
import { 
    AnalysisResult, 
    SupportedLanguage, 
    LanguageExtensions, 
    LanguageDisplayNames, 
    SupportedLanguage as LangEnum, 
    ExampleDifficulty 
} from '../types';
import { getPrismLanguageString } from '../components/CodeBlock';

type InputMode = 'fileUpload' | 'conceptTyping' | 'pasteCode';

const HomePage: React.FC = () => {
    const [isLoading, setIsLoading] = useState<boolean>(false);
    const [error, setError] = useState<string | null>(null);
    const [analysisResult, setAnalysisResult] = useState<AnalysisResult | null>(null);
    const [apiKeyMissing, setApiKeyMissing] = useState<boolean>(false);
    
    const { preferredInitialDifficulty } = useGlobalSettings();

    const [inputMode, setInputMode] = useState<InputMode>('fileUpload');

    // File Upload Mode
    const [selectedFile, setSelectedFile] = useState<File | null>(null);
    const [codeContent, setCodeContent] = useState<string | null>(null); 
    const [fileLanguage, setFileLanguage] = useState<SupportedLanguage | null>(null);

    // Concept Typing Mode
    const [conceptText, setConceptText] = useState<string>('');
    const [conceptLanguage, setConceptLanguage] = useState<SupportedLanguage | null>(LangEnum.PYTHON);

    // Paste Code Mode
    const [pastedCodeText, setPastedCodeText] = useState<string>('');
    const [pastedCodeLanguage, setPastedCodeLanguage] = useState<SupportedLanguage | null>(LangEnum.PYTHON);

    const [currentLanguageForAnalysis, setCurrentLanguageForAnalysis] = useState<SupportedLanguage | null>(null);
    const [difficultyForCurrentAnalysis, setDifficultyForCurrentAnalysis] = useState<ExampleDifficulty | null>(null);
    const [originalInputForAnalysis, setOriginalInputForAnalysis] = useState<string>("");

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
            toast.error(errMsg, { duration: 7000, id: 'critical-api-key-error' });
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
        setOriginalInputForAnalysis("");
    }, []);

    const handleInputModeChange = (newMode: InputMode) => {
        if (inputMode !== newMode) {
            setInputMode(newMode);
            resetAnalysisState();
            if (newMode === 'fileUpload') {
                setConceptText('');
                setPastedCodeText('');
            } else if (newMode === 'conceptTyping') {
                setSelectedFile(null); setCodeContent(null); setFileLanguage(null);
                setPastedCodeText('');
                if (!conceptLanguage) setConceptLanguage(LangEnum.PYTHON);
            } else if (newMode === 'pasteCode') {
                setSelectedFile(null); setCodeContent(null); setFileLanguage(null);
                setConceptText('');
                if (!pastedCodeLanguage) setPastedCodeLanguage(LangEnum.PYTHON);
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
                const errMsg = `Unsupported file type: ${extension}. Please select a language manually or upload a supported file.`;
                setError(errMsg); toast.error(errMsg);
            } else {
                toast.success(`Loaded "${file.name}". Language: ${LanguageDisplayNames[detectedLang]}.`);
            }
        };
        reader.onerror = () => {
            const errMsg = "Error reading the selected file. Please try again or select a different file.";
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
    
    const handleConceptTextChange = (event: React.ChangeEvent<HTMLInputElement>) => { 
        setConceptText(event.target.value);
        if (event.target.value.trim() && (analysisResult || error)) resetAnalysisState();
    };

    const handleConceptLanguageChange = (event: React.ChangeEvent<HTMLSelectElement>) => {
        const newLang = event.target.value as SupportedLanguage;
        setConceptLanguage(newLang);
        if (analysisResult || error) resetAnalysisState();
        if (newLang && newLang !== LangEnum.UNKNOWN) toast(`Language context: ${LanguageDisplayNames[newLang]}.`);
    };

    const handlePastedCodeTextChange = (code: string) => {
        setPastedCodeText(code);
        if (code.trim() && (analysisResult || error)) resetAnalysisState();
    };

    const handlePastedCodeLanguageChange = (event: React.ChangeEvent<HTMLSelectElement>) => {
        const newLang = event.target.value as SupportedLanguage;
        setPastedCodeLanguage(newLang);
        if (analysisResult || error) resetAnalysisState();
        if (newLang && newLang !== LangEnum.UNKNOWN) toast(`Language for pasted code: ${LanguageDisplayNames[newLang]}.`);
    };

    const handleSubmit = async () => {
        if (apiKeyMissing) {
            const errMsg = "Action Required: API_KEY is not configured. Analysis cannot proceed.";
            setError(errMsg); toast.error(errMsg, {id: 'api-key-submit-error'});
            return;
        }

        setIsLoading(true);
        resetAnalysisState();
        const initialDifficultyForThisAnalysis = preferredInitialDifficulty;
        let submittedOriginalInput = "";

        try {
            let result: AnalysisResult;
            let currentLang: SupportedLanguage | null = null;
            let codeToDisplayAfterAnalysis: string | null = null;

            if (inputMode === 'fileUpload') {
                if (!codeContent || !fileLanguage || fileLanguage === LangEnum.UNKNOWN) {
                    const errMsg = "Please select a valid code file and ensure its language is correctly identified.";
                    setError(errMsg); toast.error(errMsg); setIsLoading(false); return;
                }
                currentLang = fileLanguage;
                codeToDisplayAfterAnalysis = codeContent;
                submittedOriginalInput = codeContent;
                result = await analyzeCodeWithGemini(codeContent, fileLanguage, initialDifficultyForThisAnalysis);
                toast.success("Code analysis complete!");
            } else if (inputMode === 'conceptTyping') {
                if (!conceptText.trim() || !conceptLanguage || conceptLanguage === LangEnum.UNKNOWN) {
                    const errMsg = "Please enter a programming concept and select a language context.";
                    setError(errMsg); toast.error(errMsg); setIsLoading(false); return;
                }
                currentLang = conceptLanguage;
                submittedOriginalInput = conceptText;
                result = await analyzeConceptWithGemini(conceptText, conceptLanguage, initialDifficultyForThisAnalysis);
                toast.success("Concept analysis complete!");
            } else { // pasteCode
                 if (!pastedCodeText.trim() || !pastedCodeLanguage || pastedCodeLanguage === LangEnum.UNKNOWN) {
                    const errMsg = "Please paste your code and select its language.";
                    setError(errMsg); toast.error(errMsg); setIsLoading(false); return;
                }
                currentLang = pastedCodeLanguage;
                codeToDisplayAfterAnalysis = pastedCodeText;
                submittedOriginalInput = pastedCodeText;
                result = await analyzeCodeWithGemini(pastedCodeText, pastedCodeLanguage, initialDifficultyForThisAnalysis);
                toast.success("Pasted code analysis complete!");
            }
            
            if (inputMode === 'fileUpload' || inputMode === 'pasteCode') {
                setCodeContent(codeToDisplayAfterAnalysis); // Keep displaying the code if it was file/paste
                setFileLanguage(currentLang); // Ensure language is set for FileContentViewer
            } else { // conceptTyping
                setCodeContent(null); // Clear code display for concept mode
                setFileLanguage(null);
            }

            setAnalysisResult(result);
            setCurrentLanguageForAnalysis(currentLang);
            setDifficultyForCurrentAnalysis(initialDifficultyForThisAnalysis);
            setOriginalInputForAnalysis(submittedOriginalInput);

        } catch (err) {
            const errMessage = err instanceof Error ? err.message : "An unexpected error occurred during analysis.";
            setError(errMessage); toast.error(errMessage); console.error(err);
        } finally {
            setIsLoading(false);
        }
    };
    
    const isAnalyzeButtonDisabled = isLoading || apiKeyMissing || 
        (inputMode === 'fileUpload' && (!selectedFile || !fileLanguage || fileLanguage === LangEnum.UNKNOWN || !codeContent)) ||
        (inputMode === 'conceptTyping' && (!conceptText.trim() || !conceptLanguage || conceptLanguage === LangEnum.UNKNOWN)) ||
        (inputMode === 'pasteCode' && (!pastedCodeText.trim() || !pastedCodeLanguage || pastedCodeLanguage === LangEnum.UNKNOWN));

    let mainSubmitButtonText = 'Analyze Code';
    let loadingTextKey = 'Analyzing...';
    let mainSubmitIcon = 'analytics';
    let welcomeTitle = "Your AI Code Companion";
    let welcomeText = "Upload a code file. The AI will delve into its concepts, provide examples, pose practice questions, and guide you.";
    let welcomeIcon = 'auto_awesome'; // Default icon for welcome screen

    if (inputMode === 'fileUpload') {
        mainSubmitButtonText = 'Analyze Code'; loadingTextKey = 'Analyzing Your Code...'; mainSubmitIcon = 'analytics';
        welcomeTitle = "Your AI Code Companion";
        welcomeText = "Upload a code file. The AI will delve into its concepts, provide examples, pose practice questions, and guide you.";
        welcomeIcon = 'auto_awesome';
    } else if (inputMode === 'conceptTyping') {
        mainSubmitButtonText = 'Analyze Concept'; loadingTextKey = 'Exploring Your Concept...'; mainSubmitIcon = 'psychology_alt'; // or 'lightbulb'
        welcomeTitle = "Explore Programming Concepts";
        welcomeText = "Type a concept (e.g., 'Linked List', 'Recursion') and select language. The AI explains, gives examples, and practice.";
        welcomeIcon = 'lightbulb';
    } else if (inputMode === 'pasteCode') {
        mainSubmitButtonText = 'Analyze Pasted Code'; loadingTextKey = 'Analyzing Pasted Code...'; mainSubmitIcon = 'content_paste_go';
        welcomeTitle = "Paste & Analyze Code";
        welcomeText = "Paste your code snippet directly into the editor, select its language, and let the AI provide insights.";
        welcomeIcon = 'integration_instructions';
    }

    const showWelcomeMessage = !isLoading && !analysisResult && (!error || error?.includes("Critical Setup Error"));
    // Show FileContentViewer if there's code content (from file upload or paste) AND an analysis result is NOT YET present,
    // or if an error occurred that is NOT a file type error (so user can still see their code)
    const showUploadedCodePreview = (inputMode === 'fileUpload' || inputMode === 'pasteCode') && 
                                    codeContent && fileLanguage && fileLanguage !== LangEnum.UNKNOWN && 
                                    !analysisResult && 
                                    (!error || (error && !error.startsWith("Unsupported file type")));


    const supportedLanguagesText = "Python, C++, C, Java, Rust, JS, TS, Go, HTML, CSS, JSON, MD, Shell, Lua.";
    const prismLanguageForPastedCodeEditor = getPrismLanguageString(pastedCodeLanguage || LangEnum.PYTHON);

    const escapeHtml = (unsafe: string): string => {
        return unsafe
             .replace(/&/g, "&amp;")
             .replace(/</g, "&lt;")
             .replace(/>/g, "&gt;")
             .replace(/"/g, "&quot;")
             .replace(/'/g, "&#039;");
    };

    const robustHighlight = (code: string) => {
        if (typeof Prism === 'undefined' || !Prism.highlight || !code) {
            return escapeHtml(code || '');
        }
        const targetLanguageString = prismLanguageForPastedCodeEditor;
        const grammar = Prism.languages[targetLanguageString];

        if (grammar) {
            try { return Prism.highlight(code, grammar, targetLanguageString); } 
            catch (e) { console.warn(`Prism highlighting failed for ${targetLanguageString}:`, e); return escapeHtml(code); }
        } else if (Prism.languages.clike) { // Fallback for C-like languages if specific one not found
            try { return Prism.highlight(code, Prism.languages.clike, 'clike'); } 
            catch (e) { console.warn(`Prism clike fallback highlighting failed:`, e); return escapeHtml(code); }
        }
        return escapeHtml(code); // Final fallback for unhighlighted code
    };

    return (
        <>
            <Toaster 
                position="top-center"
                toastOptions={{
                    duration: 3500,
                    style: { background: '#1f2937', color: '#e5e7eb', borderRadius: '0.375rem', padding: '10px 16px', fontSize: '0.9rem', boxShadow: '0 4px 12px rgba(0,0,0,0.4)' }, 
                    success: { iconTheme: { primary: '#6366f1', secondary: '#111827' } }, 
                    error: { iconTheme: { primary: '#f43f5e', secondary: '#111827' } }, 
                }}
            />
            <div className="flex flex-col min-h-screen bg-gray-900 text-gray-200">
                <header className="py-4 px-6 flex justify-between items-center sticky top-0 z-50 bg-gray-900/70 backdrop-blur-md border-b border-gray-700/50">
                    <div className="flex items-center">
                        <span className="material-icons text-indigo-500 text-3xl mr-2">code</span>
                        <h1 className="text-xl font-bold text-white font-lexend">CodeTutor AI</h1>
                    </div>
                    <div className="relative">
                        <button
                            ref={settingsButtonRef}
                            onClick={toggleSettingsPanel}
                            className="text-gray-400 hover:text-white p-1.5 rounded-full hover:bg-gray-700/50 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 focus:ring-offset-gray-900"
                            aria-label="Open settings" aria-expanded={isSettingsPanelOpen} aria-controls="settings-panel-popover"
                        >
                            <span className="material-icons">settings</span>
                        </button>
                        {isSettingsPanelOpen && (
                            <div id="settings-panel-popover" ref={settingsPanelRef} className="absolute top-full right-0 mt-2 z-[60]" role="dialog" aria-modal="true">
                                <SettingsPanel />
                            </div>
                        )}
                    </div>
                </header>

                <main className="flex-grow flex flex-col p-6">
                    <div className="flex-grow grid grid-cols-1 md:grid-cols-3 gap-6 w-full">
                        <aside className="md:col-span-1 glassmorphism rounded-xl p-6 shadow-xl flex flex-col">
                            <h2 className="text-lg font-semibold text-white mb-4">Input Method</h2>
                            <div className="flex space-x-2 mb-6">
                                <button
                                    onClick={() => handleInputModeChange('fileUpload')}
                                    className={`flex-1 py-2 px-3 rounded-lg flex items-center justify-center space-x-1.5 transition-colors text-sm
                                        ${inputMode === 'fileUpload' ? 'bg-indigo-600 hover:bg-indigo-700 text-white font-medium' : 'bg-gray-700 hover:bg-gray-600 text-gray-300'}`}
                                >
                                    <span className="material-icons text-base">description</span>
                                    <span>File</span>
                                </button>
                                <button
                                    onClick={() => handleInputModeChange('conceptTyping')}
                                    className={`flex-1 py-2 px-3 rounded-lg flex items-center justify-center space-x-1.5 transition-colors text-sm
                                        ${inputMode === 'conceptTyping' ? 'bg-indigo-600 hover:bg-indigo-700 text-white font-medium' : 'bg-gray-700 hover:bg-gray-600 text-gray-300'}`}
                                >
                                   <span className="material-icons text-base">lightbulb</span>
                                   <span>Concept</span>
                                </button>
                                <button
                                    onClick={() => handleInputModeChange('pasteCode')}
                                    className={`flex-1 py-2 px-3 rounded-lg flex items-center justify-center space-x-1.5 transition-colors text-sm
                                        ${inputMode === 'pasteCode' ? 'bg-indigo-600 hover:bg-indigo-700 text-white font-medium' : 'bg-gray-700 hover:bg-gray-600 text-gray-300'}`}
                                >
                                   <span className="material-icons text-base">content_paste</span>
                                   <span>Paste</span>
                                </button>
                            </div>

                            {inputMode === 'fileUpload' && (
                                <FileUpload
                                    onFileSelect={handleFileSelect} selectedFile={selectedFile}
                                    selectedLanguage={fileLanguage} onLanguageChange={handleFileLanguageChange}
                                    onSubmit={handleSubmit} isLoading={isLoading}
                                />
                            )}

                            {inputMode === 'conceptTyping' && (
                                <div className="flex flex-col flex-grow space-y-4">
                                    <div>
                                        <h3 className="text-md font-medium text-white mb-2">Define Your Concept</h3>
                                        <div className="mb-3">
                                            <label className="block text-sm text-gray-400 mb-1" htmlFor="programming-concept">Programming Concept</label>
                                            <input
                                                className="w-full bg-gray-700/80 border border-gray-600 text-gray-200 rounded-lg p-2.5 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 placeholder-gray-500 transition-colors"
                                                id="programming-concept" placeholder="e.g., Linked List, Python Decorators" type="text"
                                                value={conceptText} onChange={handleConceptTextChange} disabled={isLoading}
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-sm text-gray-400 mb-1" htmlFor="language-context">Language Context</label>
                                            <select
                                                className="w-full bg-gray-700/80 border border-gray-600 text-gray-200 rounded-lg p-2.5 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 appearance-none bg-no-repeat bg-right-2.5"
                                                id="language-context" style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 20 20' fill='%239ca3af'%3E%3Cpath fill-rule='evenodd' d='M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z' clip-rule='evenodd' /%3E%3C/svg%3E")`, backgroundSize: '1.25em' }}
                                                value={conceptLanguage || ''} onChange={handleConceptLanguageChange} disabled={isLoading}
                                            >
                                                <option value="" disabled={!!conceptLanguage}>Select language...</option>
                                                {languageOptions.map(opt => (<option key={opt.value} value={opt.value}>{opt.label}</option>))}
                                            </select>
                                        </div>
                                    </div>
                                    <button
                                        type="button" onClick={handleSubmit} disabled={isAnalyzeButtonDisabled}
                                        className="w-full mt-auto bg-indigo-500 hover:bg-indigo-600 text-white py-3 px-4 rounded-lg flex items-center justify-center space-x-2 transition-colors font-medium disabled:bg-gray-600 disabled:text-gray-400 disabled:cursor-not-allowed"
                                    >
                                        {isLoading ? (<div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>) 
                                                   : (<span className="material-icons text-lg">{mainSubmitIcon}</span>)}
                                        <span>{isLoading ? loadingTextKey : mainSubmitButtonText}</span>
                                    </button>
                                </div>
                            )}
                            
                            {inputMode === 'pasteCode' && (
                                 <div className="flex flex-col flex-grow space-y-4">
                                    <div>
                                        <h3 className="text-md font-medium text-white mb-2">Paste Your Code</h3>
                                        <div className="mb-3">
                                            <label className="block text-sm text-gray-400 mb-1" htmlFor="pasted-code-editor-label">Code Editor</label>
                                            <div id="pasted-code-editor" className="bg-gray-800 border border-gray-600 rounded-lg overflow-hidden focus-within:ring-2 focus-within:ring-indigo-500 focus-within:border-indigo-500 custom-scrollbar-small shadow-sm">
                                                <Editor
                                                    value={pastedCodeText} onValueChange={handlePastedCodeTextChange} highlight={robustHighlight}
                                                    padding={12} textareaClassName="code-editor-textarea !text-xs" preClassName="code-editor-pre !text-xs"
                                                    className="font-fira-code min-h-[160px] max-h-[280px] overflow-y-auto !text-gray-200"
                                                    disabled={isLoading} placeholder={`// Paste your code here...\n// Select language below.`}
                                                    aria-label="Pasted code input area" aria-labelledby="pasted-code-editor-label"
                                                />
                                            </div>
                                        </div>
                                        <div>
                                            <label className="block text-sm text-gray-400 mb-1" htmlFor="pasted-code-language">Language of Pasted Code</label>
                                            <select
                                                className="w-full bg-gray-700/80 border border-gray-600 text-gray-200 rounded-lg p-2.5 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 appearance-none bg-no-repeat bg-right-2.5"
                                                id="pasted-code-language" style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 20 20' fill='%239ca3af'%3E%3Cpath fill-rule='evenodd' d='M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z' clip-rule='evenodd' /%3E%3C/svg%3E")`, backgroundSize: '1.25em' }}
                                                value={pastedCodeLanguage || ''} onChange={handlePastedCodeLanguageChange} disabled={isLoading}
                                            >
                                                <option value="" disabled={!!pastedCodeLanguage}>Select language...</option>
                                                {languageOptions.map(opt => (<option key={opt.value} value={opt.value}>{opt.label}</option>))}
                                            </select>
                                        </div>
                                    </div>
                                     <button
                                        type="button" onClick={handleSubmit} disabled={isAnalyzeButtonDisabled}
                                        className="w-full mt-auto bg-indigo-500 hover:bg-indigo-600 text-white py-3 px-4 rounded-lg flex items-center justify-center space-x-2 transition-colors font-medium disabled:bg-gray-600 disabled:text-gray-400 disabled:cursor-not-allowed"
                                    >
                                        {isLoading ? (<div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>) 
                                                   : (<span className="material-icons text-lg">{mainSubmitIcon}</span>)}
                                        <span>{isLoading ? loadingTextKey : mainSubmitButtonText}</span>
                                    </button>
                                </div>
                            )}
                            {apiKeyMissing && !error?.includes("Critical Setup Error") && (<div className="mt-3"><ErrorMessage message="Warning: API_KEY not set. AI features disabled." /></div>)}
                        </aside>

                        <section className="md:col-span-2 glassmorphism rounded-xl p-6 sm:p-8 md:p-10 shadow-xl flex flex-col items-center justify-center text-center overflow-y-auto custom-scrollbar-small">
                            {isLoading && (
                                <LoadingSpinner loadingText={loadingTextKey} />
                            )}
                            {error && !isLoading && <ErrorMessage message={error} />}
                            
                            {showUploadedCodePreview && !isLoading && !error && (
                                 <div className="w-full text-left">
                                    <FileContentViewer codeContent={codeContent!} language={fileLanguage!} />
                                 </div>
                            )}

                            {analysisResult && currentLanguageForAnalysis && difficultyForCurrentAnalysis && !isLoading && !error && (
                                <ResultDisplay 
                                    result={analysisResult} 
                                    language={currentLanguageForAnalysis} 
                                    difficultyOfProvidedExample={difficultyForCurrentAnalysis}
                                    originalInputContext={originalInputForAnalysis}
                                    originalInputType={inputMode === 'conceptTyping' ? 'concept' : 'code'}
                                />
                            )}
                            
                            {showWelcomeMessage && (
                                 <>
                                    <div className="bg-indigo-500/80 p-5 sm:p-6 rounded-full mb-6 sm:mb-8 shadow-lg">
                                        <span className="material-icons text-white text-5xl sm:text-6xl">{welcomeIcon}</span>
                                    </div>
                                    <h2 className="text-2xl sm:text-3xl font-bold text-white mb-3 sm:mb-4 font-lexend">{welcomeTitle}</h2>
                                    <p className="text-gray-300 mb-6 max-w-md text-sm sm:text-base">{welcomeText}</p>
                                    <p className="text-xs text-gray-400/80">Supported: {supportedLanguagesText}</p>
                                    {error && error.includes("Critical Setup Error") && <div className="mt-4 w-full max-w-sm"><ErrorMessage message={error} /></div>}
                                 </>
                            )}
                        </section>
                    </div>
                </main>

                <footer className="py-4 px-6 text-center text-xs text-gray-500">
                    Powered by Gemini AI. Ensure API_KEY is handled securely and responsibly.
                    <br />
                    CodeTutor AI &copy; {new Date().getFullYear()}
                </footer>
            </div>
        </>
    );
};

export default HomePage;
