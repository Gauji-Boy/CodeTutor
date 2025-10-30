
import React, { useState, useCallback, useEffect, useRef } from 'react';
import { toast } from 'react-hot-toast';
import Editor from 'react-simple-code-editor';
declare var Prism: any;

import { FileUpload } from '../components/FileUpload';
import { ImageUpload } from '../components/ImageUpload';
import { ResultDisplay } from '../components/ResultDisplay';
import { LoadingSpinner } from '../components/LoadingSpinner';
import { ErrorMessage } from '../components/ErrorMessage';
import { FileContentViewer } from '../components/FileContentViewer';
import { SettingsPanel } from '../components/SettingsPanel';
import { FullScreenCodeModal } from '../components/FullScreenCodeModal';
import { DebugResultDisplay } from '../components/DebugResultDisplay';
import { ProjectResultDisplay } from '../components/ProjectResultDisplay';
import { ProjectUpload } from '../components/ProjectUpload'; // New import
import { useGlobalSettings } from '../hooks/useGlobalSettings';
import { analyzeCodeWithGemini, analyzeConceptWithGemini, debugCodeWithGemini, analyzeProjectWithGemini, extractCodeFromImageWithGemini, GeminiRequestConfig } from '../services/geminiService';
import { escapeHtml } from '../utils/textUtils';
import {
    AnalysisResult,
    DebugResult,
    SupportedLanguage,
    LanguageExtensions,
    LanguageDisplayNames,
    SupportedLanguage as LangEnum,
    ExampleDifficulty,
    ActivityItem,
    ActivityType,
    PracticeMaterial,
    ProjectAnalysis,
    ProjectFile,
    ChatMessage,
    AiModel
} from '../types';
import { getPrismLanguageString } from '../components/CodeBlock';

type InputMode = 'fileUpload' | 'imageUpload' | 'conceptTyping' | 'pasteCode' | 'debugCode' | 'projectUpload';

interface HomePageProps {
    initialActivity?: ActivityItem | null;
    onBackToDashboard?: () => void;
    onUpdateActivity: (activity: ActivityItem) => void;
    onClearAllActivities: () => void;
}

