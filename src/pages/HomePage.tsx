import React, { useState, useCallback, useEffect, useRef } from 'react';
import { toast } from 'react-hot-toast';
import Editor from 'react-simple-code-editor';
declare var Prism: any;

import { FileUpload } from '../components/FileUpload';
import { ResultDisplay } from '../components/ResultDisplay';
import { LoadingSpinner } from '../components/LoadingSpinner';
import { ErrorMessage } from '../components/ErrorMessage';
import { FileContentViewer } from '../components/FileContentViewer';
import { SettingsPanel } from '../components/SettingsPanel';
import { FullScreenCodeModal } from '../components/FullScreenCodeModal'; // Import the new modal
import { useGlobalSettings } from '../hooks/useGlobalSettings';
import { analyzeCodeWithGemini, analyzeConceptWithGemini } from '../services/geminiService';
import { escapeHtml } from '../utils/textUtils'; // Import centralized utility
import {
    AnalysisResult,
    SupportedLanguage,
    LanguageExtensions,
    LanguageDisplayNames,
    SupportedLanguage as LangEnum,
    ExampleDifficulty,
    ActivityItem,
    ActivityType,
    PracticeMaterial 
} from '../types';
import { getPrismLanguageString } from '../components/CodeBlock';

type InputMode = 'fileUpload' | 'conceptTyping' | 'pasteCode';

interface HomePageProps {
    initialActivity?: ActivityItem | null;
    onBackToDashboard?: () => void;
    onAddActivity: (activity: ActivityItem) => void;
    onClearAllActivities: () => void;
}

