import React, { useState, useCallback, useEffect, useRef, Suspense, lazy } from 'react';
import Editor from 'react-simple-code-editor';
declare var Prism: any;

import { FileUpload } from '../components/FileUpload';
import { ImageUpload } from '../components/ImageUpload';
import { LoadingSpinner } from '../components/LoadingSpinner';
import { ErrorMessage } from '../components/ErrorMessage';
import { FileContentViewer } from '../components/FileContentViewer';
import { SettingsPanel } from '../components/SettingsPanel';
import { FullScreenCodeModal } from '../components/FullScreenCodeModal';
import { ProjectUpload } from '../components/ProjectUpload';
import { useGlobalSettings } from '../hooks/useGlobalSettings';
import { 
    analyzeCodeWithGemini, 
    analyzeConceptWithGemini, 
    debugCodeWithGemini, 
    analyzeProjectWithGemini, 
    extractCodeFromImageWithGemini, 
    GeminiRequestConfig
} from '../services/geminiService';
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
    ProjectAnalysis,
    ProjectFile,
    AiModel
} from '../types';
import { getPrismLanguageString } from '../components/CodeBlock';

const ResultDisplay = lazy(() => import('../components/ResultDisplay').then(module => ({ default: module.ResultDisplay })));
const DebugResultDisplay = lazy(() => import('../components/DebugResultDisplay').then(module => ({ default: module.DebugResultDisplay })));
const ProjectResultDisplay = lazy(() => import('../components/ProjectResultDisplay').then(module => ({ default: module.ProjectResultDisplay })));


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
    const [currentGeminiConfig, setCurrentGeminiConfig] = useState<GeminiRequestConfig | null>(null);

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
        setDifficultyForCurrentAnalysis(preferredInitialDifficulty);
        setPracticeDifficultyForCurrentAnalysis(defaultPracticeDifficulty);
        setOriginalInputForAnalysis("");
        setCurrentGeminiConfig(null);
        if (forNewSession) {
            if (apiKeyMissing) {
                setError("Critical Setup Error: The API_KEY environment variable is missing. AI functionalities are disabled.");
            } else {
                setError(null);
            }
        }
    }, [preferredInitialDifficulty, defaultPracticeDifficulty, apiKeyMissing]);

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
            setError(errMsg);
        }
    }, []);
    
    const resolveModelForRequest = (
        mode: InputMode,
        preferredModelSetting: AiModel,
        codeLength: number = 0
    ): 'gemini-2.5-flash' | 'gemini-2.5-pro' => {
        if (preferredModelSetting !== 'auto') {
            return preferredModelSetting;
        }

        // For larger code inputs, automatically upgrade to the Pro model to avoid timeouts
        if (codeLength > 50 && (mode === 'fileUpload' || mode === 'pasteCode' || mode === 'debugCode' || mode === 'imageUpload')) {
            return 'gemini-2.5-pro';
        }
        
        switch (mode) {
            case 'projectUpload':
            case 'debugCode':
            case 'conceptTyping':
            case 'imageUpload':
                return 'gemini-2.5-pro';
            case 'fileUpload':
            case 'pasteCode':
            default:
                return 'gemini-2.5-flash';
        }
    };

    const geminiConfigForProjectFiles: GeminiRequestConfig = {
        model: resolveModelForRequest('fileUpload', preferredModel),
        temperature,
        topP,
        systemInstruction: customSystemInstruction,
    };

    useEffect(() => {
        const performInitialAnalysis = async (input: string, lang: SupportedLanguage, type: ActivityItem['type'], title: string, difficultyToUse: ExampleDifficulty, practiceDifficultyToUse: ExampleDifficulty) => {
            setIsLoading(true); setError(null); setAnalysisResult(null); setDebugResult(null); setProjectAnalysisResult(null);
            setOriginalInputForAnalysis(input);
            setCurrentLanguageForAnalysis(lang);
            setDifficultyForCurrentAnalysis(difficultyToUse);
            setPracticeDifficultyForCurrentAnalysis(practiceDifficultyToUse);
            
            const codeLineCount = input.split('\n').length;
            const modeForRequest = getInitialInputMode({type} as ActivityItem);
            const modelToUse = resolveModelForRequest(modeForRequest, preferredModel, codeLineCount);
            const requestConfig: GeminiRequestConfig = { model: modelToUse, temperature, topP, systemInstruction: customSystemInstruction };
            setCurrentGeminiConfig(requestConfig);

            try {
                // FIX: Use separate variables for different result types to help TypeScript's type inference.
                let result: AnalysisResult | DebugResult;
                let finalLang = lang;
                
                if (type === 'debug_analysis') {
                    const debugRes = await debugCodeWithGemini(input, lang, requestConfig);
                    result = debugRes;
                    if (result.detectedLanguage && result.detectedLanguage !== LangEnum.UNKNOWN) finalLang = result.detectedLanguage;
                    setDebugResult(debugRes);
                } else if ((type === 'file_analysis' || type === 'paste_analysis' || type === 'image_analysis')) {
                    const analysisRes = await analyzeCodeWithGemini(input, lang, difficultyToUse, practiceDifficultyToUse, requestConfig);
                    result = analysisRes;
                    if (result.detectedLanguage && result.detectedLanguage !== LangEnum.UNKNOWN) finalLang = result.detectedLanguage;
                    setAnalysisResult(analysisRes);
                } else if (type === 'concept_explanation') {
                    const analysisRes = await analyzeConceptWithGemini(input, lang, difficultyToUse, practiceDifficultyToUse, requestConfig);
                    result = analysisRes;
                    setAnalysisResult(analysisRes);
                } else {
                    throw new Error("Unsupported activity type for initial analysis.");
                }
                setCurrentLanguageForAnalysis(finalLang);
                
                if (initialActivity && !initialActivity.analysisResult && !initialActivity.debugResult) {
                    onUpdateActivity({
                        ...initialActivity,
                        summary: type === 'debug_analysis' 
                            ? (result as DebugResult).summary.substring(0, 70) + '...'
                            : (result as AnalysisResult).topicExplanation?.coreConcepts.explanation.substring(0, 70) + '...',
                        language: finalLang,
                        analysisResult: type !== 'debug_analysis' ? (result as AnalysisResult) : null,
                        debugResult: type === 'debug_analysis' ? (result as DebugResult) : null,
                    });
                }
            } catch (err) {
                setError(err instanceof Error ? err.message : "An unexpected error occurred during initial analysis.");
            } finally {
                setIsLoading(false);
            }
        };
        
        const performInitialImageExtractionAndAnalysis = async (activity: ActivityItem) => {
            setIsLoading(true); setError(null); setAnalysisResult(null);
            
            // The model for extraction and initial analysis will be determined later.
            // For now, let's just create a base config.
            const baseRequestConfig: Omit<GeminiRequestConfig, 'model'> = { temperature, topP, systemInstruction: customSystemInstruction };

            try {
                if (!activity.originalImage) throw new Error("Image data is missing from the activity.");
                const res = await fetch(activity.originalImage);
                const blob = await res.blob();
                const imageFile = new File([blob], activity.title, { type: blob.type });

                // Use Pro model for extraction as it's a more complex task
                const extractionConfig: GeminiRequestConfig = { ...baseRequestConfig, model: resolveModelForRequest('imageUpload', preferredModel) };
                const extractedCode = await extractCodeFromImageWithGemini(imageFile, extractionConfig);

                // Now determine model for analysis based on extracted code length
                const codeLineCount = extractedCode.split('\n').length;
                const analysisModel = resolveModelForRequest('imageUpload', preferredModel, codeLineCount);
                const analysisConfig: GeminiRequestConfig = { ...baseRequestConfig, model: analysisModel };

                setCurrentGeminiConfig(analysisConfig);

                const result = await analyzeCodeWithGemini(extractedCode, LangEnum.UNKNOWN, activity.analysisDifficulty || preferredInitialDifficulty, defaultPracticeDifficulty, analysisConfig);
                const finalLang = result.detectedLanguage || LangEnum.UNKNOWN;
                
                setAnalysisResult(result);
                setCurrentLanguageForAnalysis(finalLang);
                setOriginalInputForAnalysis(extractedCode);

                onUpdateActivity({
                    ...activity,
                    originalInput: extractedCode,
                    analysisResult: result,
                    language: finalLang,
                    summary: result.topicExplanation?.coreConcepts.explanation.substring(0, 70) + '...'
                });
            } catch(err) {
                setError(err instanceof Error ? err.message : "An unexpected error occurred during image processing.");
            } finally {
                setIsLoading(false);
            }
        };

        const performInitialProjectAnalysis = async (files: ProjectFile[], name: string, activity: ActivityItem) => {
             setIsLoading(true); setError(null); setProjectAnalysisResult(null);
             setCurrentProjectFiles(files); setCurrentProjectName(name);
             const modelToUse = resolveModelForRequest('projectUpload', preferredModel);
             const requestConfig: GeminiRequestConfig = { model: modelToUse, temperature, topP, systemInstruction: customSystemInstruction };

             try {
                const result = await analyzeProjectWithGemini(files, name, requestConfig);
                setProjectAnalysisResult(result);
                onUpdateActivity({ ...activity, projectAnalysis: result, summary: result.overview.substring(0, 70) + '...' });
             } catch(err) {
                setError(err instanceof Error ? err.message : "An unexpected error occurred during project analysis.");
             } finally {
                setIsLoading(false);
             }
        };

        if (initialActivity) {
            const modeToSet = getInitialInputMode(initialActivity);
            setInputMode(modeToSet);

            if (modeToSet === 'fileUpload' && initialActivity.originalInput) {
                const mockFile = new File([initialActivity.originalInput], initialActivity.title, { type: "text/plain" });
                setSelectedFile(mockFile); setCodeContent(initialActivity.originalInput); setFileLanguage(initialActivity.language || null);
            } else if (modeToSet === 'imageUpload' && initialActivity.originalImage) {
                setImagePreviewUrl(initialActivity.originalImage);
            } else if (modeToSet === 'projectUpload' && initialActivity.projectFiles) {
                setCurrentProjectFiles(initialActivity.projectFiles); setCurrentProjectName(initialActivity.title);
            } else if (modeToSet === 'conceptTyping') {
                setConceptText(initialActivity.originalInput || ''); setConceptLanguage(initialActivity.language || LangEnum.PYTHON);
            } else if (modeToSet === 'pasteCode') {
                setPastedCodeText(initialActivity.originalInput || '');
            } else if (modeToSet === 'debugCode') {
                setDebugCodeText(initialActivity.originalInput || '');
            }
            
            if (initialActivity.analysisResult) { 
                setAnalysisResult(initialActivity.analysisResult); setDebugResult(null); setProjectAnalysisResult(null);
                setCurrentLanguageForAnalysis(initialActivity.language || null); setOriginalInputForAnalysis(initialActivity.originalInput || "");
                const codeLineCount = initialActivity.originalInput?.split('\n').length || 0;
                const modeForRequest = getInitialInputMode(initialActivity);
                const modelToUse = resolveModelForRequest(modeForRequest, preferredModel, codeLineCount);
                const requestConfig: GeminiRequestConfig = { model: modelToUse, temperature, topP, systemInstruction: customSystemInstruction };
                setCurrentGeminiConfig(requestConfig);
            } else if (initialActivity.debugResult) {
                setDebugResult(initialActivity.debugResult); setAnalysisResult(null); setProjectAnalysisResult(null);
                setCurrentLanguageForAnalysis(initialActivity.language || null); setOriginalInputForAnalysis(initialActivity.originalInput || "");
            } else if (initialActivity.projectAnalysis) {
                setProjectAnalysisResult(initialActivity.projectAnalysis);
                setCurrentProjectFiles(initialActivity.projectFiles || null); setCurrentProjectName(initialActivity.title);
            } else if (apiKeyMissing) {
                setError("Critical Setup Error: API_KEY missing. Cannot perform analysis.");
            } else if (analysisStartedForId.current !== initialActivity.id) {
                analysisStartedForId.current = initialActivity.id;
                if (initialActivity.type === 'image_analysis' && initialActivity.originalImage) {
                    performInitialImageExtractionAndAnalysis(initialActivity);
                } else if (initialActivity.type === 'project_analysis' && initialActivity.projectFiles) {
                    performInitialProjectAnalysis(initialActivity.projectFiles, initialActivity.title, initialActivity);
                } else if (initialActivity.originalInput) {
                    performInitialAnalysis(initialActivity.originalInput, initialActivity.language || LangEnum.UNKNOWN, initialActivity.type, initialActivity.title, initialActivity.analysisDifficulty || preferredInitialDifficulty, defaultPracticeDifficulty);
                }
            }
        } else { 
            analysisStartedForId.current = null;
            resetAnalysisState(true); 
            setInputMode('projectUpload');
        }
    }, [initialActivity, onUpdateActivity, resetAnalysisState]);


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
        const reader = new FileReader();
        reader.onload = (e) => {
            const content = e.target?.result as string;
            setCodeContent(content);
            const extension = file.name.substring(file.name.lastIndexOf('.')).toLowerCase();
            const detectedLang = LanguageExtensions[extension] || LangEnum.UNKNOWN;
            setFileLanguage(detectedLang);
            if (detectedLang === LangEnum.UNKNOWN) setError(`Unsupported file type: ${extension}. Please select a language manually.`);
            else if (!apiKeyMissing) setError(null); 
        };
        reader.onerror = () => setError("Error reading file.");
        reader.readAsText(file);
    }, [resetAnalysisState, apiKeyMissing]);

    const handleImageSelect = useCallback((file: File) => {
        setSelectedImageFile(file);
        resetAnalysisState(false);
        if (imagePreviewUrl) URL.revokeObjectURL(imagePreviewUrl);
        setImagePreviewUrl(URL.createObjectURL(file));
        if (!apiKeyMissing) setError(null);
    }, [resetAnalysisState, apiKeyMissing, imagePreviewUrl]);

    const handleProjectFilesSelected = async (files: FileList) => {
        if (!files || files.length === 0) { setCurrentProjectFiles(null); setCurrentProjectName(null); return; }
        setIsLoading(true);
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
            if (file.size > 2 * 1024 * 1024 || file.name.startsWith('.') || /\/(.git|node_modules|dist|build)\//.test(file.webkitRelativePath)) continue;
            try {
                const isBinary = await new Promise<boolean>(resolve => {
                    const reader = new FileReader();
                    reader.onload = (e) => resolve((e.target?.result as string).includes('\u0000'));
                    reader.onerror = () => resolve(true);
                    reader.readAsText(file.slice(0, 1024));
                });
                if (!isBinary) fileContents.push({ path: file.webkitRelativePath, content: await file.text() });
            } catch (e) { console.error(`Could not read file ${file.webkitRelativePath}:`, e); }
        }
        setCurrentProjectFiles(fileContents);
        setCurrentProjectName(finalProjectName);
        setIsLoading(false);
        if(fileContents.length > 0) { if (error && !apiKeyMissing) setError(null); }
        else { setCurrentProjectFiles(null); setCurrentProjectName(null); }
    };

    const handleFileLanguageChange = useCallback((newLanguage: SupportedLanguage) => {
        setFileLanguage(newLanguage);
        if (error?.startsWith("Unsupported file type") && !apiKeyMissing && newLanguage !== LangEnum.UNKNOWN) setError(null);
    }, [error, apiKeyMissing]);

    const handleConceptTextChange = (event: React.ChangeEvent<HTMLInputElement>) => setConceptText(event.target.value);
    const handleConceptLanguageChange = (event: React.ChangeEvent<HTMLSelectElement>) => setConceptLanguage(event.target.value as SupportedLanguage);
    const handlePastedCodeTextChange = (code: string) => setPastedCodeText(code);
    const handleDebugCodeTextChange = (code: string) => setDebugCodeText(code);

    const handleSubmit = async () => {
        if (apiKeyMissing) { setError("Action Required: API_KEY is not configured."); return; }
        setError(null); setAnalysisResult(null); setDebugResult(null); setProjectAnalysisResult(null);
        setIsLoading(true);

        let submittedOriginalInput = "";
        let activityType: ActivityType = 'file_analysis';
        let activityTitle = "";
        let activityIcon = 'description';
        let activityColor = 'text-[var(--accent-primary)]';
        let currentLang: SupportedLanguage | null = null;
        let summary = "";
        let codeLineCount = 0;

        // Determine input and line count first
        if (inputMode === 'fileUpload' && codeContent) submittedOriginalInput = codeContent;
        else if (inputMode === 'pasteCode') submittedOriginalInput = pastedCodeText;
        else if (inputMode === 'debugCode') submittedOriginalInput = debugCodeText;
        else if (inputMode === 'conceptTyping') submittedOriginalInput = conceptText;
        else if (inputMode === 'projectUpload' && currentProjectName) submittedOriginalInput = currentProjectName;
        else if (inputMode === 'imageUpload' && selectedImageFile) submittedOriginalInput = selectedImageFile.name; // Placeholder, real code comes later
        
        if (inputMode !== 'projectUpload' && inputMode !== 'conceptTyping') {
            codeLineCount = submittedOriginalInput.split('\n').length;
        }

        const modelToUse = resolveModelForRequest(inputMode, preferredModel, codeLineCount);
        const requestConfig: GeminiRequestConfig = { model: modelToUse, temperature, topP, systemInstruction: customSystemInstruction };
        setCurrentGeminiConfig(requestConfig);

        try {
            if (inputMode === 'debugCode' || inputMode === 'projectUpload') {
                let result: DebugResult | ProjectAnalysis;
                if (inputMode === 'debugCode') {
                    if (!debugCodeText.trim()) throw new Error("Please paste your code to be debugged.");
                    result = await debugCodeWithGemini(debugCodeText, LangEnum.UNKNOWN, requestConfig);
                    setDebugResult(result);
                    currentLang = (result.detectedLanguage && result.detectedLanguage !== LangEnum.UNKNOWN) ? result.detectedLanguage : LangEnum.UNKNOWN;
                    activityType = 'debug_analysis'; activityTitle = `Debug: ${debugCodeText.substring(0, 30)}...`;
                    activityIcon = 'bug_report'; activityColor = 'text-red-500'; summary = result.summary;
                } else { // projectUpload
                    if (!currentProjectFiles || !currentProjectName) throw new Error("Please select a project folder.");
                    result = await analyzeProjectWithGemini(currentProjectFiles, currentProjectName, requestConfig);
                    setProjectAnalysisResult(result);
                    activityType = 'project_analysis'; activityTitle = `Project: ${currentProjectName}`;
                    activityIcon = 'folder_zip'; activityColor = 'text-purple-400'; summary = result.overview;
                }
                setCurrentLanguageForAnalysis(currentLang); setOriginalInputForAnalysis(submittedOriginalInput);
                onUpdateActivity({
                    id: Date.now().toString(), type: activityType, title: activityTitle, timestamp: new Date(),
                    summary: `${summary.substring(0, 70)}...`, icon: activityIcon, colorClass: activityColor,
                    language: currentLang || undefined,
                    originalInput: (activityType !== 'project_analysis') ? submittedOriginalInput : undefined,
                    debugResult: activityType === 'debug_analysis' ? (result as DebugResult) : null,
                    projectFiles: activityType === 'project_analysis' ? currentProjectFiles : undefined,
                    projectAnalysis: activityType === 'project_analysis' ? (result as ProjectAnalysis) : null,
                });
            } else {
                let initialAnalysisResult: AnalysisResult;
                let originalImage: string | undefined;
                if (inputMode === 'imageUpload') {
                    if (!selectedImageFile) throw new Error("Please select an image file.");
                    
                    // Use Pro for extraction
                    const extractionConfig = { ...requestConfig, model: resolveModelForRequest('imageUpload', preferredModel) };
                    const extractedCode = await extractCodeFromImageWithGemini(selectedImageFile, extractionConfig);

                    const extractedCodeLines = extractedCode.split('\n').length;
                    const analysisModel = resolveModelForRequest('imageUpload', preferredModel, extractedCodeLines);
                    const analysisConfig = { ...requestConfig, model: analysisModel };

                    initialAnalysisResult = await analyzeCodeWithGemini(extractedCode, LangEnum.UNKNOWN, preferredInitialDifficulty, defaultPracticeDifficulty, analysisConfig);
                    submittedOriginalInput = extractedCode; currentLang = LangEnum.UNKNOWN;
                    activityType = 'image_analysis'; activityTitle = selectedImageFile.name;
                    activityIcon = 'image_search'; activityColor = 'text-cyan-400';
                    originalImage = imagePreviewUrl || undefined;
                } else if (inputMode === 'fileUpload') {
                    if (!codeContent || !fileLanguage || fileLanguage === LangEnum.UNKNOWN || !selectedFile) throw new Error("Please select a valid code file.");
                    initialAnalysisResult = await analyzeCodeWithGemini(codeContent, fileLanguage, preferredInitialDifficulty, defaultPracticeDifficulty, requestConfig);
                    submittedOriginalInput = codeContent; currentLang = fileLanguage;
                    activityType = 'file_analysis'; activityTitle = selectedFile.name;
                } else if (inputMode === 'conceptTyping') {
                    if (!conceptText.trim() || !conceptLanguage) throw new Error("Please enter a concept and select a language.");
                    initialAnalysisResult = await analyzeConceptWithGemini(conceptText, conceptLanguage, preferredInitialDifficulty, defaultPracticeDifficulty, requestConfig);
                    submittedOriginalInput = conceptText; currentLang = conceptLanguage;
                    activityType = 'concept_explanation'; activityTitle = `Concept: ${conceptText.substring(0, 40)}...`;
                    activityIcon = 'lightbulb'; activityColor = 'text-green-500';
                } else if (inputMode === 'pasteCode') {
                    if (!pastedCodeText.trim()) throw new Error("Please paste your code.");
                    initialAnalysisResult = await analyzeCodeWithGemini(pastedCodeText, LangEnum.UNKNOWN, preferredInitialDifficulty, defaultPracticeDifficulty, requestConfig);
                    submittedOriginalInput = pastedCodeText; currentLang = LangEnum.UNKNOWN;
                    activityType = 'paste_analysis'; activityTitle = `Pasted Code: ${pastedCodeText.substring(0, 30)}...`;
                    activityIcon = 'content_paste_search'; activityColor = 'text-yellow-500';
                } else {
                    throw new Error("Invalid submission mode.");
                }
                const finalLang = (initialAnalysisResult.detectedLanguage && initialAnalysisResult.detectedLanguage !== LangEnum.UNKNOWN) ? initialAnalysisResult.detectedLanguage : currentLang;
                setAnalysisResult(initialAnalysisResult);
                setCurrentLanguageForAnalysis(finalLang);
                setOriginalInputForAnalysis(submittedOriginalInput);
                summary = initialAnalysisResult.topicExplanation?.coreConcepts.explanation.substring(0, 70) + '...' || 'Analysis complete.';
                onUpdateActivity({
                    id: Date.now().toString(), type: activityType, title: activityTitle, timestamp: new Date(),
                    summary, icon: activityIcon, colorClass: activityColor,
                    language: finalLang || undefined, originalInput: submittedOriginalInput, originalImage,
                    analysisResult: initialAnalysisResult, analysisDifficulty: preferredInitialDifficulty,
                });
            }
        } catch (err) {
            setError(err instanceof Error ? err.message : "An unexpected error occurred during analysis.");
        } finally {
            setIsLoading(false);
        }
    };

    const handleOpenFullScreenCodeModal = (content: string, lang: SupportedLanguage) => {
        setFullScreenCodeContent(content); setFullScreenCodeLanguage(lang); setIsFullScreenCodeModalOpen(true);
    };

    const handleCloseFullScreenCodeModal = () => setIsFullScreenCodeModalOpen(false);

    const isAnalyzeButtonDisabled = isLoading || apiKeyMissing ||
        (inputMode === 'fileUpload' && (!selectedFile || !fileLanguage || fileLanguage === LangEnum.UNKNOWN || !codeContent)) ||
        (inputMode === 'imageUpload' && !selectedImageFile) ||
        (inputMode === 'conceptTyping' && (!conceptText.trim() || !conceptLanguage || conceptLanguage === LangEnum.UNKNOWN)) ||
        (inputMode === 'pasteCode' && !pastedCodeText.trim()) ||
        (inputMode === 'debugCode' && !debugCodeText.trim()) ||
        (inputMode === 'projectUpload' && !currentProjectFiles);

    let mainSubmitButtonText = 'Analyze Code', loadingText = 'Analyzing...', mainSubmitIcon = 'analytics';
    let currentWelcomeTitle = "Code Analysis & Learning Assistant", currentWelcomeText = "Select an input method to begin.", currentWelcomeIcon = "auto_awesome";
    if (inputMode === 'projectUpload') { mainSubmitButtonText = 'Analyze Project'; loadingText = 'Analyzing Project...'; mainSubmitIcon = 'account_tree'; currentWelcomeTitle = "Analyze a Project"; currentWelcomeIcon = 'folder_zip'; }
    else if (inputMode === 'imageUpload') { mainSubmitButtonText = 'Extract & Analyze Code'; loadingText = 'Processing Image...'; mainSubmitIcon = 'image_search'; currentWelcomeTitle = "Analyze Code from an Image"; currentWelcomeIcon = 'image_search'; }
    else if (inputMode === 'fileUpload') { mainSubmitButtonText = 'Analyze Uploaded Code'; loadingText = 'Analyzing Code...'; mainSubmitIcon = 'analytics'; currentWelcomeTitle = "Upload & Analyze Code"; currentWelcomeIcon = 'upload_file'; }
    else if (inputMode === 'conceptTyping') { mainSubmitButtonText = 'Analyze Concept'; loadingText = 'Analyzing Concept...'; mainSubmitIcon = 'psychology'; currentWelcomeTitle = "Explore Programming Concepts"; currentWelcomeIcon = 'lightbulb'; }
    else if (inputMode === 'pasteCode') { mainSubmitButtonText = 'Analyze Pasted Code'; loadingText = 'Analyzing...'; mainSubmitIcon = 'content_paste_go'; currentWelcomeTitle = "Paste & Analyze Code"; currentWelcomeIcon = 'integration_instructions'; }
    else if (inputMode === 'debugCode') { mainSubmitButtonText = 'Debug My Code'; loadingText = 'Finding Bugs...'; mainSubmitIcon = 'bug_report'; currentWelcomeTitle = "Debug Your Code"; currentWelcomeIcon = 'construction'; }

    const prismLanguageForPastedCodeEditor = getPrismLanguageString(null);
    const robustHighlight = (code: string, lang: string) => (typeof Prism !== 'undefined' && Prism.highlight && code && Prism.languages[lang]) ? Prism.highlight(code, Prism.languages[lang], lang) : escapeHtml(code || '');
    const stickyTopOffset = "md:top-[calc(3.5rem+1.5rem)]", panelHeight = "md:h-[calc(100vh-3.5rem-3rem)]";

    return (
        <div className="flex flex-col min-h-screen bg-[var(--bg-primary)] text-[var(--text-primary)]">
            <header className="py-3 px-4 sm:px-6 flex justify-between items-center sticky top-0 z-50 bg-[var(--bg-primary)]/80 backdrop-blur-md border-b border-[var(--border-color)] h-14">
                <div className="flex items-center gap-3">
                    {onBackToDashboard && ( <button onClick={onBackToDashboard} className="text-[var(--text-secondary)] hover:text-[var(--text-primary)] p-2 rounded-full hover:bg-[var(--bg-tertiary)] transition-colors focus:outline-none focus:ring-2 focus:ring-[var(--accent-primary)] focus:ring-offset-2 focus:ring-offset-[var(--bg-primary)]" aria-label="Back to Dashboard"><span className="material-icons">arrow_back</span></button> )}
                    <div className="flex items-center gap-2">
                        <div className="bg-gradient-to-br from-[var(--accent-primary)] to-sky-500 p-1.5 rounded-lg shadow-md"><span className="material-icons-outlined text-white text-lg sm:text-xl">model_training</span></div>
                        <h1 className="text-lg sm:text-xl font-semibold text-white font-lexend">CodeTutor AI</h1>
                    </div>
                </div>
                <div className="relative">
                    <button ref={settingsButtonRef} onClick={toggleSettingsPanel} className="text-[var(--text-muted)] hover:text-[var(--text-primary)] p-1.5 rounded-full hover:bg-[var(--bg-tertiary)] focus:outline-none focus:ring-2 focus:ring-[var(--accent-primary)] focus:ring-offset-2 focus:ring-offset-[var(--bg-primary)]" aria-label="Open settings" aria-expanded={isSettingsPanelOpen} aria-controls="settings-panel-popover"><span className="material-icons-outlined">settings</span></button>
                    {isSettingsPanelOpen && (<div id="settings-panel-popover" ref={settingsPanelRef} className="absolute top-full right-0 mt-2 z-[60]" role="dialog" aria-modal="true"><SettingsPanel onClearAllActivities={onClearAllActivities} /></div>)}
                </div>
            </header>

            <main className={`flex-grow flex flex-col md:flex-row p-4 sm:p-6 transition-all duration-300 ease-in-out ${isLeftPanelCollapsed ? 'md:gap-4' : 'gap-4 sm:gap-6'}`}>
                 <aside className={`md:flex-shrink-0 bg-[var(--bg-secondary)] rounded-xl shadow-2xl flex flex-col md:sticky ${stickyTopOffset} ${panelHeight} transition-all duration-300 ease-in-out ${isLeftPanelCollapsed ? 'w-full md:w-16 p-3 md:mb-0 mb-4' : 'w-full md:w-[32rem] lg:w-[36rem] md:mb-0 mb-6'}`}>
                    {isLeftPanelCollapsed ? (
                        <div className="flex flex-col items-center justify-center h-full">
                            <button onClick={() => setIsLeftPanelCollapsed(false)} className="flex items-center justify-center w-10 h-10 text-[var(--text-secondary)] hover:text-white bg-[var(--bg-tertiary)] hover:bg-[var(--accent-primary)] rounded-full transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-[var(--accent-primary)] focus:ring-offset-2 focus:ring-offset-[var(--bg-secondary)] animate-pulse" aria-label="Expand input panel" title="Expand Panel"><span className="material-icons-outlined transition-transform duration-300 ease-in-out rotate-180">menu_open</span></button>
                        </div>
                    ) : (
                        <>
                            <div className="flex-grow overflow-y-auto custom-scrollbar-small"><div className="p-4 sm:p-6"><div className="space-y-5">
                                <div>
                                    <div className="flex justify-between items-center mb-2">
                                        <h2 className="text-sm sm:text-base font-semibold text-[var(--text-primary)]">Input Method</h2>
                                        <button onClick={() => setIsLeftPanelCollapsed(true)} className="hidden md:flex items-center justify-center text-[var(--text-muted)] hover:text-[var(--text-primary)] p-1 rounded-full hover:bg-[var(--bg-tertiary)] transition-colors focus:outline-none focus:ring-2 focus:ring-[var(--accent-primary)] focus:ring-offset-2 focus:ring-offset-[var(--bg-secondary)]" aria-label="Collapse input panel" title="Collapse Panel"><span className="material-icons-outlined">menu_open</span></button>
                                    </div>
                                    <div className="grid grid-cols-3 gap-2">
                                        {(['projectUpload', 'fileUpload', 'imageUpload', 'conceptTyping', 'pasteCode', 'debugCode'] as InputMode[]).map(mode => {
                                            let icon = 'description', label = 'File';
                                            if (mode === 'projectUpload') { icon = 'folder_zip'; label = 'Project'; } else if (mode === 'imageUpload') { icon = 'image_search'; label = 'Image'; } else if (mode === 'conceptTyping') { icon = 'lightbulb'; label = 'Concept'; } else if (mode === 'pasteCode') { icon = 'content_paste'; label = 'Paste'; } else if (mode === 'debugCode') { icon = 'bug_report'; label = 'Debug'; }
                                            const btnClasses = `py-2 px-3 rounded-lg flex items-center justify-center gap-x-2 transition-colors text-sm font-medium focus:outline-none focus:ring-2 focus:ring-offset-1 focus:ring-offset-[var(--bg-secondary)] focus:ring-[var(--accent-primary)] ${inputMode === mode ? 'bg-[var(--accent-primary)] hover:bg-[var(--accent-primary-hover)] text-white' : 'bg-[var(--bg-tertiary)] hover:bg-[var(--border-color)] text-[var(--text-secondary)]'}`;
                                            return <button key={mode} onClick={() => handleInputModeChange(mode)} className={btnClasses} disabled={isLoading}><span className="material-icons-outlined text-lg">{icon}</span><span>{label}</span></button>;
                                        })}
                                    </div>
                                </div>
                                {inputMode === 'projectUpload' && <ProjectUpload onProjectFilesSelected={handleProjectFilesSelected} projectName={currentProjectName} fileCount={currentProjectFiles?.length || 0} isLoading={isLoading} />}
                                {inputMode === 'fileUpload' && <FileUpload onFileSelect={handleFileSelect} selectedFile={selectedFile} selectedLanguage={fileLanguage} onLanguageChange={handleFileLanguageChange} onSubmit={handleSubmit} isLoading={isLoading} />}
                                {inputMode === 'imageUpload' && <ImageUpload onFileSelect={handleImageSelect} selectedFile={selectedImageFile} previewUrl={imagePreviewUrl} isLoading={isLoading} />}
                                {inputMode === 'conceptTyping' && (<div className="space-y-3 pt-3 border-t border-[var(--border-color)]"><div><h3 className="text-sm sm:text-base font-medium text-[var(--text-primary)] mb-2">Define Your Concept</h3><div className="mb-3"><label className="block text-xs text-[var(--text-muted)] mb-1" htmlFor="programming-concept">Programming Concept</label><input className="w-full bg-[var(--bg-tertiary)] border border-[var(--border-color)] text-[var(--text-primary)] rounded-md p-2.5 text-sm focus:ring-1 focus:ring-[var(--accent-primary)] focus:border-[var(--accent-primary)] placeholder-[var(--text-muted)]" id="programming-concept" placeholder="e.g., Linked List, Python Decorators" type="text" value={conceptText} onChange={handleConceptTextChange} disabled={isLoading} /></div><div><label className="block text-xs text-[var(--text-muted)] mb-1" htmlFor="language-context">Language Context</label><select className="w-full bg-[var(--bg-tertiary)] border border-[var(--border-color)] text-[var(--text-primary)] rounded-md p-2.5 text-sm focus:ring-1 focus:ring-[var(--accent-primary)] focus:border-[var(--accent-primary)] appearance-none bg-no-repeat bg-right-2.5" id="language-context" style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 20 20' fill='%239ca3af'%3E%3Cpath fill-rule='evenodd' d='M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z' clip-rule='evenodd' /%3E%3C/svg%3E")`, backgroundSize: '1.25em' }} value={conceptLanguage || ''} onChange={handleConceptLanguageChange} disabled={isLoading}><option value="" disabled={!!conceptLanguage}>Select language...</option>{languageOptions.map(opt => (<option key={opt.value} value={opt.value}>{opt.label}</option>))}</select></div></div></div>)}
                                {inputMode === 'pasteCode' && (<div className="space-y-3 pt-3 border-t border-[var(--border-color)]"><div><h3 className="text-sm sm:text-base font-medium text-[var(--text-primary)] mb-2">Paste Your Code</h3><div className="mb-3"><label className="block text-xs text-[var(--text-muted)] mb-1" htmlFor="pasted-code-editor-label">Code Editor</label><div id="pasted-code-editor-outer" className="bg-[var(--bg-primary)]/60 border border-[var(--border-color)] rounded-md focus-within:ring-1 focus-within:ring-[var(--accent-primary)] shadow-sm"><Editor value={pastedCodeText} onValueChange={handlePastedCodeTextChange} highlight={code => robustHighlight(code, prismLanguageForPastedCodeEditor)} padding={10} textareaClassName="code-editor-textarea !text-xs !font-fira-code" preClassName="code-editor-pre !text-xs !font-fira-code" className="min-h-[150px] max-h-[300px] overflow-y-auto !text-[var(--text-primary)] custom-scrollbar-small" disabled={isLoading} placeholder={`// Paste code... Language auto-detected.`} /></div></div></div></div>)}
                                {inputMode === 'debugCode' && (<div className="space-y-3 pt-3 border-t border-[var(--border-color)]"><div><h3 className="text-sm sm:text-base font-medium text-[var(--text-primary)] mb-2">Code to Debug</h3><div className="mb-3"><label className="block text-xs text-[var(--text-muted)] mb-1" htmlFor="debug-code-editor-label">Code Editor</label><div id="debug-code-editor-outer" className="bg-[var(--bg-primary)]/60 border border-[var(--border-color)] rounded-md focus-within:ring-1 focus-within:ring-[var(--accent-primary)] shadow-sm"><Editor value={debugCodeText} onValueChange={handleDebugCodeTextChange} highlight={code => robustHighlight(code, prismLanguageForPastedCodeEditor)} padding={10} textareaClassName="code-editor-textarea !text-xs !font-fira-code" preClassName="code-editor-pre !text-xs !font-fira-code" className="min-h-[150px] max-h-[300px] overflow-y-auto !text-[var(--text-primary)] custom-scrollbar-small" disabled={isLoading} placeholder={`// Paste broken code...`} /></div></div></div></div>)}
                                {(inputMode === 'fileUpload' && codeContent && fileLanguage && fileLanguage !== LangEnum.UNKNOWN && !isLoading) && (<div className="pt-3 border-t border-[var(--border-color)] overflow-y-auto custom-scrollbar-small min-h-0"><FileContentViewer codeContent={codeContent} language={fileLanguage} title={`Your Uploaded ${LanguageDisplayNames[fileLanguage] || 'Code'}`} onViewFull={() => handleOpenFullScreenCodeModal(codeContent, fileLanguage)} /></div>)}
                                {(inputMode === 'pasteCode' && pastedCodeText && !isLoading) && (<div className="pt-3 border-t border-[var(--border-color)] overflow-y-auto custom-scrollbar-small min-h-0"><FileContentViewer codeContent={pastedCodeText} language={LangEnum.UNKNOWN} title="Your Pasted Code" onViewFull={() => handleOpenFullScreenCodeModal(pastedCodeText, LangEnum.UNKNOWN)} /></div>)}
                            </div></div></div>
                            <div className="mt-auto p-4 sm:p-6 border-t border-[var(--border-color)]"><button type="button" onClick={handleSubmit} disabled={isAnalyzeButtonDisabled} className="btn-primary w-full text-sm shadow-md">{isLoading ? (<div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>) : (<span className="material-icons-outlined text-xl">{mainSubmitIcon}</span>)}<span className="ml-2">{isLoading ? loadingText : mainSubmitButtonText}</span></button></div>
                        </>
                    )}
                 </aside>

                <section className={`flex-grow bg-[var(--bg-secondary)] rounded-xl shadow-2xl p-6 flex flex-col ${panelHeight} md:overflow-y-auto custom-scrollbar-small`}>
                    {isLoading && ( <LoadingSpinner loadingText={loadingText} /> )}
                    {!isLoading && error && <ErrorMessage message={error} />}
                    <Suspense fallback={<LoadingSpinner loadingText="Loading results view..." />}>
                        {!isLoading && !error && analysisResult && currentLanguageForAnalysis && originalInputForAnalysis && currentGeminiConfig && (
                            <ResultDisplay
                                result={analysisResult}
                                language={currentLanguageForAnalysis}
                                difficultyOfProvidedExample={difficultyForCurrentAnalysis}
                                initialPracticeDifficulty={practiceDifficultyForCurrentAnalysis}
                                originalInputContext={originalInputForAnalysis}
                                originalInputType={inputMode === 'conceptTyping' ? 'concept' : 'code'}
                                geminiConfig={currentGeminiConfig}
                            />
                        )}
                        {!isLoading && !error && debugResult && currentLanguageForAnalysis && originalInputForAnalysis && <DebugResultDisplay result={debugResult} originalCode={originalInputForAnalysis} language={currentLanguageForAnalysis} />}
                        {!isLoading && !error && projectAnalysisResult && currentProjectFiles && currentProjectName && <ProjectResultDisplay analysis={projectAnalysisResult} files={currentProjectFiles} projectName={currentProjectName} onUpdateActivity={onUpdateActivity} activity={initialActivity} geminiConfigForFiles={geminiConfigForProjectFiles} />}
                    </Suspense>
                    {!isLoading && !error && !analysisResult && !debugResult && !projectAnalysisResult && (
                         <div className="flex-grow flex flex-col items-center justify-center text-center p-4">
                            <div className="bg-[var(--accent-primary)]/20 p-4 sm:p-5 rounded-full mb-4 sm:mb-6 shadow-lg border border-[var(--accent-primary)]/40"><span className="material-icons-outlined text-[var(--accent-primary)] text-4xl sm:text-5xl">{currentWelcomeIcon}</span></div>
                            <h2 className="text-xl sm:text-2xl font-semibold text-[var(--text-primary)] mb-2 sm:mb-3 font-lexend">{currentWelcomeTitle}</h2>
                         </div>
                    )}
                </section>
            </main>
             <FullScreenCodeModal isOpen={isFullScreenCodeModalOpen} code={fullScreenCodeContent} language={fullScreenCodeLanguage} onClose={handleCloseFullScreenCodeModal} />
        </div>
    );
};
export const HomePage = React.memo(HomePageInternal);