const HomePageInternal: React.FC<HomePageProps> = ({ initialActivity, onBackToDashboard, onUpdateActivity, onClearAllActivities }) => {
    const [isLoading, setIsLoading] = useState<boolean>(false);
    const [error, setError] = useState<string | null>(null);
    const [analysisResult, setAnalysisResult] = useState<AnalysisResult | null>(null);
    const [debugResult, setDebugResult] = useState<DebugResult | null>(null);
    const [projectAnalysisResult, setProjectAnalysisResult] = useState<ProjectAnalysis | null>(null);
    const [apiKeyMissing, setApiKeyMissing] = useState<boolean>(false);

    const { 
        preferredInitialDifficulty, 
        defaultPracticeDifficulty, 
        isLeftPanelCollapsed, 
        setIsLeftPanelCollapsed,
        preferredModel,
        customSystemInstruction,
        temperature,
        topP
    } = useGlobalSettings();

    const getInitialInputMode = (activity: ActivityItem | null | undefined): InputMode => {
        if (!activity) return 'projectUpload';
        switch (activity.type) {
            case 'concept_explanation': return 'conceptTyping';
            case 'paste_analysis': return 'pasteCode';
            case 'debug_analysis': return 'debugCode';
            case 'project_analysis': return 'projectUpload';
            case 'image_analysis': return 'imageUpload';
            case 'file_analysis':
            default: return 'fileUpload';
        }
    };
    const [inputMode, setInputMode] = useState<InputMode>(getInitialInputMode(initialActivity));


    // File Upload Mode
    const [selectedFile, setSelectedFile] = useState<File | null>(null);
    const [codeContent, setCodeContent] = useState<string | null>(null);
    const [fileLanguage, setFileLanguage] = useState<SupportedLanguage | null>(null);

    // Image Upload Mode
    const [selectedImageFile, setSelectedImageFile] = useState<File | null>(null);
    const [imagePreviewUrl, setImagePreviewUrl] = useState<string | null>(null);

    // Project Upload Mode
    const [currentProjectFiles, setCurrentProjectFiles] = useState<ProjectFile[] | null>(null);
    const [currentProjectName, setCurrentProjectName] = useState<string | null>(null);
    
    // Concept Typing Mode
    const [conceptText, setConceptText] = useState<string>('');
    const [conceptLanguage, setConceptLanguage] = useState<SupportedLanguage | null>(LangEnum.PYTHON);

    // Paste Code Mode
    const [pastedCodeText, setPastedCodeText] = useState<string>('');

    // Debug Code Mode
    const [debugCodeText, setDebugCodeText] = useState<string>('');
    
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
        setDebugResult(null);
        setProjectAnalysisResult(null);
        setCurrentProjectFiles(null);
        setCurrentProjectName(null);
        setCurrentLanguageForAnalysis(null);
        setDifficultyForCurrentAnalysis(preferredInitialDifficulty); // Reset to global preference
        setPracticeDifficultyForCurrentAnalysis(defaultPracticeDifficulty); // Reset to global preference
        setOriginalInputForAnalysis("");
        if (forNewSession) {
            if (apiKeyMissing) {
                setError("Critical Setup Error: The API_KEY environment variable is missing. AI functionalities are disabled.");
            } else {
                setError(null);
            }
        }
    }, [preferredInitialDifficulty, defaultPracticeDifficulty, apiKeyMissing]);

    // Cleanup for image preview URL
    useEffect(() => {
        return () => {
            if (imagePreviewUrl) {
                URL.revokeObjectURL(imagePreviewUrl);
            }
        };
    }, [imagePreviewUrl]);

    useEffect(() => {
        if (!process.env.API_KEY) {
            setApiKeyMissing(true);
            const errMsg = "Critical Setup Error: The API_KEY environment variable is missing. AI functionalities are disabled.";
            setError(errMsg); toast.error(errMsg, { duration: 7000, id: 'critical-api-key-error' });
        }
    }, []);
    
    const resolveModelForRequest = (
        mode: InputMode,
        preferredModelSetting: AiModel
    ): 'gemini-2.5-flash' | 'gemini-2.5-pro' => {
        if (preferredModelSetting !== 'auto') {
            return preferredModelSetting;
        }
        // Auto logic: use Pro for more complex tasks, Flash for speed on common tasks
        switch (mode) {
            case 'projectUpload':
            case 'debugCode':
            case 'conceptTyping': // Concepts can be complex and benefit from Pro
            case 'imageUpload': // Image processing can be complex
                return 'gemini-2.5-pro';
            case 'fileUpload':
            case 'pasteCode':
            default:
                return 'gemini-2.5-flash';
        }
    };

    const handleAnalyzeFileFromProject = useCallback(async (fileToAnalyze: ProjectFile) => {
        setIsLoading(true);
        setError(null);
        setProjectAnalysisResult(null);
        setAnalysisResult(null);
        setDebugResult(null);
        toast(`Analyzing file: ${fileToAnalyze.path}...`, { icon: '⏳' });

        const extension = fileToAnalyze.path.substring(fileToAnalyze.path.lastIndexOf('.')).toLowerCase();
        const language = LanguageExtensions[extension] || LangEnum.UNKNOWN;
        
        setCurrentLanguageForAnalysis(language);
        setOriginalInputForAnalysis(fileToAnalyze.content);
        setInputMode('fileUpload');
        const mockFile = new File([fileToAnalyze.content], fileToAnalyze.path, { type: "text/plain" });
        setSelectedFile(mockFile);
        setCodeContent(fileToAnalyze.content);
        setFileLanguage(language);

        const modelToUse = resolveModelForRequest('fileUpload', preferredModel);
        const requestConfig: GeminiRequestConfig = {
            model: modelToUse,
            temperature,
            topP,
            systemInstruction: customSystemInstruction,
        };

        try {
            const result = await analyzeCodeWithGemini(
                fileToAnalyze.content, 
                language, 
                preferredInitialDifficulty, 
                defaultPracticeDifficulty,
                requestConfig
            );
            
            let finalLang = language;
            if (result.detectedLanguage && result.detectedLanguage !== LangEnum.UNKNOWN) {
                finalLang = result.detectedLanguage;
                toast(`Language detected: ${LanguageDisplayNames[finalLang]}.`, { icon: 'ℹ️' });
                setCurrentLanguageForAnalysis(finalLang);
            }

            setAnalysisResult(result);
            toast.success("File analysis complete!");

            onUpdateActivity({
                id: Date.now().toString(),
                type: 'file_analysis',
                title: fileToAnalyze.path,
                timestamp: new Date(),
                summary: `${result.topicExplanation.coreConcepts.substring(0, 70)}...`,
                icon: 'description',
                colorClass: 'text-indigo-400',
                language: finalLang,
                originalInput: fileToAnalyze.content,
                analysisResult: result,
                debugResult: null,
                analysisDifficulty: preferredInitialDifficulty,
            });

        } catch (err) {
            const errMessage = err instanceof Error ? err.message : "An unexpected error occurred during file analysis.";
            setError(errMessage);
            toast.error(errMessage);
            console.error(err);
        } finally {
            setIsLoading(false);
        }
    }, [preferredInitialDifficulty, defaultPracticeDifficulty, onUpdateActivity, preferredModel, temperature, topP, customSystemInstruction]);

    // Effect to handle initialActivity loading or new session setup
    useEffect(() => {
        const mapActivityTypeToInputMode = (type: ActivityItem['type']): InputMode => {
            switch(type) {
                case 'concept_explanation': return 'conceptTyping';
                case 'paste_analysis': return 'pasteCode';
                case 'debug_analysis': return 'debugCode';
                case 'project_analysis': return 'projectUpload';
                case 'image_analysis': return 'imageUpload';
                case 'file_analysis': return 'fileUpload';
                default: return 'fileUpload'; // fallback
            }
        };

        const performInitialAnalysis = async (input: string, lang: SupportedLanguage, type: ActivityItem['type'], title: string, difficultyToUse: ExampleDifficulty, practiceDifficultyToUse: ExampleDifficulty) => {
            setIsLoading(true); setError(null); setAnalysisResult(null); setDebugResult(null); setProjectAnalysisResult(null);
            setOriginalInputForAnalysis(input);
            setCurrentLanguageForAnalysis(lang);
            setDifficultyForCurrentAnalysis(difficultyToUse);
            setPracticeDifficultyForCurrentAnalysis(practiceDifficultyToUse);
            toast(`Processing: ${title}...`, {icon: '⏳'});
            
            const modeForRequest = mapActivityTypeToInputMode(type);
            const modelToUse = resolveModelForRequest(modeForRequest, preferredModel);
            const requestConfig: GeminiRequestConfig = {
                model: modelToUse,
                temperature,
                topP,
                systemInstruction: customSystemInstruction
            };

            try {
                let result: AnalysisResult | DebugResult;
                let finalLang = lang;
                
                if (type === 'debug_analysis') {
                    result = await debugCodeWithGemini(input, lang, requestConfig);
                    if (result.detectedLanguage && result.detectedLanguage !== LangEnum.UNKNOWN) {
                        finalLang = result.detectedLanguage;
                        toast(`Language detected: ${LanguageDisplayNames[finalLang]}.`, { icon: 'ℹ️' });
                        setCurrentLanguageForAnalysis(finalLang);
                    }
                    setDebugResult(result);
                } else if ((type === 'file_analysis' || type === 'paste_analysis' || type === 'image_analysis')) { // image analysis result is just a code analysis
                    result = await analyzeCodeWithGemini(input, lang, difficultyToUse, practiceDifficultyToUse, requestConfig);
                    if (result.detectedLanguage && result.detectedLanguage !== LangEnum.UNKNOWN) {
                        finalLang = result.detectedLanguage;
                        toast(`Language detected: ${LanguageDisplayNames[finalLang]}.`, { icon: 'ℹ️' });
                        setCurrentLanguageForAnalysis(finalLang);
                    } else if (lang === LangEnum.UNKNOWN) {
                        toast.error("Could not auto-detect language. Please select a file with a known extension or a concept with a specified language.");
                    }
                    setAnalysisResult(result);
                } else if (type === 'concept_explanation') {
                    result = await analyzeConceptWithGemini(input, lang, difficultyToUse, practiceDifficultyToUse, requestConfig);
                    setAnalysisResult(result);
                } else {
                    throw new Error("Unsupported activity type for initial analysis.");
                }
                
                if (initialActivity && !initialActivity.analysisResult && !initialActivity.debugResult && finalLang) {
                    onUpdateActivity({
                        ...initialActivity,
                        type, title, timestamp: new Date(),
                        summary: type === 'debug_analysis' 
                            ? (result as DebugResult).summary.substring(0, 50) + '...'
                            : (result as AnalysisResult).topicExplanation.coreConcepts.substring(0, 50) + '...',
                        icon: type === 'debug_analysis' ? 'bug_report' : initialActivity.icon,
                        colorClass: type === 'debug_analysis' ? 'text-red-500' : initialActivity.colorClass,
                        language: finalLang,
                        originalInput: input,
                        analysisResult: type !== 'debug_analysis' ? (result as AnalysisResult) : null,
                        debugResult: type === 'debug_analysis' ? (result as DebugResult) : null,
                        analysisDifficulty: difficultyToUse
                    });
                }
                toast.success("Processing complete!");
            } catch (err) {
                const errMessage = err instanceof Error ? err.message : "An unexpected error occurred during initial analysis.";
                setError(errMessage); toast.error(errMessage); console.error(err);
            } finally {
                setIsLoading(false);
            }
        };
        
        const performInitialImageExtractionAndAnalysis = async (activity: ActivityItem) => {
            setIsLoading(true); setError(null); setAnalysisResult(null);
            
            const modelToUse = resolveModelForRequest('imageUpload', preferredModel);
            const requestConfig: GeminiRequestConfig = { model: modelToUse, temperature, topP, systemInstruction: customSystemInstruction };

            try {
                if (!activity.originalImage) throw new Error("Image data is missing from the activity.");

                // Convert base64 back to file for the service
                const res = await fetch(activity.originalImage);
                const blob = await res.blob();
                const imageFile = new File([blob], activity.title, { type: blob.type });

                toast.loading("Extracting code from image...", { id: 'image-extract' });
                const extractedCode = await extractCodeFromImageWithGemini(imageFile, requestConfig);
                toast.success("Code extracted, now analyzing...", { id: 'image-extract' });

                const difficulty = activity.analysisDifficulty || preferredInitialDifficulty;
                const practiceDifficulty = defaultPracticeDifficulty;
                
                const result = await analyzeCodeWithGemini(extractedCode, LangEnum.UNKNOWN, difficulty, practiceDifficulty, requestConfig);
                
                let finalLang = result.detectedLanguage || LangEnum.UNKNOWN;
                if (finalLang !== LangEnum.UNKNOWN) {
                    toast.success(`Language detected: ${LanguageDisplayNames[finalLang]}`, { id: 'image-extract' });
                }
                
                setAnalysisResult(result);
                setCurrentLanguageForAnalysis(finalLang);
                setOriginalInputForAnalysis(extractedCode);

                onUpdateActivity({
                    ...activity,
                    originalInput: extractedCode,
                    analysisResult: result,
                    language: finalLang,
                    summary: result.topicExplanation.coreConcepts.substring(0, 70) + '...'
                });

            } catch(err) {
                const errMessage = err instanceof Error ? err.message : "An unexpected error occurred during image processing.";
                setError(errMessage); toast.error(errMessage, { id: 'image-extract' }); console.error(err);
            } finally {
                setIsLoading(false);
            }
        };

        const performInitialProjectAnalysis = async (files: ProjectFile[], name: string, activity: ActivityItem) => {
             setIsLoading(true); setError(null); setAnalysisResult(null); setDebugResult(null); setProjectAnalysisResult(null);
             toast(`Analyzing project: ${name}...`, {icon: '⏳'});
             setCurrentProjectFiles(files);
             setCurrentProjectName(name);
             
             const modelToUse = resolveModelForRequest('projectUpload', preferredModel);
             const requestConfig: GeminiRequestConfig = {
                model: modelToUse,
                temperature,
                topP,
                systemInstruction: customSystemInstruction
             };

             try {
                const result = await analyzeProjectWithGemini(files, name, requestConfig);
                setProjectAnalysisResult(result);

                onUpdateActivity({
                    ...activity,
                    projectAnalysis: result,
                    summary: result.overview.substring(0, 70) + '...',
                });
                toast.success("Project overview complete!");

             } catch(err) {
                const errMessage = err instanceof Error ? err.message : "An unexpected error occurred during project analysis.";
                setError(errMessage); toast.error(errMessage); console.error(err);
             } finally {
                setIsLoading(false);
             }
        };

        if (initialActivity) {
            const modeToSet = getInitialInputMode(initialActivity);
            setInputMode(modeToSet);

            // Populate inputs based on loaded activity
            if (modeToSet === 'fileUpload' && initialActivity.originalInput) {
                const mockFile = new File([initialActivity.originalInput], initialActivity.title, { type: "text/plain" });
                setSelectedFile(mockFile); setCodeContent(initialActivity.originalInput); setFileLanguage(initialActivity.language || null);
            } else if (modeToSet === 'imageUpload' && initialActivity.originalImage) {
                setImagePreviewUrl(initialActivity.originalImage); // It's already a data URL
            } else if (modeToSet === 'projectUpload' && initialActivity.projectFiles) {
                setCurrentProjectFiles(initialActivity.projectFiles); setCurrentProjectName(initialActivity.title);
            } else if (modeToSet === 'conceptTyping') {
                setConceptText(initialActivity.originalInput || ''); setConceptLanguage(initialActivity.language || LangEnum.PYTHON);
            } else if (modeToSet === 'pasteCode') {
                setPastedCodeText(initialActivity.originalInput || '');
            } else if (modeToSet === 'debugCode') {
                setDebugCodeText(initialActivity.originalInput || '');
            }
            
            const difficultyForLoadedActivity = initialActivity.analysisDifficulty || preferredInitialDifficulty;
            const practiceDifficultyForLoadedActivity = defaultPracticeDifficulty;

            // Decide whether to show existing results or run new analysis
            if (initialActivity.analysisResult) { 
                setAnalysisResult(initialActivity.analysisResult); setDebugResult(null); setProjectAnalysisResult(null);
                setCurrentLanguageForAnalysis(initialActivity.language || null); setDifficultyForCurrentAnalysis(difficultyForLoadedActivity);
                setPracticeDifficultyForCurrentAnalysis(practiceDifficultyForLoadedActivity); setOriginalInputForAnalysis(initialActivity.originalInput || "");
                if (apiKeyMissing) setError("Critical Setup Error: The API_KEY environment variable is missing. AI functionalities are disabled."); else setError(null); 
                setIsLoading(false); toast(`Loaded previous analysis: ${initialActivity.title}`, {icon: '📂'});
            } else if (initialActivity.debugResult) {
                setDebugResult(initialActivity.debugResult); setAnalysisResult(null); setProjectAnalysisResult(null);
                setCurrentLanguageForAnalysis(initialActivity.language || null); setOriginalInputForAnalysis(initialActivity.originalInput || "");
                if (apiKeyMissing) setError("Critical Setup Error: The API_KEY environment variable is missing. AI functionalities are disabled."); else setError(null);
                setIsLoading(false); toast(`Loaded previous debug session: ${initialActivity.title}`, { icon: '📂' });
            } else if (initialActivity.projectAnalysis) {
                setProjectAnalysisResult(initialActivity.projectAnalysis); setDebugResult(null); setAnalysisResult(null);
                setCurrentProjectFiles(initialActivity.projectFiles || null); setCurrentProjectName(initialActivity.title);
                if (apiKeyMissing) setError("Critical Setup Error: The API_KEY environment variable is missing. AI functionalities are disabled."); else setError(null);
                setIsLoading(false); toast(`Loaded previous project analysis: ${initialActivity.title}`, { icon: '📂' });
            } else if (initialActivity.type === 'image_analysis' && initialActivity.originalImage) {
                if (apiKeyMissing) { setError("Critical Setup Error: API_KEY missing."); setIsLoading(false); }
                else if (analysisStartedForId.current !== initialActivity.id) {
                    analysisStartedForId.current = initialActivity.id;
                    performInitialImageExtractionAndAnalysis(initialActivity);
                }
            } else if (initialActivity.type === 'project_analysis' && initialActivity.projectFiles) {
                 if (apiKeyMissing) { setError("Critical Setup Error: API_KEY missing. Cannot perform analysis."); setIsLoading(false); } 
                 else if (analysisStartedForId.current !== initialActivity.id) {
                    analysisStartedForId.current = initialActivity.id;
                    performInitialProjectAnalysis(initialActivity.projectFiles, initialActivity.title, initialActivity);
                }
            } else if (initialActivity.originalInput && (initialActivity.language || initialActivity.type === 'paste_analysis' || initialActivity.type === 'debug_analysis')) { 
                if (apiKeyMissing) { setError("Critical Setup Error: API_KEY missing. Cannot perform analysis."); setIsLoading(false); } 
                else if (analysisStartedForId.current !== initialActivity.id) {
                    analysisStartedForId.current = initialActivity.id;
                    performInitialAnalysis(initialActivity.originalInput, initialActivity.language || LangEnum.UNKNOWN, initialActivity.type, initialActivity.title, difficultyForLoadedActivity, practiceDifficultyForLoadedActivity);
                }
            } else if (initialActivity.originalInput && !initialActivity.language) {
                setError("Cannot perform analysis: Language for the initial activity is missing or unknown.");
                setOriginalInputForAnalysis(initialActivity.originalInput); setIsLoading(false);
            } else { 
                analysisStartedForId.current = null;
                resetAnalysisState(true); 
                toast.error("Could not load the selected activity. It appears to be incomplete.", {icon: '⚠️'});
                setIsLoading(false); 
            }
        } else { 
            analysisStartedForId.current = null;
            resetAnalysisState(true); 
            setInputMode('projectUpload');
            setSelectedFile(null); setCodeContent(null); setFileLanguage(null);
            setConceptText(''); setConceptLanguage(LangEnum.PYTHON);
            setPastedCodeText(''); setDebugCodeText('');
            setIsLoading(false); 
        }
    }, [initialActivity, preferredInitialDifficulty, defaultPracticeDifficulty, apiKeyMissing, onUpdateActivity, resetAnalysisState, handleAnalyzeFileFromProject, preferredModel, temperature, topP, customSystemInstruction]);


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
            setSelectedFile(null); setCodeContent(null); setFileLanguage(null);
            setSelectedImageFile(null); setImagePreviewUrl(null);
            setConceptText(''); setPastedCodeText(''); setDebugCodeText('');
            setCurrentProjectFiles(null); setCurrentProjectName(null);
            if (newMode === 'conceptTyping' && !conceptLanguage) setConceptLanguage(LangEnum.PYTHON); 
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

    const handleImageSelect = useCallback((file: File) => {
        setSelectedImageFile(file);
        resetAnalysisState(false);
        if (imagePreviewUrl) URL.revokeObjectURL(imagePreviewUrl);
        setImagePreviewUrl(URL.createObjectURL(file));
        if (!apiKeyMissing) setError(null);
        toast.success(`Image "${file.name}" loaded.`);
    }, [resetAnalysisState, apiKeyMissing, imagePreviewUrl]);

    const handleProjectFilesSelected = async (files: FileList) => {
        if (!files || files.length === 0) {
            setCurrentProjectFiles(null);
            setCurrentProjectName(null);
            return;
        }
    
        setIsLoading(true);
        toast.loading('Reading project files...', { id: 'project-read-home' });
    
        const fileContents: ProjectFile[] = [];
        const filesArray = Array.from(files);
        
        const rootDirName = filesArray[0].webkitRelativePath.split('/')[0] || 'Untitled Project';
        const packageJsonFile = filesArray.find(f => f.name === 'package.json' && f.webkitRelativePath.split('/').length === 2);
        let finalProjectName = rootDirName;
        if (packageJsonFile) {
            try {
                const content = await packageJsonFile.text();
                const parsed = JSON.parse(content);
                if (parsed.name) finalProjectName = parsed.name;
            } catch(e) { console.warn('Could not parse package.json for project name'); }
        }
        
        for (const file of filesArray) {
            if (file.size > 2 * 1024 * 1024) { console.warn(`Skipping large file: ${file.webkitRelativePath}`); continue; }
            const path = file.webkitRelativePath;
            if (path.includes('/.git/') || path.includes('/node_modules/') || path.includes('/dist/') || path.includes('/build/')) continue;
            if (file.name.startsWith('.')) continue;
    
            try {
                const isBinary = await new Promise<boolean>(resolve => {
                    const reader = new FileReader();
                    reader.onload = (e) => resolve((e.target?.result as string).includes('\u0000'));
                    reader.onerror = () => resolve(true);
                    reader.readAsText(file.slice(0, 1024));
                });
                if (isBinary) { console.warn(`Skipping binary file: ${path}`); continue; }
                const content = await file.text();
                fileContents.push({ path, content });
            } catch (e) { console.error(`Could not read file ${path}:`, e); }
        }
        
        setCurrentProjectFiles(fileContents);
        setCurrentProjectName(finalProjectName);
        setIsLoading(false);
    
        if(fileContents.length > 0) {
            toast.success(`Project "${finalProjectName}" loaded with ${fileContents.length} files.`, { id: 'project-read-home', duration: 4000 });
            if (error && !apiKeyMissing) setError(null);
        } else {
            toast.error(`Could not read any valid files from the selected directory.`, { id: 'project-read-home', duration: 4000 });
            setCurrentProjectFiles(null);
            setCurrentProjectName(null);
        }
    };

    const handleFileLanguageChange = useCallback((newLanguage: SupportedLanguage) => {
        setFileLanguage(newLanguage);
        if (error?.startsWith("Unsupported file type") && !apiKeyMissing && newLanguage !== LangEnum.UNKNOWN) setError(null);
        toast(`Language set to ${LanguageDisplayNames[newLanguage]}.`);
    }, [error, apiKeyMissing]);

    const handleConceptTextChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        setConceptText(event.target.value);
        if (event.target.value.trim() && (analysisResult || debugResult || (error && !apiKeyMissing))) {
             resetAnalysisState(false);
        }
    };

    const handleConceptLanguageChange = (event: React.ChangeEvent<HTMLSelectElement>) => {
        const newLang = event.target.value as SupportedLanguage;
        setConceptLanguage(newLang);
        if ((analysisResult || debugResult || (error && !apiKeyMissing))) {
            resetAnalysisState(false);
        }
        if (newLang && newLang !== LangEnum.UNKNOWN) toast(`Language context: ${LanguageDisplayNames[newLang]}.`);
    };

    const handlePastedCodeTextChange = (code: string) => {
        setPastedCodeText(code);
        if (code.trim() && (analysisResult || debugResult || (error && !apiKeyMissing))) {
             resetAnalysisState(false);
        }
    };

    const handleDebugCodeTextChange = (code: string) => {
        setDebugCodeText(code);
        if (code.trim() && (analysisResult || debugResult || (error && !apiKeyMissing))) {
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
        setDebugResult(null);
        setProjectAnalysisResult(null);
        setIsLoading(true);

        const initialDifficultyForThisAnalysis = preferredInitialDifficulty;
        const practiceDifficultyForThisAnalysis = defaultPracticeDifficulty;
        setDifficultyForCurrentAnalysis(initialDifficultyForThisAnalysis); 
        setPracticeDifficultyForCurrentAnalysis(practiceDifficultyForThisAnalysis);

        let submittedOriginalInput = "";
        let activityType: ActivityType = 'file_analysis';
        let activityTitle = "";
        let activityIcon = 'description';
        let activityColor = 'text-indigo-500';
        
        const modelToUse = resolveModelForRequest(inputMode, preferredModel);
        const requestConfig: GeminiRequestConfig = {
            model: modelToUse,
            temperature,
            topP,
            systemInstruction: customSystemInstruction,
        };

        try {
            let result: AnalysisResult | DebugResult | ProjectAnalysis;
            let currentLang: SupportedLanguage | null = null;
            let summary = "";

            if (inputMode === 'imageUpload') {
                if (!selectedImageFile) throw new Error("Please select an image file.");
                
                activityType = 'image_analysis';
                activityTitle = selectedImageFile.name;
                activityIcon = 'image_search';
                activityColor = 'text-cyan-400';
                
                toast.loading('Extracting code from image...', { id: 'image-process' });
                
                const extractedCode = await extractCodeFromImageWithGemini(selectedImageFile, requestConfig);
                submittedOriginalInput = extractedCode;
                setOriginalInputForAnalysis(extractedCode);
                
                toast.loading('Analyzing extracted code...', { id: 'image-process' });

                result = await analyzeCodeWithGemini(extractedCode, LangEnum.UNKNOWN, initialDifficultyForThisAnalysis, practiceDifficultyForThisAnalysis, requestConfig);
                setAnalysisResult(result);
                summary = result.topicExplanation.coreConcepts;
                
                if (result.detectedLanguage && result.detectedLanguage !== LangEnum.UNKNOWN) {
                    currentLang = result.detectedLanguage;
                    toast.success(`Language detected: ${LanguageDisplayNames[currentLang]}.`, { icon: 'ℹ️', id: 'image-process' });
                } else {
                    toast.success('Analysis complete!', { id: 'image-process' });
                    setError("Could not automatically detect language. Analysis may be inaccurate.");
                }
            } else if (inputMode === 'fileUpload') {
                if (!codeContent || !fileLanguage || fileLanguage === LangEnum.UNKNOWN || !selectedFile) {
                    throw new Error("Please select a valid code file and ensure its language is correctly identified.");
                }
                currentLang = fileLanguage; submittedOriginalInput = codeContent; activityType = 'file_analysis';
                activityTitle = selectedFile.name; activityIcon = 'description'; activityColor = 'text-indigo-400';
                result = await analyzeCodeWithGemini(codeContent, fileLanguage, initialDifficultyForThisAnalysis, practiceDifficultyForThisAnalysis, requestConfig);
                setAnalysisResult(result);
                summary = result.topicExplanation.coreConcepts;
            } else if (inputMode === 'conceptTyping') {
                if (!conceptText.trim() || !conceptLanguage || conceptLanguage === LangEnum.UNKNOWN) {
                    throw new Error("Please enter a programming concept and select a language context.");
                }
                currentLang = conceptLanguage; submittedOriginalInput = conceptText; activityType = 'concept_explanation';
                activityTitle = `Concept: ${conceptText.substring(0,40)}${conceptText.length > 40 ? '...' : ''}`;
                activityIcon = 'lightbulb'; activityColor = 'text-green-500';
                result = await analyzeConceptWithGemini(conceptText, conceptLanguage, initialDifficultyForThisAnalysis, practiceDifficultyForThisAnalysis, requestConfig);
                setAnalysisResult(result);
                summary = result.topicExplanation.coreConcepts;
            } else if (inputMode === 'pasteCode') {
                 if (!pastedCodeText.trim()) { throw new Error("Please paste your code to be analyzed."); }
                currentLang = LangEnum.UNKNOWN; 
                submittedOriginalInput = pastedCodeText; activityType = 'paste_analysis';
                activityTitle = `Pasted Code: ${pastedCodeText.substring(0,30)}...`;
                activityIcon = 'content_paste_search'; activityColor = 'text-yellow-500';
                result = await analyzeCodeWithGemini(pastedCodeText, LangEnum.UNKNOWN, initialDifficultyForThisAnalysis, practiceDifficultyForThisAnalysis, requestConfig);
                setAnalysisResult(result);
                summary = result.topicExplanation.coreConcepts;
                if(result.detectedLanguage && result.detectedLanguage !== LangEnum.UNKNOWN) {
                    currentLang = result.detectedLanguage; toast(`Language detected: ${LanguageDisplayNames[currentLang]}.`, { icon: 'ℹ️' });
                } else {
                    setError("Could not automatically detect language. Analysis may be inaccurate.");
                }
            } else if (inputMode === 'debugCode') {
                if (!debugCodeText.trim()) { throw new Error("Please paste your code to be debugged.");}
                currentLang = LangEnum.UNKNOWN;
                submittedOriginalInput = debugCodeText; activityType = 'debug_analysis';
                activityTitle = `Debug: ${debugCodeText.substring(0,30)}...`;
                activityIcon = 'bug_report'; activityColor = 'text-red-500';
                result = await debugCodeWithGemini(debugCodeText, LangEnum.UNKNOWN, requestConfig);
                setDebugResult(result);
                summary = result.summary;
                if(result.detectedLanguage && result.detectedLanguage !== LangEnum.UNKNOWN) {
                    currentLang = result.detectedLanguage; toast(`Language detected: ${LanguageDisplayNames[currentLang]}.`, { icon: 'ℹ️' });
                } else {
                    setError("Could not automatically detect language. Debugging may be inaccurate.");
                }
            } else if (inputMode === 'projectUpload') {
                if (!currentProjectFiles || !currentProjectName) {
                    throw new Error("Please select a project folder or ZIP file.");
                }
                currentLang = null; // Project can have multiple languages
                submittedOriginalInput = currentProjectName;
                activityType = 'project_analysis';
                activityTitle = `Project: ${currentProjectName}`;
                activityIcon = 'folder_zip';
                activityColor = 'text-purple-400';
                result = await analyzeProjectWithGemini(currentProjectFiles, currentProjectName, requestConfig);
                setProjectAnalysisResult(result);
                summary = result.overview;
            } else {
                 throw new Error("Invalid submission mode.");
            }
            
            if(activityType !== 'image_analysis') toast.success("Analysis complete!"); // Image analysis has its own toasts
            setCurrentLanguageForAnalysis(currentLang);
            setOriginalInputForAnalysis(submittedOriginalInput);
            if (error && !error.includes("Critical Setup Error")) setError(null);

            if (onUpdateActivity) {
                const newActivity: ActivityItem = {
                    id: Date.now().toString(), type: activityType, title: activityTitle, timestamp: new Date(),
                    summary: `${summary.substring(0, 70)}...`, icon: activityIcon, colorClass: activityColor,
                    language: currentLang || undefined,
                    originalInput: (activityType !== 'project_analysis') ? submittedOriginalInput : undefined,
                    originalImage: activityType === 'image_analysis' ? imagePreviewUrl : undefined,
                    analysisResult: (activityType !== 'debug_analysis' && activityType !== 'project_analysis') ? (result as AnalysisResult) : null,
                    debugResult: activityType === 'debug_analysis' ? (result as DebugResult) : null,
                    analysisDifficulty: initialDifficultyForThisAnalysis,
                    projectFiles: activityType === 'project_analysis' ? currentProjectFiles : undefined,
                    projectAnalysis: activityType === 'project_analysis' ? (result as ProjectAnalysis) : null,
                };
                onUpdateActivity(newActivity);
            }

        } catch (err) {
            const errMessage = err instanceof Error ? err.message : "An unexpected error occurred.";
            setError(errMessage); toast.error(errMessage, { id: 'image-process' }); console.error(err);
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

    const handleProjectChatUpdate = (newHistory: ChatMessage[]) => {
        if (initialActivity && initialActivity.type === 'project_analysis') {
            onUpdateActivity({
                ...initialActivity,
                projectChatHistory: newHistory,
            });
        }
    };

    const isAnalyzeButtonDisabled = isLoading || apiKeyMissing ||
        (inputMode === 'fileUpload' && (!selectedFile || !fileLanguage || fileLanguage === LangEnum.UNKNOWN || !codeContent)) ||
        (inputMode === 'imageUpload' && !selectedImageFile) ||
        (inputMode === 'conceptTyping' && (!conceptText.trim() || !conceptLanguage || conceptLanguage === LangEnum.UNKNOWN)) ||
        (inputMode === 'pasteCode' && !pastedCodeText.trim()) ||
        (inputMode === 'debugCode' && !debugCodeText.trim()) ||
        (inputMode === 'projectUpload' && !currentProjectFiles);


    let mainSubmitButtonText = 'Analyze Code';
    let loadingText = 'Analyzing...';
    let mainSubmitIcon = 'analytics';
    let currentWelcomeTitle = "Code Analysis & Learning Assistant";
    let currentWelcomeText = "Select an input method to begin. Upload files, explore concepts, or paste code snippets for AI-powered insights and learning exercises.";
    let currentWelcomeIcon = "auto_awesome";

    if (inputMode === 'projectUpload') {
      mainSubmitButtonText = 'Analyze Project'; loadingText = 'Analyzing Project...'; mainSubmitIcon = 'account_tree';
      currentWelcomeTitle = "Analyze a Project";
      currentWelcomeText = "Select a project folder or a .zip file. The AI will provide a high-level overview of the architecture and a breakdown of each file.";
      currentWelcomeIcon = 'folder_zip';
    } else if (inputMode === 'imageUpload') {
        mainSubmitButtonText = 'Extract & Analyze Code'; loadingText = 'Processing Image...'; mainSubmitIcon = 'image_search';
        currentWelcomeTitle = "Analyze Code from an Image";
        currentWelcomeText = "Upload a screenshot or photo of code. The AI will extract the text and provide a full analysis.";
        currentWelcomeIcon = 'image_search';
    } else if (inputMode === 'fileUpload') {
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
    } else if (inputMode === 'debugCode') {
        mainSubmitButtonText = 'Debug My Code'; loadingText = 'Finding Bugs...'; mainSubmitIcon = 'bug_report';
        currentWelcomeTitle = "Debug Your Code";
        currentWelcomeText = "Paste your broken code. The AI will identify syntax and logic errors, explain them, and provide a corrected version with a diff view.";
        currentWelcomeIcon = 'construction';
    }

    const prismLanguageForPastedCodeEditor = getPrismLanguageString(null);
    
    const robustHighlight = (code: string, lang: string) => {
        if (typeof Prism === 'undefined' || !Prism.highlight || !code) return escapeHtml(code || '');
        const grammar = Prism.languages[lang] || Prism.languages.clike;
        if (grammar) { 
            try { return Prism.highlight(code, grammar, lang); } catch (e) { console.warn(`Prism highlighting failed for ${lang} in editor:`, e); } 
        }
        return escapeHtml(code);
    };


    const stickyTopOffset = "md:top-[calc(3.5rem+1.5rem)]";
    const panelHeight = "md:h-[calc(100vh-3.5rem-3rem)]";


    return (
        <div className="flex flex-col min-h-screen bg-gray-900 text-gray-200">
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
                                onClearAllActivities={onClearAllActivities}
                            />
                        </div>
                    )}
                </div>
            </header>

            <main className={`flex-grow flex flex-col md:flex-row p-4 sm:p-6 transition-all duration-300 ease-in-out ${isLeftPanelCollapsed ? 'md:gap-4' : 'gap-4 sm:gap-6'}`}>
                 <aside className={`
                    md:flex-shrink-0 bg-gray-800 rounded-xl shadow-2xl flex flex-col md:sticky ${stickyTopOffset} ${panelHeight}
                    transition-all duration-300 ease-in-out
                    ${isLeftPanelCollapsed 
                        ? 'w-full md:w-16 p-3 md:mb-0 mb-4' 
                        : 'w-full md:w-[32rem] lg:w-[36rem] md:mb-0 mb-6'
                    }
                 `}>
                    {isLeftPanelCollapsed ? (
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
                        <>
                            <div className="flex-grow overflow-y-auto custom-scrollbar-small">
                                <div className="p-4 sm:p-6">
                                    <div className="space-y-5">
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
                                            <div className="grid grid-cols-3 lg:grid-cols-3 gap-2">
                                                {(['projectUpload', 'fileUpload', 'imageUpload', 'conceptTyping', 'pasteCode', 'debugCode'] as InputMode[]).map(mode => {
                                                    let icon = 'description'; let label = 'File';
                                                    if (mode === 'projectUpload') { icon = 'folder_zip'; label = 'Project'; }
                                                    else if (mode === 'imageUpload') { icon = 'image_search'; label = 'Image'; }
                                                    else if (mode === 'conceptTyping') { icon = 'lightbulb'; label = 'Concept'; }
                                                    else if (mode === 'pasteCode') { icon = 'content_paste'; label = 'Paste'; }
                                                    else if (mode === 'debugCode') { icon = 'bug_report'; label = 'Debug'; }
                                                    
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

                                        {inputMode === 'projectUpload' && (
                                            <ProjectUpload
                                                onProjectFilesSelected={handleProjectFilesSelected}
                                                projectName={currentProjectName}
                                                fileCount={currentProjectFiles?.length || 0}
                                                isLoading={isLoading}
                                            />
                                        )}

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
                                        
                                        {inputMode === 'imageUpload' && (
                                            <ImageUpload
                                                onFileSelect={handleImageSelect}
                                                selectedFile={selectedImageFile}
                                                previewUrl={imagePreviewUrl}
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
                                                        <div id="pasted-code-editor-outer" className="bg-gray-900/60 border border-gray-600 rounded-md overflow-hidden focus-within:ring-1 focus-within:ring-indigo-500 focus-within:border-indigo-500 custom-scrollbar-small shadow-sm">
                                                            <Editor
                                                                value={pastedCodeText} onValueChange={handlePastedCodeTextChange}
                                                                highlight={code => robustHighlight(code, prismLanguageForPastedCodeEditor)}
                                                                padding={10} textareaClassName="code-editor-textarea !text-xs !font-fira-code" preClassName="code-editor-pre !text-xs !font-fira-code"
                                                                className="min-h-[150px] max-h-[300px] overflow-y-auto !text-gray-200"
                                                                disabled={isLoading} placeholder={`// Paste your code here...\n// Language will be auto-detected.`}
                                                                aria-label="Pasted code input area" aria-labelledby="pasted-code-editor-label"
                                                            />
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        )}

                                        {inputMode === 'debugCode' && (
                                            <div className="space-y-3 pt-3 border-t border-gray-700/70">
                                                <div>
                                                    <h3 className="text-sm sm:text-base font-medium text-white mb-2">Code to Debug</h3>
                                                    <div className="mb-3">
                                                        <label className="block text-xs text-gray-400 mb-1" htmlFor="debug-code-editor-label">Code Editor</label>
                                                        <div id="debug-code-editor-outer" className="bg-gray-900/60 border border-gray-600 rounded-md overflow-hidden focus-within:ring-1 focus-within:ring-indigo-500 focus-within:border-indigo-500 custom-scrollbar-small shadow-sm">
                                                            <Editor
                                                                value={debugCodeText} onValueChange={handleDebugCodeTextChange}
                                                                highlight={code => robustHighlight(code, prismLanguageForPastedCodeEditor)}
                                                                padding={10} textareaClassName="code-editor-textarea !text-xs !font-fira-code" preClassName="code-editor-pre !text-xs !font-fira-code"
                                                                className="min-h-[150px] max-h-[300px] overflow-y-auto !text-gray-200"
                                                                disabled={isLoading} placeholder={`// Paste your broken code here...\n// The AI will find and fix bugs.`}
                                                                aria-label="Debug code input area" aria-labelledby="debug-code-editor-label"
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
                                </div>
                            </div>
                            <div className="mt-auto p-4 sm:p-6 border-t border-gray-700/70">
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
                    
                    {!isLoading && !error && debugResult && currentLanguageForAnalysis && originalInputForAnalysis && (
                        <DebugResultDisplay
                            result={debugResult}
                            originalCode={originalInputForAnalysis}
                            language={currentLanguageForAnalysis}
                        />
                    )}

                    {!isLoading && !error && projectAnalysisResult && currentProjectFiles && currentProjectName && (
                        <ProjectResultDisplay
                            analysis={projectAnalysisResult}
                            files={currentProjectFiles}
                            projectName={currentProjectName}
                            onAnalyzeFile={handleAnalyzeFileFromProject}
                            onUpdateActivity={onUpdateActivity}
                            activity={initialActivity}
                        />
                    )}

                    {/* Welcome / Placeholder Screen */}
                    {!isLoading && !error && !analysisResult && !debugResult && !projectAnalysisResult && (
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
                     {!isLoading && error && error.includes("Critical Setup Error") && !analysisResult && !debugResult && !projectAnalysisResult && (
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