const HomePageInternal: React.FC<HomePageProps> = ({ initialActivity, onBackToDashboard, onAddActivity, onClearAllActivities }) => {
    const [isLoading, setIsLoading] = useState<boolean>(false);
    const [error, setError] = useState<string | null>(null);
    const [analysisResult, setAnalysisResult] = useState<AnalysisResult | null>(null);
    const [apiKeyMissing, setApiKeyMissing] = useState<boolean>(false);

    const { preferredInitialDifficulty } = useGlobalSettings();

    const [inputMode, setInputMode] = useState<InputMode>(initialActivity?.type === 'concept_explanation' ? 'conceptTyping' : initialActivity?.type === 'paste_analysis' ? 'pasteCode' : 'fileUpload');

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
    const [difficultyForCurrentAnalysis, setDifficultyForCurrentAnalysis] = useState<ExampleDifficulty>(preferredInitialDifficulty);
    const [originalInputForAnalysis, setOriginalInputForAnalysis] = useState<string>("");

    const [isSettingsPanelOpen, setIsSettingsPanelOpen] = useState(false);
    const settingsPanelRef = useRef<HTMLDivElement>(null);
    const settingsButtonRef = useRef<HTMLButtonElement>(null);

    const [isFullScreenCodeModalOpen, setIsFullScreenCodeModalOpen] = useState<boolean>(false);
    const [fullScreenCodeContent, setFullScreenCodeContent] = useState<string>('');
    const [fullScreenCodeLanguage, setFullScreenCodeLanguage] = useState<SupportedLanguage>(LangEnum.UNKNOWN);


    const languageOptions = Object.values(LangEnum)
                              .filter(lang => lang !== LangEnum.UNKNOWN)
                              .map(lang => ({
                                  value: lang,
                                  label: LanguageDisplayNames[lang]
                              }));

    const resetAnalysisState = useCallback((keepApiKeyError = false) => {
        if (!keepApiKeyError || !apiKeyMissing) setError(null);
        else if (apiKeyMissing) {
            const errMsg = "Critical Setup Error: The API_KEY environment variable is missing. AI functionalities are disabled.";
            setError(errMsg);
        }
        setAnalysisResult(null);
        setCurrentLanguageForAnalysis(null);
        setDifficultyForCurrentAnalysis(preferredInitialDifficulty); 
        setOriginalInputForAnalysis("");

        if (apiKeyMissing && keepApiKeyError && !error?.includes("Critical Setup Error")) {
             const errMsg = "Critical Setup Error: The API_KEY environment variable is missing. AI functionalities are disabled.";
             setError(errMsg);
        }
    }, [apiKeyMissing, error, preferredInitialDifficulty]);

    useEffect(() => {
        if (!process.env.API_KEY) {
            setApiKeyMissing(true);
            const errMsg = "Critical Setup Error: The API_KEY environment variable is missing. AI functionalities are disabled.";
            setError(errMsg); toast.error(errMsg, { duration: 7000, id: 'critical-api-key-error' });
        }
    }, []);

    useEffect(() => {
        const performInitialAnalysis = async (input: string, lang: SupportedLanguage, type: ActivityItem['type'], title: string, difficultyToUse: ExampleDifficulty) => {
            setIsLoading(true); setError(null); setAnalysisResult(null);
            setOriginalInputForAnalysis(input);
            setCurrentLanguageForAnalysis(lang);
            setDifficultyForCurrentAnalysis(difficultyToUse);
            toast(`Analyzing: ${title}...`, {icon: '⏳'});
            try {
                let result: AnalysisResult;
                
                if (type === 'file_analysis' || type === 'paste_analysis') {
                    result = await analyzeCodeWithGemini(input, lang, difficultyToUse);
                } else if (type === 'concept_explanation') {
                    result = await analyzeConceptWithGemini(input, lang, difficultyToUse);
                } else {
                    throw new Error("Unsupported activity type for initial analysis.");
                }
                setAnalysisResult(result);
                
                if (!initialActivity?.analysisResult) { 
                    const activityTypeMap: Record<InputMode, ActivityType> = {
                        fileUpload: 'file_analysis',
                        conceptTyping: 'concept_explanation',
                        pasteCode: 'paste_analysis',
                    };
                    const currentActivityType = activityTypeMap[inputMode]; 
                    const activityTitle = initialActivity?.title || (inputMode === 'fileUpload' && selectedFile?.name ? selectedFile.name : inputMode === 'conceptTyping' ? conceptText : "Pasted Code");
                    const activityIcon = inputMode === 'fileUpload' ? 'description' : inputMode === 'conceptTyping' ? 'lightbulb' : 'content_paste_search';
                    const activityColor = inputMode === 'fileUpload' ? 'text-indigo-500' : inputMode === 'conceptTyping' ? 'text-green-500' : 'text-yellow-500';

                    onAddActivity({
                        id: Date.now().toString() + "_reanalyzed",
                        type: currentActivityType,
                        title: activityTitle || "Re-analyzed item",
                        timestamp: new Date(),
                        summary: `Successfully re-analyzed: ${result.topicExplanation.coreConcepts.substring(0, 50)}...`,
                        icon: activityIcon,
                        colorClass: activityColor,
                        language: lang,
                        originalInput: input,
                        analysisResult: result,
                        analysisDifficulty: difficultyToUse
                    });
                }
                toast.success("Analysis complete!");
            } catch (err) {
                const errMessage = err instanceof Error ? err.message : "An unexpected error occurred during initial analysis.";
                setError(errMessage); toast.error(errMessage); console.error(err);
            } finally {
                setIsLoading(false);
            }
        };

        if (initialActivity) {
            let modeToSet: InputMode = 'fileUpload';
            if (initialActivity.type === 'file_analysis') {
                modeToSet = 'fileUpload';
                if (initialActivity.originalInput) {
                  const mockFile = new File([initialActivity.originalInput], initialActivity.title || "loaded_file.txt", { type: "text/plain" });
                  setSelectedFile(mockFile);
                  setCodeContent(initialActivity.originalInput);
                }
                setFileLanguage(initialActivity.language || null);
            } else if (initialActivity.type === 'concept_explanation') {
                modeToSet = 'conceptTyping';
                setConceptText(initialActivity.originalInput || '');
                setConceptLanguage(initialActivity.language || LangEnum.PYTHON);
            } else if (initialActivity.type === 'paste_analysis') {
                modeToSet = 'pasteCode';
                setPastedCodeText(initialActivity.originalInput || '');
                setPastedCodeLanguage(initialActivity.language || LangEnum.PYTHON);
            }
            setInputMode(modeToSet);
            
            const difficultyForLoadedActivity = initialActivity.analysisDifficulty || preferredInitialDifficulty;

            if (initialActivity.analysisResult) {
                setAnalysisResult(initialActivity.analysisResult);
                setCurrentLanguageForAnalysis(initialActivity.language || null);
                setDifficultyForCurrentAnalysis(difficultyForLoadedActivity);
                setOriginalInputForAnalysis(initialActivity.originalInput || "");
                setError(null); setIsLoading(false);
                toast(`Loaded previous analysis: ${initialActivity.title}`, {icon: '📂'});
            } else if (initialActivity.originalInput && initialActivity.language && initialActivity.language !== LangEnum.UNKNOWN) {
                performInitialAnalysis(initialActivity.originalInput, initialActivity.language, initialActivity.type, initialActivity.title, difficultyForLoadedActivity);
            } else if (initialActivity.originalInput && (!initialActivity.language || initialActivity.language === LangEnum.UNKNOWN)) {
                setError("Cannot perform analysis: Language for the initial activity is missing or unknown.");
                setOriginalInputForAnalysis(initialActivity.originalInput);
                setIsLoading(false); setAnalysisResult(null);
            } else {
                resetAnalysisState(true);
                toast.error("Could not load the selected activity properly. Please start a new analysis.", {icon: '⚠️'});
            }
        } else {
            resetAnalysisState(true);
            setInputMode('fileUpload');
            setSelectedFile(null); setCodeContent(null); setFileLanguage(null);
            setConceptText(''); setConceptLanguage(LangEnum.PYTHON);
            setPastedCodeText(''); setPastedCodeLanguage(LangEnum.PYTHON);
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [initialActivity, preferredInitialDifficulty, resetAnalysisState, onAddActivity]);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if ( isSettingsPanelOpen && settingsPanelRef.current && !settingsPanelRef.current.contains(event.target as Node) &&
                 settingsButtonRef.current && !settingsButtonRef.current.contains(event.target as Node) ) {
                setIsSettingsPanelOpen(false);
            }
        };
        
        let timeoutId: NodeJS.Timeout;
        if (isSettingsPanelOpen) {
            // Debounce the event listener addition
            timeoutId = setTimeout(() => {
                document.addEventListener('mousedown', handleClickOutside);
            }, 100);
        }
        
        return () => {
            if (timeoutId) clearTimeout(timeoutId);
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, [isSettingsPanelOpen]);

    const toggleSettingsPanel = () => setIsSettingsPanelOpen(prev => !prev);

    const handleInputModeChange = (newMode: InputMode) => {
        if (inputMode !== newMode || initialActivity) { 
            resetAnalysisState(apiKeyMissing);
            setInputMode(newMode);
            if (newMode !== 'fileUpload' || (initialActivity && initialActivity.type !== 'file_analysis')) {
                 setSelectedFile(null); setCodeContent(null); setFileLanguage(null);
            }
            if (newMode !== 'conceptTyping' || (initialActivity && initialActivity.type !== 'concept_explanation')) {
                setConceptText('');
            }
            if (newMode !== 'pasteCode' || (initialActivity && initialActivity.type !== 'paste_analysis')) {
                setPastedCodeText('');
            }

            if (newMode === 'conceptTyping' && (!conceptLanguage || (initialActivity && initialActivity.type !== 'concept_explanation'))) setConceptLanguage(LangEnum.PYTHON);
            if (newMode === 'pasteCode' && (!pastedCodeLanguage || (initialActivity && initialActivity.type !== 'paste_analysis'))) setPastedCodeLanguage(LangEnum.PYTHON);
        }
    };

    const handleFileSelect = useCallback((file: File) => {
        setSelectedFile(file); resetAnalysisState(apiKeyMissing);
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
                if (!apiKeyMissing) setError(null);
                toast.success(`Loaded "${file.name}". Language: ${LanguageDisplayNames[detectedLang]}.`);
            }
        };
        reader.onerror = () => {
            const errMsg = "Error reading file."; setError(errMsg); toast.error(errMsg);
            setSelectedFile(null);setCodeContent(null);setFileLanguage(null);
        };
        reader.readAsText(file);
    }, [resetAnalysisState, apiKeyMissing]);

    const handleFileLanguageChange = useCallback((newLanguage: SupportedLanguage) => {
        setFileLanguage(newLanguage);
        if (error?.startsWith("Unsupported file type") && !apiKeyMissing) setError(null);
        toast(`Language set to ${LanguageDisplayNames[newLanguage]}.`);
    }, [error, apiKeyMissing]);

    const handleConceptTextChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        setConceptText(event.target.value);
        if (event.target.value.trim() && (analysisResult || (error && !apiKeyMissing))) resetAnalysisState(apiKeyMissing);
    };

    const handleConceptLanguageChange = (event: React.ChangeEvent<HTMLSelectElement>) => {
        const newLang = event.target.value as SupportedLanguage;
        setConceptLanguage(newLang);
        if ((analysisResult || (error && !apiKeyMissing))) resetAnalysisState(apiKeyMissing);
        if (newLang && newLang !== LangEnum.UNKNOWN) toast(`Language context: ${LanguageDisplayNames[newLang]}.`);
    };

    const handlePastedCodeTextChange = (code: string) => {
        setPastedCodeText(code);
        if (code.trim() && (analysisResult || (error && !apiKeyMissing))) resetAnalysisState(apiKeyMissing);
    };

    const handlePastedCodeLanguageChange = (event: React.ChangeEvent<HTMLSelectElement>) => {
        const newLang = event.target.value as SupportedLanguage;
        setPastedCodeLanguage(newLang);
        if ((analysisResult || (error && !apiKeyMissing))) resetAnalysisState(apiKeyMissing);
        if (newLang && newLang !== LangEnum.UNKNOWN) toast(`Language for pasted code: ${LanguageDisplayNames[newLang]}.`);
    };

    const handleSubmit = async () => {
        if (apiKeyMissing) {
            const errMsg = "Action Required: API_KEY is not configured. Analysis cannot proceed.";
            setError(errMsg); toast.error(errMsg, {id: 'api-key-submit-error'});
            setIsLoading(false); return;
        }

        if (error && !error.includes("Critical Setup Error")) setError(null);
        setAnalysisResult(null); setIsLoading(true);

        const initialDifficultyForThisAnalysis = preferredInitialDifficulty;
        setDifficultyForCurrentAnalysis(initialDifficultyForThisAnalysis); 

        let submittedOriginalInput = "";
        let activityType: ActivityType = 'file_analysis';
        let activityTitle = "";
        let activityIcon = 'description';
        let activityColor = 'text-indigo-500';


        try {
            let result: AnalysisResult;
            let currentLang: SupportedLanguage | null = null;

            if (inputMode === 'fileUpload') {
                if (!codeContent || !fileLanguage || fileLanguage === LangEnum.UNKNOWN || !selectedFile) {
                    const errMsg = "Please select a valid code file and ensure its language is correctly identified.";
                    setError(errMsg); toast.error(errMsg); setIsLoading(false); return;
                }
                currentLang = fileLanguage; submittedOriginalInput = codeContent; activityType = 'file_analysis';
                activityTitle = selectedFile.name; activityIcon = 'description'; activityColor = 'text-indigo-500';
                result = await analyzeCodeWithGemini(codeContent, fileLanguage, initialDifficultyForThisAnalysis);
                toast.success("Code analysis complete!");
            } else if (inputMode === 'conceptTyping') {
                if (!conceptText.trim() || !conceptLanguage || conceptLanguage === LangEnum.UNKNOWN) {
                    const errMsg = "Please enter a programming concept and select a language context.";
                    setError(errMsg); toast.error(errMsg); setIsLoading(false); return;
                }
                currentLang = conceptLanguage; submittedOriginalInput = conceptText; activityType = 'concept_explanation';
                activityTitle = `Concept: ${conceptText.substring(0,40)}${conceptText.length > 40 ? '...' : ''}`;
                activityIcon = 'lightbulb'; activityColor = 'text-green-500';
                result = await analyzeConceptWithGemini(conceptText, conceptLanguage, initialDifficultyForThisAnalysis);
                toast.success("Concept analysis complete!");
            } else { // pasteCode
                 if (!pastedCodeText.trim() || !pastedCodeLanguage || pastedCodeLanguage === LangEnum.UNKNOWN) {
                    const errMsg = "Please paste your code and select its language.";
                    setError(errMsg); toast.error(errMsg); setIsLoading(false); return;
                }
                currentLang = pastedCodeLanguage; submittedOriginalInput = pastedCodeText; activityType = 'paste_analysis';
                activityTitle = `Pasted Code: ${pastedCodeText.substring(0,30)}...`;
                activityIcon = 'content_paste_search'; activityColor = 'text-yellow-500';
                result = await analyzeCodeWithGemini(pastedCodeText, pastedCodeLanguage, initialDifficultyForThisAnalysis);
                toast.success("Pasted code analysis complete!");
            }

            setAnalysisResult(result); setCurrentLanguageForAnalysis(currentLang);
            setOriginalInputForAnalysis(submittedOriginalInput);
            if (error && !error.includes("Critical Setup Error")) setError(null);

            if (onAddActivity && currentLang) {
                const newActivity: ActivityItem = {
                    id: Date.now().toString(),
                    type: activityType,
                    title: activityTitle,
                    timestamp: new Date(),
                    summary: `${result.topicExplanation.coreConcepts.substring(0, 70)}...`, // Access coreConcepts correctly
                    icon: activityIcon,
                    colorClass: activityColor,
                    language: currentLang,
                    originalInput: submittedOriginalInput,
                    analysisResult: result, 
                    analysisDifficulty: initialDifficultyForThisAnalysis,
                };
                onAddActivity(newActivity);
            }

        } catch (err) {
            const errMessage = err instanceof Error ? err.message : "An unexpected error occurred.";
            setError(errMessage); toast.error(errMessage); console.error(err);
        } finally {
            setIsLoading(false);
        }
    };

    const handleOpenFullScreenCodeModal = (content: string, lang: SupportedLanguage) => {
        setFullScreenCodeContent(content);
        setFullScreenCodeLanguage(lang);
        setIsFullScreenCodeModalOpen(true);
    };

    const handleCloseFullScreenCodeModal = () => {
        setIsFullScreenCodeModalOpen(false);
    };

    const isAnalyzeButtonDisabled = isLoading || apiKeyMissing ||
        (inputMode === 'fileUpload' && (!selectedFile || !fileLanguage || fileLanguage === LangEnum.UNKNOWN || !codeContent)) ||
        (inputMode === 'conceptTyping' && (!conceptText.trim() || !conceptLanguage || conceptLanguage === LangEnum.UNKNOWN)) ||
        (inputMode === 'pasteCode' && (!pastedCodeText.trim() || !pastedCodeLanguage || pastedCodeLanguage === LangEnum.UNKNOWN));

    let mainSubmitButtonText = 'Analyze Code';
    let loadingText = 'Analyzing...';
    let mainSubmitIcon = 'analytics';
    let currentWelcomeTitle = "Code Analysis & Learning Assistant";
    let currentWelcomeText = "Select an input method to begin. Upload files, explore concepts, or paste code snippets for AI-powered insights and learning exercises.";
    let currentWelcomeIcon = "auto_awesome";


    if (inputMode === 'fileUpload') {
      mainSubmitButtonText = 'Analyze Uploaded Code'; loadingText = 'Analyzing Code...'; mainSubmitIcon = 'analytics';
      currentWelcomeTitle = "Upload & Analyze Code";
      currentWelcomeText = "Select or drag & drop a code file. The AI will explain its concepts, provide examples, and generate practice questions.";
      currentWelcomeIcon = 'upload_file';
    } else if (inputMode === 'conceptTyping') {
        mainSubmitButtonText = 'Analyze Concept'; loadingText = 'Analyzing Concept...'; mainSubmitIcon = 'psychology';
        currentWelcomeTitle = "Explore Programming Concepts";
        currentWelcomeText = "Type a programming concept (e.g., 'Python Decorators') and choose a language. AI provides explanations, examples, and practice.";
        currentWelcomeIcon = 'lightbulb';
    } else if (inputMode === 'pasteCode') {
        mainSubmitButtonText = 'Analyze Pasted Code'; loadingText = 'Analyzing Pasted Code...'; mainSubmitIcon = 'content_paste_go';
        currentWelcomeTitle = "Paste & Analyze Code Snippets";
        currentWelcomeText = "Paste your code into the editor, select its language, and let the AI provide insights, examples, and practice questions.";
        currentWelcomeIcon = 'integration_instructions';
    }

    const prismLanguageForPastedCodeEditor = getPrismLanguageString(pastedCodeLanguage || LangEnum.PYTHON);
    
    const robustHighlight = useCallback((code: string, lang: string) => {
        if (typeof Prism === 'undefined' || !Prism.highlight || !code) return escapeHtml(code || '');
        
        // Cache highlighted code to avoid re-computation
        const cacheKey = `${lang}_${code.substring(0, 100)}`;
        if (highlightCache.has(cacheKey)) {
            return highlightCache.get(cacheKey)!;
        }
        
        const grammar = Prism.languages[lang] || Prism.languages.clike;
        if (grammar) { 
            try { 
                const highlighted = Prism.highlight(code, grammar, lang);
                highlightCache.set(cacheKey, highlighted);
                
                // Limit cache size
                if (highlightCache.size > 50) {
                    const firstKey = highlightCache.keys().next().value;
                    highlightCache.delete(firstKey);
                }
                
                return highlighted;
            } catch (e) { 
                console.warn(`Prism highlighting failed for ${lang} in editor:`, e); 
            } 
        }
        const escaped = escapeHtml(code);
        highlightCache.set(cacheKey, escaped);
        return escaped;
    }, []);

    // Add cache for highlighted code
    const highlightCache = useRef(new Map<string, string>());


    const stickyTopOffset = "md:top-[calc(3.5rem+1.5rem)]"; 
    const panelHeight = "md:h-[calc(100vh-3.5rem-3rem)]";


    return (
        <div className="flex flex-col min-h-screen bg-gray-900 text-gray-200">
            <header className="py-3 px-4 sm:px-6 flex justify-between items-center sticky top-0 z-50 bg-gray-900/80 backdrop-blur-md border-b border-gray-700/60 h-14">
                <div className="flex items-center">
                    {onBackToDashboard && (
                         <button onClick={onBackToDashboard} className="text-gray-300 hover:text-white p-2 rounded-full hover:bg-gray-700/60 mr-2 transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 focus:ring-offset-gray-900" aria-label="Back to Dashboard">
                            <span className="material-icons">arrow_back</span>
                        </button>
                    )}
                    <span className="material-icons-outlined text-indigo-500 text-2xl sm:text-3xl mr-2">code_blocks</span>
                    <h1 className="text-lg sm:text-xl font-semibold text-white font-lexend">CodeTutor AI</h1>
                </div>
                <div className="relative">
                    <button ref={settingsButtonRef} onClick={toggleSettingsPanel} className="text-gray-400 hover:text-white p-1.5 rounded-full hover:bg-gray-700/50 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 focus:ring-offset-gray-900" aria-label="Open settings" aria-expanded={isSettingsPanelOpen} aria-controls="settings-panel-popover">
                        <span className="material-icons-outlined">settings</span>
                    </button>
                    {isSettingsPanelOpen && (
                        <div id="settings-panel-popover" ref={settingsPanelRef} className="absolute top-full right-0 mt-2 z-[60]" role="dialog" aria-modal="true">
                            <SettingsPanel
                                onAddActivity={onAddActivity}
                                onClearAllActivities={onClearAllActivities}
                            />
                        </div>
                    )}
                </div>
            </header>

            <main className="flex-grow flex flex-col md:flex-row p-4 sm:p-6 gap-4 sm:gap-6">
                 <aside className={`w-full md:w-[32rem] lg:w-[36rem] md:flex-shrink-0 bg-gray-800 rounded-xl shadow-2xl p-4 sm:p-6 flex flex-col mb-6 md:mb-0 md:sticky ${stickyTopOffset} ${panelHeight}`}>
                    <div className="flex-grow space-y-5 overflow-y-auto custom-scrollbar-small pr-1"> 
                        <div>
                            <h2 className="text-sm sm:text-base font-semibold text-white mb-2">Input Method</h2>
                            <div className="grid grid-cols-3 gap-2">
                                {(['fileUpload', 'conceptTyping', 'pasteCode'] as InputMode[]).map(mode => {
                                    let icon = 'description'; let label = 'File';
                                    if (mode === 'conceptTyping') { icon = 'lightbulb'; label = 'Concept'; }
                                    else if (mode === 'pasteCode') { icon = 'content_paste'; label = 'Paste'; }
                                    
                                    const baseButtonClasses = "py-2 px-2.5 rounded-md flex flex-col sm:flex-row items-center justify-center space-x-0 sm:space-x-1.5 transition-colors text-xs sm:text-sm font-medium focus:outline-none focus:ring-2 focus:ring-offset-1 focus:ring-offset-gray-800 focus:ring-indigo-500";
                                    const modeSpecificClasses = inputMode === mode ? 'bg-indigo-600 hover:bg-indigo-700 text-white' : 'bg-gray-700 hover:bg-gray-600 text-gray-300';
                                    const combinedClasses = `${baseButtonClasses} ${modeSpecificClasses}`;

                                    return (
                                        <button key={mode} onClick={() => handleInputModeChange(mode)}
                                            className={combinedClasses}>
                                            <span className="material-icons-outlined text-base sm:text-lg mb-0.5 sm:mb-0">{icon}</span>
                                            <span>{label}</span>
                                        </button>
                                    );
                                })}
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
                            <div className="space-y-3 pt-3 border-t border-gray-700/70">
                                <div>
                                    <h3 className="text-sm sm:text-base font-medium text-white mb-2">Define Your Concept</h3>
                                    <div className="mb-3">
                                        <label className="block text-xs text-gray-400 mb-1" htmlFor="programming-concept">Programming Concept</label>
                                        <input
                                            className="w-full bg-gray-700/80 border border-gray-600 text-gray-200 rounded-md p-2.5 text-sm focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 placeholder-gray-500 transition-colors"
                                            id="programming-concept" placeholder="e.g., Linked List, Python Decorators" type="text"
                                            value={conceptText} onChange={handleConceptTextChange} disabled={isLoading}
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-xs text-gray-400 mb-1" htmlFor="language-context">Language Context</label>
                                        <select
                                            className="w-full bg-gray-700/80 border border-gray-600 text-gray-200 rounded-md p-2.5 text-sm focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 appearance-none bg-no-repeat bg-right-2.5"
                                            id="language-context" style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 20 20' fill='%239ca3af'%3E%3Cpath fill-rule='evenodd' d='M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z' clip-rule='evenodd' /%3E%3C/svg%3E")`, backgroundSize: '1.25em' }}
                                            value={conceptLanguage || ''} onChange={handleConceptLanguageChange} disabled={isLoading}
                                        >
                                            <option value="" disabled={!!conceptLanguage}>Select language...</option>
                                            {languageOptions.map(opt => (<option key={opt.value} value={opt.value}>{opt.label}</option>))}
                                        </select>
                                    </div>
                                </div>
                            </div>
                        )}

                        {inputMode === 'pasteCode' && (
                            <div className="space-y-3 pt-3 border-t border-gray-700/70">
                                <div>
                                    <h3 className="text-sm sm:text-base font-medium text-white mb-2">Paste Your Code</h3>
                                    <div className="mb-3">
                                        <label className="block text-xs text-gray-400 mb-1" htmlFor="pasted-code-editor-label">Code Editor</label>
                                        <div id="pasted-code-editor-outer" className="bg-gray-700/60 border border-gray-600 rounded-md overflow-hidden focus-within:ring-1 focus-within:ring-indigo-500 focus-within:border-indigo-500 custom-scrollbar-small shadow-sm">
                                            <Editor
                                                value={pastedCodeText} onValueChange={handlePastedCodeTextChange}
                                                highlight={code => robustHighlight(code, prismLanguageForPastedCodeEditor)}
                                                padding={10} textareaClassName="code-editor-textarea !text-xs !font-fira-code" preClassName="code-editor-pre !text-xs !font-fira-code"
                                                className="min-h-[150px] max-h-[250px] overflow-y-auto !text-gray-200"
                                                disabled={isLoading} placeholder={`// Paste your code here...\n// Select language below.`}
                                                aria-label="Pasted code input area" aria-labelledby="pasted-code-editor-label"
                                            />
                                        </div>
                                    </div>
                                    <div>
                                        <label className="block text-xs text-gray-400 mb-1" htmlFor="pasted-code-language">Language of Pasted Code</label>
                                        <select
                                            className="w-full bg-gray-700/80 border border-gray-600 text-gray-200 rounded-md p-2.5 text-sm focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 appearance-none bg-no-repeat bg-right-2.5"
                                            id="pasted-code-language" style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 20 20' fill='%239ca3af'%3E%3Cpath fill-rule='evenodd' d='M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z' clip-rule='evenodd' /%3E%3C/svg%3E")`, backgroundSize: '1.25em' }}
                                            value={pastedCodeLanguage || ''} onChange={handlePastedCodeLanguageChange} disabled={isLoading}
                                        >
                                            <option value="" disabled={!!pastedCodeLanguage}>Select language...</option>
                                            {languageOptions.map(opt => (<option key={opt.value} value={opt.value}>{opt.label}</option>))}
                                        </select>
                                    </div>
                                </div>
                            </div>
                        )}

                        {(inputMode === 'fileUpload' && codeContent && fileLanguage && fileLanguage !== LangEnum.UNKNOWN && !isLoading && (!error || error.includes("Critical Setup Error") || !error.startsWith("Unsupported file type"))) && (
                            <div className="pt-3 border-t border-gray-700/60 overflow-y-auto custom-scrollbar-small min-h-0">
                                <FileContentViewer
                                    codeContent={codeContent}
                                    language={fileLanguage}
                                    onViewFull={() => codeContent && fileLanguage && handleOpenFullScreenCodeModal(codeContent, fileLanguage)}
                                />
                            </div>
                        )}
                        {(inputMode === 'pasteCode' && pastedCodeText && pastedCodeLanguage && pastedCodeLanguage !== LangEnum.UNKNOWN && !isLoading && (!error || error.includes("Critical Setup Error"))) && (
                            <div className="pt-3 border-t border-gray-700/60 overflow-y-auto custom-scrollbar-small min-h-0">
                                <FileContentViewer
                                    codeContent={pastedCodeText}
                                    language={pastedCodeLanguage}
                                    onViewFull={() => pastedCodeText && pastedCodeLanguage && handleOpenFullScreenCodeModal(pastedCodeText, pastedCodeLanguage)}
                                />
                            </div>
                        )}
                    </div>

                    <div className="mt-auto pt-4 border-t border-gray-700/70">
                        <button type="button" onClick={handleSubmit} disabled={isAnalyzeButtonDisabled}
                            className="w-full bg-indigo-600 hover:bg-indigo-700 text-white py-3 px-4 rounded-lg flex items-center justify-center space-x-2 transition-colors font-semibold disabled:bg-gray-600 disabled:text-gray-400 disabled:cursor-not-allowed text-sm shadow-md"
                        >
                            {isLoading ? (<div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>)
                                       : (<span className="material-icons-outlined text-xl">{mainSubmitIcon}</span>)}
                            <span>{isLoading ? loadingText : mainSubmitButtonText}</span>
                        </button>
                    </div>

                </aside>

                <section className={`flex-grow bg-gray-800 rounded-xl shadow-2xl p-4 sm:p-6 md:p-8 flex flex-col ${panelHeight} md:overflow-y-auto custom-scrollbar-small`}>
                    {isLoading && ( <LoadingSpinner loadingText={loadingText} /> )}

                    {!isLoading && error && <ErrorMessage message={error} />}

                    {!isLoading && !error && analysisResult && currentLanguageForAnalysis && originalInputForAnalysis && (
                        <ResultDisplay
                            result={analysisResult}
                            language={currentLanguageForAnalysis}
                            difficultyOfProvidedExample={difficultyForCurrentAnalysis} 
                            originalInputContext={originalInputForAnalysis}
                            originalInputType={inputMode === 'conceptTyping' ? 'concept' : 'code'}
                        />
                    )}

                    {!isLoading && !error && !analysisResult && (
                         <div className="flex-grow flex flex-col items-center justify-center text-center p-4">
                            <div className="bg-indigo-600/30 p-4 sm:p-5 rounded-full mb-4 sm:mb-6 shadow-lg border border-indigo-500/50">
                                <span className="material-icons-outlined text-indigo-400 text-4xl sm:text-5xl">{currentWelcomeIcon}</span>
                            </div>
                            <h2 className="text-xl sm:text-2xl font-semibold text-white mb-2 sm:mb-3 font-lexend">{currentWelcomeTitle}</h2>
                            <p className="text-gray-300/90 mb-5 max-w-md text-sm sm:text-base leading-relaxed">{currentWelcomeText}</p>
                            <p className="text-xs text-gray-500 max-w-sm">
                                Supported: Python, C++, Java, JS, TS, Go, Rust, and more for concept explanations.
                            </p>
                         </div>
                    )}
                     {!isLoading && error && error.includes("Critical Setup Error") && !analysisResult && (
                        <div className="mt-4 w-full max-w-lg mx-auto"><ErrorMessage message={error} /></div>
                     )}
                </section>
            </main>
             <FullScreenCodeModal
                isOpen={isFullScreenCodeModalOpen}
                code={fullScreenCodeContent}
                language={fullScreenCodeLanguage}
                onClose={handleCloseFullScreenCodeModal}
            />
        </div>
    );
};
export const HomePage = React.memo(HomePageInternal);
