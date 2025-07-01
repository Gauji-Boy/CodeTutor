

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

    const { preferredInitialDifficulty, defaultPracticeDifficulty, isLeftPanelCollapsed, setIsLeftPanelCollapsed } = useGlobalSettings();

    // Determine initial input mode based on activity type, defaulting to fileUpload
    const getInitialInputMode = (activity: ActivityItem | null | undefined): InputMode => {
        if (!activity) return 'fileUpload';
        switch (activity.type) {
            case 'concept_explanation': return 'conceptTyping';
            case 'paste_analysis': return 'pasteCode';
            case 'file_analysis':
            default: return 'fileUpload';
        }
    };
    const [inputMode, setInputMode] = useState<InputMode>(getInitialInputMode(initialActivity));


    // File Upload Mode
    const [selectedFile, setSelectedFile] = useState<File | null>(null);
    const [codeContent, setCodeContent] = useState<string | null>(null);
    const [fileLanguage, setFileLanguage] = useState<SupportedLanguage | null>(null);

    // Concept Typing Mode
    const [conceptText, setConceptText] = useState<string>('');
    const [conceptLanguage, setConceptLanguage] = useState<SupportedLanguage | null>(LangEnum.PYTHON);

    // Paste Code Mode
    const [pastedCodeText, setPastedCodeText] = useState<string>('');
    
    // Common state for current analysis context
    const [currentLanguageForAnalysis, setCurrentLanguageForAnalysis] = useState<SupportedLanguage | null>(null);
    const [difficultyForCurrentAnalysis, setDifficultyForCurrentAnalysis] = useState<ExampleDifficulty>(preferredInitialDifficulty);
    const [practiceDifficultyForCurrentAnalysis, setPracticeDifficultyForCurrentAnalysis] = useState<ExampleDifficulty>(defaultPracticeDifficulty);
    const [originalInputForAnalysis, setOriginalInputForAnalysis] = useState<string>("");

    // UI State
    const [isSettingsPanelOpen, setIsSettingsPanelOpen] = useState(false);
    const settingsPanelRef = useRef<HTMLDivElement>(null);
    const settingsButtonRef = useRef<HTMLButtonElement>(null);
    const analysisStartedForId = useRef<string | null>(null);

    const [isFullScreenCodeModalOpen, setIsFullScreenCodeModalOpen] = useState<boolean>(false);
    const [fullScreenCodeContent, setFullScreenCodeContent] = useState<string>('');
    const [fullScreenCodeLanguage, setFullScreenCodeLanguage] = useState<SupportedLanguage>(LangEnum.UNKNOWN);


    const languageOptions = Object.values(LangEnum)
                              .filter(lang => lang !== LangEnum.UNKNOWN)
                              .map(lang => ({
                                  value: lang,
                                  label: LanguageDisplayNames[lang]
                              }));

    const resetAnalysisState = useCallback((forNewSession: boolean) => {
        setAnalysisResult(null);
        setCurrentLanguageForAnalysis(null);
        setDifficultyForCurrentAnalysis(preferredInitialDifficulty); // Reset to global preference
        setPracticeDifficultyForCurrentAnalysis(defaultPracticeDifficulty); // Reset to global preference
        setOriginalInputForAnalysis("");
        if (forNewSession) {
            // Only clear error if it's not the critical API key missing error
            if (apiKeyMissing) {
                setError("Critical Setup Error: The API_KEY environment variable is missing. AI functionalities are disabled.");
            } else {
                setError(null);
            }
        }
    }, [preferredInitialDifficulty, defaultPracticeDifficulty, apiKeyMissing]);


    useEffect(() => {
        if (!process.env.API_KEY) {
            setApiKeyMissing(true);
            const errMsg = "Critical Setup Error: The API_KEY environment variable is missing. AI functionalities are disabled.";
            setError(errMsg); toast.error(errMsg, { duration: 7000, id: 'critical-api-key-error' });
        }
    }, []);

    // Effect to handle initialActivity loading or new session setup
    useEffect(() => {
        const performInitialAnalysis = async (input: string, lang: SupportedLanguage, type: ActivityItem['type'], title: string, difficultyToUse: ExampleDifficulty, practiceDifficultyToUse: ExampleDifficulty) => {
            setIsLoading(true); setError(null); setAnalysisResult(null); 
            setOriginalInputForAnalysis(input);
            setCurrentLanguageForAnalysis(lang);
            setDifficultyForCurrentAnalysis(difficultyToUse);
            setPracticeDifficultyForCurrentAnalysis(practiceDifficultyToUse);
            toast(`Analyzing: ${title}...`, {icon: '⏳'});
            try {
                let result: AnalysisResult;
                let finalLang = lang;
                if ((type === 'file_analysis' || type === 'paste_analysis')) {
                    result = await analyzeCodeWithGemini(input, lang, difficultyToUse, practiceDifficultyToUse);
                    if (result.detectedLanguage && result.detectedLanguage !== LangEnum.UNKNOWN) {
                        finalLang = result.detectedLanguage;
                        toast(`Language detected: ${LanguageDisplayNames[finalLang]}.`, { icon: 'ℹ️' });
                        setCurrentLanguageForAnalysis(finalLang); // Update language state immediately
                    } else if (lang === LangEnum.UNKNOWN) {
                        toast.error("Could not auto-detect language. Please select a file with a known extension or a concept with a specified language.");
                    }
                } else if (type === 'concept_explanation') {
                    result = await analyzeConceptWithGemini(input, lang, difficultyToUse, practiceDifficultyToUse);
                } else {
                    throw new Error("Unsupported activity type for initial analysis.");
                }
                setAnalysisResult(result);
                
                // If this is a *new* analysis triggered from dashboard (initialActivity.analysisResult was null), then log it.
                if (initialActivity && !initialActivity.analysisResult && finalLang) {
                     const activityTypeMap: Record<InputMode, ActivityType> = {
                        fileUpload: 'file_analysis',
                        conceptTyping: 'concept_explanation',
                        pasteCode: 'paste_analysis',
                    };
                    let logInputMode: InputMode = getInitialInputMode(initialActivity);

                    const currentActivityType = activityTypeMap[logInputMode]; 
                    const activityIcon = logInputMode === 'fileUpload' ? 'description' : logInputMode === 'conceptTyping' ? 'lightbulb' : 'content_paste_search';
                    const activityColor = logInputMode === 'fileUpload' ? 'text-indigo-500' : logInputMode === 'conceptTyping' ? 'text-green-500' : 'text-yellow-500';

                    onAddActivity({
                        ...initialActivity, // Spread to keep ID, etc.
                        type: currentActivityType, // Ensure correct type based on mode
                        title: title || "Analyzed item",
                        timestamp: new Date(), // Update timestamp for new analysis
                        summary: `Analyzed: ${result.topicExplanation.coreConcepts.substring(0, 50)}...`,
                        icon: activityIcon,
                        colorClass: activityColor,
                        language: finalLang,
                        originalInput: input,
                        analysisResult: result, // Store the new result
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
            const modeToSet = getInitialInputMode(initialActivity);
            setInputMode(modeToSet);

            if (modeToSet === 'fileUpload' && initialActivity.originalInput) {
                const mockFile = new File([initialActivity.originalInput], initialActivity.title || "loaded_file.txt", { type: "text/plain" });
                setSelectedFile(mockFile);
                setCodeContent(initialActivity.originalInput);
                setFileLanguage(initialActivity.language || null);
            } else if (modeToSet === 'conceptTyping') {
                setConceptText(initialActivity.originalInput || '');
                setConceptLanguage(initialActivity.language || LangEnum.PYTHON);
            } else if (modeToSet === 'pasteCode') {
                setPastedCodeText(initialActivity.originalInput || '');
            }
            
            const difficultyForLoadedActivity = initialActivity.analysisDifficulty || preferredInitialDifficulty;
            const practiceDifficultyForLoadedActivity = defaultPracticeDifficulty;

            if (initialActivity.analysisResult) { 
                setAnalysisResult(initialActivity.analysisResult);
                setCurrentLanguageForAnalysis(initialActivity.language || null);
                setDifficultyForCurrentAnalysis(difficultyForLoadedActivity);
                setPracticeDifficultyForCurrentAnalysis(practiceDifficultyForLoadedActivity);
                setOriginalInputForAnalysis(initialActivity.originalInput || "");
                if (apiKeyMissing) setError("Critical Setup Error: The API_KEY environment variable is missing. AI functionalities are disabled.");
                else setError(null); 
                setIsLoading(false);
                toast(`Loaded previous analysis: ${initialActivity.title}`, {icon: '📂'});
            } else if (initialActivity.originalInput && (initialActivity.language || getInitialInputMode(initialActivity) === 'pasteCode')) { 
                if (apiKeyMissing) {
                    setError("Critical Setup Error: API_KEY missing. Cannot perform analysis."); setIsLoading(false);
                } else {
                    if (analysisStartedForId.current !== initialActivity.id) {
                        analysisStartedForId.current = initialActivity.id;
                        performInitialAnalysis(initialActivity.originalInput, initialActivity.language || LangEnum.UNKNOWN, initialActivity.type, initialActivity.title, difficultyForLoadedActivity, practiceDifficultyForLoadedActivity);
                    }
                }
            } else if (initialActivity.originalInput && !initialActivity.language) {
                setError("Cannot perform analysis: Language for the initial activity is missing or unknown. Please start a new analysis or select a supported file type.");
                setOriginalInputForAnalysis(initialActivity.originalInput); setIsLoading(false); setAnalysisResult(null);
            } else { 
                analysisStartedForId.current = null;
                resetAnalysisState(true); 
                toast.error("Could not load the selected activity. It appears to be incomplete. Please start a new analysis.", {icon: '⚠️'});
                setIsLoading(false); 
            }
        } else { 
            analysisStartedForId.current = null;
            resetAnalysisState(true); 
            setInputMode('fileUpload'); // Default to fileUpload for a fresh session
            setSelectedFile(null); setCodeContent(null); setFileLanguage(null);
            setConceptText(''); setConceptLanguage(LangEnum.PYTHON);
            setPastedCodeText('');
            setIsLoading(false); 
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [initialActivity, preferredInitialDifficulty, defaultPracticeDifficulty, apiKeyMissing, onAddActivity]); // Removed resetAnalysisState from deps as it's stable


    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if ( isSettingsPanelOpen && settingsPanelRef.current && !settingsPanelRef.current.contains(event.target as Node) &&
                 settingsButtonRef.current && !settingsButtonRef.current.contains(event.target as Node) ) {
                setIsSettingsPanelOpen(false);
            }
        };
        if (isSettingsPanelOpen) document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [isSettingsPanelOpen]);

    const toggleSettingsPanel = () => setIsSettingsPanelOpen(prev => !prev);

    const handleInputModeChange = (newMode: InputMode) => {
        if (isLoading) return; 
        
        if (inputMode !== newMode || initialActivity) { 
            resetAnalysisState(true); 
            setInputMode(newMode);

            if (newMode === 'fileUpload') {
                setConceptText(''); setPastedCodeText('');
            } else if (newMode === 'conceptTyping') {
                setSelectedFile(null); setCodeContent(null); setFileLanguage(null);
                setPastedCodeText('');
                if (!conceptLanguage) setConceptLanguage(LangEnum.PYTHON); 
            } else { // pasteCode
                setSelectedFile(null); setCodeContent(null); setFileLanguage(null);
                setConceptText('');
            }
        }
    };

    const handleFileSelect = useCallback((file: File) => {
        setSelectedFile(file); 
        resetAnalysisState(false); 
        setCodeContent(null); setFileLanguage(null); // Clear previous file-specific states
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
        if (error?.startsWith("Unsupported file type") && !apiKeyMissing && newLanguage !== LangEnum.UNKNOWN) setError(null);
        toast(`Language set to ${LanguageDisplayNames[newLanguage]}.`);
    }, [error, apiKeyMissing]);

    const handleConceptTextChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        setConceptText(event.target.value);
        if (event.target.value.trim() && (analysisResult || (error && !apiKeyMissing))) {
             resetAnalysisState(false);
        }
    };

    const handleConceptLanguageChange = (event: React.ChangeEvent<HTMLSelectElement>) => {
        const newLang = event.target.value as SupportedLanguage;
        setConceptLanguage(newLang);
        if ((analysisResult || (error && !apiKeyMissing))) {
            resetAnalysisState(false);
        }
        if (newLang && newLang !== LangEnum.UNKNOWN) toast(`Language context: ${LanguageDisplayNames[newLang]}.`);
    };

    const handlePastedCodeTextChange = (code: string) => {
        setPastedCodeText(code);
        if (code.trim() && (analysisResult || (error && !apiKeyMissing))) {
             resetAnalysisState(false);
        }
    };

    const handleSubmit = async () => {
        if (apiKeyMissing) {
            const errMsg = "Action Required: API_KEY is not configured. Analysis cannot proceed.";
            setError(errMsg); toast.error(errMsg, {id: 'api-key-submit-error'});
            setIsLoading(false); return;
        }

        setError(null); 
        setAnalysisResult(null); 
        setIsLoading(true);

        const initialDifficultyForThisAnalysis = preferredInitialDifficulty; // Use global setting
        const practiceDifficultyForThisAnalysis = defaultPracticeDifficulty; // Use global setting
        setDifficultyForCurrentAnalysis(initialDifficultyForThisAnalysis); 
        setPracticeDifficultyForCurrentAnalysis(practiceDifficultyForThisAnalysis);

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
                result = await analyzeCodeWithGemini(codeContent, fileLanguage, initialDifficultyForThisAnalysis, practiceDifficultyForThisAnalysis);
                toast.success("Code analysis complete!");
            } else if (inputMode === 'conceptTyping') {
                if (!conceptText.trim() || !conceptLanguage || conceptLanguage === LangEnum.UNKNOWN) {
                    const errMsg = "Please enter a programming concept and select a language context.";
                    setError(errMsg); toast.error(errMsg); setIsLoading(false); return;
                }
                currentLang = conceptLanguage; submittedOriginalInput = conceptText; activityType = 'concept_explanation';
                activityTitle = `Concept: ${conceptText.substring(0,40)}${conceptText.length > 40 ? '...' : ''}`;
                activityIcon = 'lightbulb'; activityColor = 'text-green-500';
                result = await analyzeConceptWithGemini(conceptText, conceptLanguage, initialDifficultyForThisAnalysis, practiceDifficultyForThisAnalysis);
                toast.success("Concept analysis complete!");
            } else { // pasteCode
                 if (!pastedCodeText.trim()) {
                    const errMsg = "Please paste your code to be analyzed.";
                    setError(errMsg); toast.error(errMsg); setIsLoading(false); return;
                }
                // Language is unknown and will be detected by the service
                currentLang = LangEnum.UNKNOWN; 
                submittedOriginalInput = pastedCodeText; activityType = 'paste_analysis';
                activityTitle = `Pasted Code: ${pastedCodeText.substring(0,30)}...`;
                activityIcon = 'content_paste_search'; activityColor = 'text-yellow-500';
                result = await analyzeCodeWithGemini(pastedCodeText, LangEnum.UNKNOWN, initialDifficultyForThisAnalysis, practiceDifficultyForThisAnalysis);
                toast.success("Pasted code analysis complete!");

                if(result.detectedLanguage && result.detectedLanguage !== LangEnum.UNKNOWN) {
                    currentLang = result.detectedLanguage;
                    toast(`Language detected: ${LanguageDisplayNames[currentLang]}.`, { icon: 'ℹ️' });
                } else {
                    currentLang = LangEnum.UNKNOWN; // Remain unknown if detection fails
                    const errMsg = "Could not automatically detect the programming language. Analysis may be inaccurate.";
                    setError(errMsg);
                    toast.error(errMsg, { duration: 5000 });
                }
            }
            
            setAnalysisResult(result); setCurrentLanguageForAnalysis(currentLang);
            setOriginalInputForAnalysis(submittedOriginalInput); // Set this for ResultDisplay context
            if (error && !error.includes("Critical Setup Error")) setError(null); // Clear non-critical errors

            if (onAddActivity && currentLang) {
                const newActivity: ActivityItem = {
                    id: Date.now().toString(),
                    type: activityType,
                    title: activityTitle,
                    timestamp: new Date(),
                    summary: `${result.topicExplanation.coreConcepts.substring(0, 70)}...`, 
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
        (inputMode === 'pasteCode' && !pastedCodeText.trim());

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
        mainSubmitButtonText = 'Analyze Pasted Code'; loadingText = 'Detecting Language & Analyzing...'; mainSubmitIcon = 'content_paste_go';
        currentWelcomeTitle = "Paste & Analyze Code Snippets";
        currentWelcomeText = "Paste your code into the editor. The AI will automatically detect the language and provide insights, examples, and practice questions.";
        currentWelcomeIcon = 'integration_instructions';
    }

    const prismLanguageForPastedCodeEditor = getPrismLanguageString(null); // Default to generic for paste editor
    
    // Robust highlight function for the Editor component, using Prism directly
    const robustHighlight = (code: string, lang: string) => {
        if (typeof Prism === 'undefined' || !Prism.highlight || !code) return escapeHtml(code || ''); // Ensure Prism is loaded and code exists
        const grammar = Prism.languages[lang] || Prism.languages.clike; // Fallback to clike
        if (grammar) { 
            try { 
                return Prism.highlight(code, grammar, lang); 
            } catch (e) { 
                console.warn(`Prism highlighting failed for ${lang} in editor:`, e); 
            } 
        }
        return escapeHtml(code); // Fallback for safety
    };


    // Define sticky top offset for the sidebar and result panel based on header height
    const stickyTopOffset = "md:top-[calc(3.5rem+1.5rem)]"; // Header height (3.5rem) + desired gap (1.5rem)
    const panelHeight = "md:h-[calc(100vh-3.5rem-3rem)]"; // Full viewport height - header - total vertical padding/gap


    return (
        <div className="flex flex-col min-h-screen bg-gray-900 text-gray-200">
            {/* Header */}
            <header className="py-3 px-4 sm:px-6 flex justify-between items-center sticky top-0 z-50 bg-gray-900/80 backdrop-blur-md border-b border-gray-700/60 h-14">
                <div className="flex items-center gap-3">
                    {onBackToDashboard && (
                         <button onClick={onBackToDashboard} className="text-gray-300 hover:text-white p-2 rounded-full hover:bg-gray-700/60 transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 focus:ring-offset-gray-900" aria-label="Back to Dashboard">
                            <span className="material-icons">arrow_back</span>
                        </button>
                    )}
                    <div className="flex items-center gap-2">
                        <div className="bg-gradient-to-br from-indigo-600 to-sky-500 p-1.5 rounded-lg shadow-md">
                            <span className="material-icons-outlined text-white text-lg sm:text-xl">model_training</span>
                        </div>
                        <h1 className="text-lg sm:text-xl font-semibold text-white font-lexend">CodeTutor AI</h1>
                    </div>
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

            {/* Main Content Area */}
            <main className={`flex-grow flex flex-col md:flex-row p-4 sm:p-6 transition-all duration-300 ease-in-out ${isLeftPanelCollapsed ? 'md:gap-4' : 'gap-4 sm:gap-6'}`}>
                 {/* Left Sidebar for Inputs */}
                 <aside className={`
                    md:flex-shrink-0 bg-gray-800 rounded-xl shadow-2xl flex flex-col md:sticky ${stickyTopOffset} ${panelHeight}
                    transition-all duration-300 ease-in-out overflow-hidden
                    ${isLeftPanelCollapsed 
                        ? 'w-full md:w-16 p-3 md:mb-0 mb-4' 
                        : 'w-full md:w-[32rem] lg:w-[36rem] p-4 sm:p-6 md:mb-0 mb-6'
                    }
                 `}>
                    {isLeftPanelCollapsed ? (
                        // Collapsed View: The expand button
                        <div className="flex flex-col items-center justify-center h-full">
                            <button
                                onClick={() => setIsLeftPanelCollapsed(false)}
                                className="flex items-center justify-center w-10 h-10 text-gray-300 hover:text-white bg-gray-700/60 hover:bg-indigo-600 rounded-full transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 focus:ring-offset-gray-800 animate-pulse"
                                aria-label="Expand input panel"
                                title="Expand Panel"
                            >
                                <span className="material-icons-outlined transition-transform duration-300 ease-in-out rotate-180">
                                    menu_open
                                </span>
                            </button>
                        </div>
                    ) : (
                        // Expanded View: The full panel content
                        <>
                            <div className="flex-grow space-y-5 overflow-y-auto custom-scrollbar-small pr-1">
                                <div>
                                    <div className="flex justify-between items-center mb-2">
                                        <h2 className="text-sm sm:text-base font-semibold text-white">Input Method</h2>
                                        <button
                                            onClick={() => setIsLeftPanelCollapsed(true)}
                                            className="hidden md:flex items-center justify-center text-gray-400 hover:text-white p-1 rounded-full hover:bg-gray-700/60 transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 focus:ring-offset-gray-800"
                                            aria-label="Collapse input panel"
                                            title="Collapse Panel"
                                        >
                                            <span className="material-icons-outlined">
                                                menu_open
                                            </span>
                                        </button>
                                    </div>
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
                                                    className={combinedClasses} disabled={isLoading}>
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
                                                        className="min-h-[150px] max-h-[300px] overflow-y-auto !text-gray-200" // Increased max-h
                                                        disabled={isLoading} placeholder={`// Paste your code here...\n// Language will be auto-detected.`}
                                                        aria-label="Pasted code input area" aria-labelledby="pasted-code-editor-label"
                                                    />
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                )}

                                {(inputMode === 'fileUpload' && codeContent && fileLanguage && fileLanguage !== LangEnum.UNKNOWN && !isLoading && (!error || error.includes("Critical Setup Error") || !error.startsWith("Unsupported file type"))) && (
                                    <div className="pt-3 border-t border-gray-700/60 overflow-y-auto custom-scrollbar-small min-h-0">
                                        <FileContentViewer
                                            codeContent={codeContent}
                                            language={fileLanguage}
                                            title={`Your Uploaded ${LanguageDisplayNames[fileLanguage] || 'Code'}`}
                                            onViewFull={() => codeContent && fileLanguage && handleOpenFullScreenCodeModal(codeContent, fileLanguage)}
                                        />
                                    </div>
                                )}
                                {(inputMode === 'pasteCode' && pastedCodeText && !isLoading && (!error || error.includes("Critical Setup Error"))) && (
                                    <div className="pt-3 border-t border-gray-700/60 overflow-y-auto custom-scrollbar-small min-h-0">
                                        <FileContentViewer
                                            codeContent={pastedCodeText}
                                            language={LangEnum.UNKNOWN}
                                            title="Your Pasted Code"
                                            onViewFull={() => pastedCodeText && handleOpenFullScreenCodeModal(pastedCodeText, LangEnum.UNKNOWN)}
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
                        </>
                    )}
                 </aside>

                {/* Right Panel for Results */}
                <section className={`flex-grow bg-gray-800 rounded-xl shadow-2xl p-4 sm:p-6 md:p-8 flex flex-col ${panelHeight} md:overflow-y-auto custom-scrollbar-small`}>
                    {isLoading && ( <LoadingSpinner loadingText={loadingText} /> )}

                    {!isLoading && error && <ErrorMessage message={error} />}

                    {!isLoading && !error && analysisResult && currentLanguageForAnalysis && originalInputForAnalysis && (
                        <ResultDisplay
                            result={analysisResult}
                            language={currentLanguageForAnalysis}
                            difficultyOfProvidedExample={difficultyForCurrentAnalysis}
                            initialPracticeDifficulty={practiceDifficultyForCurrentAnalysis}
                            originalInputContext={originalInputForAnalysis}
                            originalInputType={inputMode === 'conceptTyping' ? 'concept' : 'code'}
                        />
                    )}

                    {/* Welcome / Placeholder Screen */}
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
                     {/* Ensure API key error is always visible if it's the current error and no analysis result */}
                     {!isLoading && error && error.includes("Critical Setup Error") && !analysisResult && (
                        <div className="mt-4 w-full max-w-lg mx-auto"><ErrorMessage message={error} /></div>
                     )}
                </section>
            </main>
             {/* Full Screen Code Modal */}
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