import React, { useState, useCallback, useRef, useEffect } from 'react';
import toast from 'react-hot-toast';
import { SettingsPanel } from '../components/SettingsPanel';
import { AllActivityModal } from '../components/AllActivityModal'; 
import { DetailedReportModal } from '../components/DetailedReportModal';
import { ActivityItem, ActivityType, SupportedLanguage, ProjectFile, LanguageExtensions, AcceptedFileExtensions } from '../types'; 

interface DashboardPageProps {
    activities: ActivityItem[];
    onViewActivityDetail: (activity: ActivityItem) => void;
    onUpdateActivity: (activity: ActivityItem) => void;
    onClearAllActivities: () => void;
}

type InputType = 'file' | 'concept' | 'paste' | 'debug' | 'project';

const formatSimpleTimestamp = (date: Date): string => {
    const now = new Date();
    const diffSeconds = Math.round((now.getTime() - date.getTime()) / 1000);
    const diffMinutes = Math.round(diffSeconds / 60);
    const diffHours = Math.round(diffMinutes / 60);

    if (diffMinutes < 1) return `Just now`;
    if (diffMinutes < 60) return `${diffMinutes}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
};

export const DashboardPage: React.FC<DashboardPageProps> = ({ activities, onViewActivityDetail, onUpdateActivity, onClearAllActivities }) => {
    const [activeInputType, setActiveInputType] = useState<InputType>('file');
    const [selectedFileName, setSelectedFileName] = useState<string | null>(null);
    const [fileContentForAnalysis, setFileContentForAnalysis] = useState<string | null>(null);
    const [pastedCode, setPastedCode] = useState<string>('');
    const [conceptDescription, setConceptDescription] = useState<string>('');
    const [debugCode, setDebugCode] = useState<string>('');
    const [projectFiles, setProjectFiles] = useState<ProjectFile[] | null>(null);
    const [projectName, setProjectName] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState<boolean>(false);

    const [isSettingsPanelOpen, setIsSettingsPanelOpen] = useState(false);
    const settingsPanelRef = useRef<HTMLDivElement>(null);
    const settingsButtonRef = useRef<HTMLButtonElement>(null);

    const [isAllActivityModalOpen, setIsAllActivityModalOpen] = useState<boolean>(false);
    const [isReportModalOpen, setIsReportModalOpen] = useState<boolean>(false);
    
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

    const handleInputTypeChange = (type: InputType) => {
        setActiveInputType(type);
        setSelectedFileName(null); 
        setFileContentForAnalysis(null);
        setPastedCode('');
        setConceptDescription('');
        setDebugCode('');
        setProjectFiles(null);
        setProjectName(null);
    };

    const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        if (event.target.files && event.target.files[0]) {
            const file = event.target.files[0];
            setSelectedFileName(file.name);
            const reader = new FileReader();
            reader.onload = (e) => setFileContentForAnalysis(e.target?.result as string);
            reader.readAsText(file);
            toast.success(`File "${file.name}" selected.`);
        } else {
            setSelectedFileName(null);
            setFileContentForAnalysis(null);
        }
    };
    
    const handleDrop = (event: React.DragEvent<HTMLDivElement>) => {
        event.preventDefault(); event.stopPropagation();
        const dropZone = event.currentTarget;
        dropZone.classList.remove('border-[var(--accent-primary)]', 'bg-opacity-10', 'bg-[var(--accent-primary)]');
        if (event.dataTransfer.files && event.dataTransfer.files[0]) {
            const file = event.dataTransfer.files[0];
            setSelectedFileName(file.name);
            const reader = new FileReader();
            reader.onload = (e) => setFileContentForAnalysis(e.target?.result as string);
            reader.readAsText(file);
            toast.success(`File "${file.name}" dropped.`);
        }
    };

    const handleDragOver = (event: React.DragEvent<HTMLDivElement>) => {
        event.preventDefault(); event.stopPropagation();
        event.currentTarget.classList.add('border-[var(--accent-primary)]', 'bg-opacity-10', 'bg-[var(--accent-primary)]');
    };

    const handleDragLeave = (event: React.DragEvent<HTMLDivElement>) => {
        event.preventDefault(); event.stopPropagation();
        event.currentTarget.classList.remove('border-[var(--accent-primary)]', 'bg-opacity-10', 'bg-[var(--accent-primary)]');
    };

    const handleProjectFiles = async (files: FileList) => {
        if (!files || files.length === 0) return;

        setIsLoading(true);
        toast.loading('Reading project files...', { id: 'project-read' });

        const fileContents: ProjectFile[] = [];
        const filesArray = Array.from(files);
        const rootDirName = filesArray[0].webkitRelativePath.split('/')[0];
        
        const packageJsonFile = filesArray.find(f => f.name === 'package.json' && f.webkitRelativePath.split('/').length === 2);
        let finalProjectName = rootDirName;
        if (packageJsonFile) {
            try {
                const content = await packageJsonFile.text();
                const parsed = JSON.parse(content);
                if (parsed.name) finalProjectName = parsed.name;
            } catch(e) { console.warn('Could not parse package.json for project name'); }
        }
        setProjectName(finalProjectName);

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
        
        setProjectFiles(fileContents);
        setIsLoading(false);
        if(fileContents.length > 0) {
            toast.success(`Project "${finalProjectName}" loaded with ${fileContents.length} files.`, { id: 'project-read', duration: 4000 });
        } else {
            toast.error(`Could not read any files from the selected directory.`, { id: 'project-read', duration: 4000 });
        }
    };

    const handleProjectFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        if (event.target.files) {
            handleProjectFiles(event.target.files);
        } else {
            setProjectFiles(null);
            setProjectName(null);
        }
    };

    const handleAnalyze = () => {
        let newActivityType: ActivityType = 'file_analysis';
        let newActivityTitle = "Untitled Analysis";
        let newActivityIcon = 'description';
        let newActivityColor = 'text-[var(--accent-primary)]';
        let newActivityLang: SupportedLanguage | undefined = SupportedLanguage.UNKNOWN;
        let originalInputText: string | undefined = undefined;
        let newActivityProjectFiles: ProjectFile[] | undefined = undefined;

        if (activeInputType === 'file' && selectedFileName && fileContentForAnalysis) {
            newActivityType = 'file_analysis';
            newActivityTitle = selectedFileName;
            originalInputText = fileContentForAnalysis;
            const extension = selectedFileName.substring(selectedFileName.lastIndexOf('.')).toLowerCase();
            newActivityLang = LanguageExtensions[extension] || SupportedLanguage.UNKNOWN;
            if (newActivityLang === SupportedLanguage.UNKNOWN) {
                toast.error(`Unsupported file type: "${extension}". Analysis page will require manual language selection.`, {duration: 5000});
            }
        } else if (activeInputType === 'concept' && conceptDescription.trim()) {
            newActivityType = 'concept_explanation';
            newActivityTitle = `Concept: ${conceptDescription.substring(0,30)}${conceptDescription.length > 30 ? '...' : ''}`;
            originalInputText = conceptDescription;
            newActivityIcon = 'lightbulb';
            newActivityColor = 'text-green-500';
            if (conceptDescription.toLowerCase().includes("python")) newActivityLang = SupportedLanguage.PYTHON;
            else if (conceptDescription.toLowerCase().includes("javascript") || conceptDescription.toLowerCase().includes("js")) newActivityLang = SupportedLanguage.JAVASCRIPT;
            else newActivityLang = SupportedLanguage.PYTHON;
        } else if (activeInputType === 'paste' && pastedCode.trim()) {
            newActivityType = 'paste_analysis';
            newActivityTitle = `Pasted Code: ${pastedCode.substring(0,20)}...`;
            originalInputText = pastedCode;
            newActivityIcon = 'content_paste_search';
            newActivityColor = 'text-yellow-500';
            newActivityLang = SupportedLanguage.UNKNOWN;
        } else if (activeInputType === 'debug' && debugCode.trim()) {
            newActivityType = 'debug_analysis';
            newActivityTitle = `Debug: ${debugCode.substring(0,30)}...`;
            originalInputText = debugCode;
            newActivityIcon = 'bug_report';
            newActivityColor = 'text-red-500';
            newActivityLang = SupportedLanguage.UNKNOWN;
        } else if (activeInputType === 'project' && projectFiles && projectName) {
            newActivityType = 'project_analysis';
            newActivityTitle = `Project: ${projectName}`;
            newActivityProjectFiles = projectFiles;
            newActivityIcon = 'folder_zip';
            newActivityColor = 'text-purple-400';
            newActivityLang = undefined;
        } else {
            toast.error("Please provide valid input for analysis.");
            return;
        }

        const newActivity: ActivityItem = {
            id: Date.now().toString() + "_dashboard_submission",
            type: newActivityType,
            title: newActivityTitle,
            timestamp: new Date(),
            summary: 'Analysis requested from dashboard...',
            icon: newActivityIcon,
            colorClass: newActivityColor,
            language: newActivityLang, 
            originalInput: originalInputText,
            projectFiles: newActivityProjectFiles,
            analysisResult: null,
            debugResult: null,
            projectAnalysis: null,
        };
            
        setSelectedFileName(null);
        setFileContentForAnalysis(null);
        setPastedCode('');
        setConceptDescription('');
        setDebugCode('');
        setProjectFiles(null);
        setProjectName(null);
        
        onViewActivityDetail(newActivity); 
    };
    
    const isAnalyzeDisabled = isLoading || 
        (activeInputType === 'file' && (!selectedFileName || !fileContentForAnalysis)) ||
        (activeInputType === 'concept' && !conceptDescription.trim()) ||
        (activeInputType === 'paste' && !pastedCode.trim()) ||
        (activeInputType === 'debug' && !debugCode.trim()) ||
        (activeInputType === 'project' && (!projectFiles || projectFiles.length === 0));

    let analyzeButtonText = "Analyze Code";
    if (activeInputType === 'concept') analyzeButtonText = "Explain Concept";
    else if (activeInputType === 'paste') analyzeButtonText = "Analyze Pasted Code";
    else if (activeInputType === 'debug') analyzeButtonText = "Debug Code";
    else if (activeInputType === 'project') analyzeButtonText = "Analyze Project";

    const recentActivitiesToShow = activities.slice(0, 3);

    const handleActivityItemClick = (activity: ActivityItem) => {
        if (activity.type !== 'settings_update') {
            onViewActivityDetail(activity);
        } else {
            toast('This activity type cannot be reloaded or has no detailed view.', { icon: 'ℹ️', duration: 4000 });
        }
    };

    return (
        <>
            <div className="flex flex-1">
                <aside className="w-64 min-h-screen bg-[var(--bg-secondary)] p-4 space-y-6 flex flex-col shadow-lg sticky top-0 h-screen">
                    <div className="flex items-center gap-2.5 px-1 py-1">
                        <div className="bg-gradient-to-br from-indigo-600 to-sky-500 p-2 rounded-lg shadow-md">
                            <span className="material-icons-outlined text-white text-2xl">model_training</span>
                        </div>
                        <h1 className="text-2xl font-bold text-white font-lexend">CodeTutor AI</h1>
                    </div>
                    <nav className="flex-grow space-y-2">
                        <a className="nav-link active" href="#" aria-label="Dashboard">
                            <span className="material-icons-outlined">dashboard</span>
                            <span>Dashboard</span>
                        </a>
                        <button 
                            type="button" 
                            onClick={() => setIsAllActivityModalOpen(true)}
                            className="nav-link w-full text-left"
                            aria-label="View All Activity"
                        >
                            <span className="material-icons-outlined">history</span>
                            <span>Analysis History</span>
                        </button>
                    </nav>
                    <div className="mt-auto relative">
                        <button
                            ref={settingsButtonRef}
                            onClick={toggleSettingsPanel}
                            className="nav-link w-full"
                            aria-expanded={isSettingsPanelOpen}
                            aria-controls="settings-panel-popover"
                            aria-label="Open settings"
                        >
                            <span className="material-icons-outlined">settings</span>
                            <span>Settings</span>
                        </button>
                        {isSettingsPanelOpen && (
                            <div 
                                id="settings-panel-popover"
                                ref={settingsPanelRef} 
                                className="absolute bottom-full left-0 mb-2 z-[60]"
                                role="dialog" 
                                aria-modal="true"
                                aria-labelledby="settings-panel-title"
                            >
                                <SettingsPanel 
                                    onUpdateActivity={onUpdateActivity}
                                    onClearAllActivities={onClearAllActivities}
                                />
                            </div>
                        )}
                    </div>
                </aside>

                <div className="flex-1 flex flex-col overflow-y-auto">
                    <header className="bg-[var(--bg-secondary)] shadow-md sticky top-0 z-40">
                        <div className="container mx-auto px-6 py-4 flex justify-between items-center">
                            <h2 className="text-xl font-semibold text-white">Code Analysis Dashboard</h2>
                        </div>
                    </header>

                    <main className="flex-grow container mx-auto px-6 py-8">
                        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                            <div className="lg:col-span-2 space-y-8">
                                <section className="card">
                                    <h3 className="text-lg font-semibold text-[var(--text-primary)] mb-1">Start New Analysis</h3>
                                    <p className="text-sm text-[var(--text-muted)] mb-6">Choose your preferred method to submit code or ask questions.</p>
                                    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4 mb-6">
                                        <button onClick={() => handleInputTypeChange('file')} className={`input-method-btn ${activeInputType === 'file' ? 'active' : ''}`} aria-pressed={activeInputType === 'file'} aria-label="Select Upload File method">
                                            <span className="material-icons-outlined">upload_file</span>
                                            <span>Upload File</span>
                                        </button>
                                        <button onClick={() => handleInputTypeChange('concept')} className={`input-method-btn ${activeInputType === 'concept' ? 'active' : ''}`} aria-pressed={activeInputType === 'concept'} aria-label="Select Explain Concept method">
                                            <span className="material-icons-outlined">lightbulb</span>
                                            <span>Explain Concept</span>
                                        </button>
                                        <button onClick={() => handleInputTypeChange('paste')} className={`input-method-btn ${activeInputType === 'paste' ? 'active' : ''}`} aria-pressed={activeInputType === 'paste'} aria-label="Select Paste Code method">
                                            <span className="material-icons-outlined">content_paste</span>
                                            <span>Paste Code</span>
                                        </button>
                                        <button onClick={() => handleInputTypeChange('debug')} className={`input-method-btn ${activeInputType === 'debug' ? 'active' : ''}`} aria-pressed={activeInputType === 'debug'} aria-label="Select Debug Code method">
                                            <span className="material-icons-outlined">bug_report</span>
                                            <span>Debug Code</span>
                                        </button>
                                        <button onClick={() => handleInputTypeChange('project')} className={`input-method-btn ${activeInputType === 'project' ? 'active' : ''}`} aria-pressed={activeInputType === 'project'} aria-label="Select Analyze Project method">
                                            <span className="material-icons-outlined">folder_zip</span>
                                            <span>Analyze Project</span>
                                        </button>
                                    </div>

                                    {activeInputType === 'file' && (
                                        <div className="space-y-4">
                                            <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1" htmlFor="fileUploadInputDashboard">Upload Your Code File</label>
                                            <div 
                                                className="border-2 border-dashed border-[var(--border-color)] rounded-lg p-6 flex flex-col items-center justify-center bg-[var(--bg-primary)] hover:border-[var(--accent-primary)] transition-colors duration-200 cursor-pointer"
                                                onClick={() => document.getElementById('fileUploadInputDashboard')?.click()}
                                                onDrop={handleDrop}
                                                onDragOver={handleDragOver}
                                                onDragLeave={handleDragLeave}
                                                role="button" tabIndex={0} aria-label="File upload drop zone"
                                                onKeyPress={(e) => { if (e.key === 'Enter' || e.key === ' ') document.getElementById('fileUploadInputDashboard')?.click(); }}
                                            >
                                                <span className="material-icons-outlined text-5xl text-[var(--text-muted)] mb-3">cloud_upload</span>
                                                <p className="text-[var(--text-secondary)] mb-1 text-center"><span className="font-semibold text-[var(--accent-primary)]">Click to choose file</span> or drag and drop</p>
                                                <p className="text-xs text-[var(--text-muted)] text-center">Max 5MB. Supported: PY, JAVA, JS, TS, HTML, CSS, etc.</p>
                                                <input className="hidden" id="fileUploadInputDashboard" type="file" onChange={handleFileChange} aria-hidden="true" accept={AcceptedFileExtensions}/>
                                            </div>
                                            {selectedFileName && ( <div className="text-sm text-[var(--text-secondary)] mt-2">Selected file: <span className="font-medium text-[var(--text-primary)]">{selectedFileName}</span></div> )}
                                        </div>
                                    )}

                                    {activeInputType === 'paste' && (
                                        <div className="space-y-4">
                                            <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1" htmlFor="codePasteArea">Paste Your Code</label>
                                            <textarea className="w-full p-3 bg-[var(--bg-primary)] border border-[var(--border-color)] rounded-md text-[var(--text-primary)] focus:ring-2 focus:ring-[var(--accent-primary)] focus:border-[var(--accent-primary)] placeholder-gray-500 min-h-[200px] custom-scrollbar-small font-mono text-sm" id="codePasteArea" placeholder="Paste your code snippet here..." value={pastedCode} onChange={(e) => setPastedCode(e.target.value)} aria-label="Paste code area"></textarea>
                                        </div>
                                    )}

                                    {activeInputType === 'concept' && (
                                        <div className="space-y-4">
                                            <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1" htmlFor="conceptInput">Describe the Concept</label>
                                            <textarea className="w-full p-3 bg-[var(--bg-primary)] border border-[var(--border-color)] rounded-md text-[var(--text-primary)] focus:ring-2 focus:ring-[var(--accent-primary)] focus:border-[var(--accent-primary)] placeholder-gray-500 min-h-[120px] custom-scrollbar-small" id="conceptInput" placeholder="e.g., 'Explain recursion in Python' or 'How do closures work in JavaScript?'" value={conceptDescription} onChange={(e) => setConceptDescription(e.target.value)} aria-label="Describe concept area"></textarea>
                                        </div>
                                    )}

                                    {activeInputType === 'debug' && (
                                        <div className="space-y-4">
                                            <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1" htmlFor="debugCodeArea">Paste Your Broken Code</label>
                                            <textarea className="w-full p-3 bg-[var(--bg-primary)] border border-[var(--border-color)] rounded-md text-[var(--text-primary)] focus:ring-2 focus:ring-[var(--accent-primary)] focus:border-[var(--accent-primary)] placeholder-gray-500 min-h-[200px] custom-scrollbar-small font-mono text-sm" id="debugCodeArea" placeholder="Paste your broken code snippet here..." value={debugCode} onChange={(e) => setDebugCode(e.target.value)} aria-label="Paste broken code area"></textarea>
                                        </div>
                                    )}

                                    {activeInputType === 'project' && (
                                        <div className="space-y-4">
                                            <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1" htmlFor="projectUploadInputDashboard">Select Project Folder</label>
                                            <div 
                                                className="border-2 border-dashed border-[var(--border-color)] rounded-lg p-6 flex flex-col items-center justify-center bg-[var(--bg-primary)] hover:border-[var(--accent-primary)] transition-colors duration-200 cursor-pointer"
                                                onClick={() => document.getElementById('projectUploadInputDashboard')?.click()}
                                                onDrop={(e) => { e.preventDefault(); toast.error('Please click to select a folder.');}}
                                                onDragOver={(e) => e.preventDefault()}
                                                role="button" tabIndex={0} aria-label="Project folder upload zone"
                                                onKeyPress={(e) => { if (e.key === 'Enter' || e.key === ' ') document.getElementById('projectUploadInputDashboard')?.click(); }}
                                            >
                                                <span className="material-icons-outlined text-5xl text-[var(--text-muted)] mb-3">folder_open</span>
                                                <p className="text-[var(--text-secondary)] mb-1 text-center"><span className="font-semibold text-[var(--accent-primary)]">Click to choose a folder</span></p>
                                                <p className="text-xs text-[var(--text-muted)] text-center">Sub-folders will be included. Large projects may take time to process.</p>
                                                <input className="hidden" id="projectUploadInputDashboard" type="file" onChange={handleProjectFileChange} {...{ webkitdirectory: "", directory: "", multiple: true }} aria-hidden="true" />
                                            </div>
                                            {projectName && (
                                                <div className="text-sm text-[var(--text-secondary)] mt-2">
                                                    Project: <span className="font-medium text-[var(--text-primary)]">{projectName}</span>
                                                    <span className="text-[var(--text-muted)]"> ({projectFiles?.length || 0} files read)</span>
                                                </div>
                                            )}
                                        </div>
                                    )}

                                    <div className="mt-8">
                                        <button className="btn-primary w-full md:w-auto" onClick={handleAnalyze} disabled={isAnalyzeDisabled} aria-label={`Submit ${activeInputType} for analysis`}>
                                            {isLoading && !projectName ? 
                                                <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" aria-hidden="true">
                                                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                                </svg>
                                                : <span className="material-icons-outlined mr-2" aria-hidden="true">analytics</span>
                                            }
                                            {isLoading && !projectName ? 'Processing...' : analyzeButtonText}
                                        </button>
                                    </div>
                                </section>

                                <section className="card">
                                    <h3 className="text-lg font-semibold text-[var(--text-primary)] mb-4">Recent Activity</h3>
                                    <div className="space-y-3">
                                        {recentActivitiesToShow.length > 0 ? recentActivitiesToShow.map(activity => (
                                            <div 
                                                key={activity.id} 
                                                className="flex items-center justify-between p-3 bg-[var(--bg-primary)] rounded-md shadow hover:shadow-lg hover:ring-1 hover:ring-[var(--accent-primary)] transition-all duration-150 cursor-pointer"
                                                onClick={() => handleActivityItemClick(activity)}
                                                onKeyPress={(e) => e.key === 'Enter' && handleActivityItemClick(activity)}
                                                role="button"
                                                tabIndex={0}
                                                aria-label={`View details for activity: ${activity.title}`}
                                            >
                                                <div className="flex items-center space-x-3 overflow-hidden">
                                                    <span className={`material-icons-outlined ${activity.colorClass} text-lg`} aria-hidden="true">{activity.icon}</span>
                                                    <div>
                                                        <p className="text-sm font-medium text-[var(--text-primary)] truncate" title={activity.title}>{activity.title}</p>
                                                        <p className="text-xs text-[var(--text-muted)] truncate" title={activity.summary}>{activity.summary || 'No summary'}</p>
                                                    </div>
                                                </div>
                                                <span className="text-xs text-[var(--text-muted)] whitespace-nowrap ml-2">{formatSimpleTimestamp(activity.timestamp)}</span>
                                            </div>
                                        )) : <p className="text-sm text-[var(--text-muted)]">No recent activity. Start an analysis to see it here!</p>}
                                    </div>
                                    <div className="mt-6 text-right">
                                        <button 
                                            type="button"
                                            onClick={() => setIsAllActivityModalOpen(true)}
                                            className="text-sm font-medium text-[var(--accent-primary)] hover:underline bg-transparent border-none p-0 cursor-pointer flex items-center ml-auto"
                                            aria-label="View All Activity"
                                            disabled={activities.length === 0}
                                        >
                                            View All Activity
                                            <span className="material-icons-outlined text-sm ml-1 align-middle" aria-hidden="true">arrow_forward</span>
                                        </button>
                                    </div>
                                </section>
                            </div>

                            <div className="lg:col-span-1 space-y-8">
                                <section className="card">
                                    <h3 className="text-lg font-semibold text-[var(--text-primary)] mb-4">Analysis Summary</h3>
                                    <div className="space-y-3">
                                        <div className="flex justify-between items-center">
                                            <span className="text-sm text-[var(--text-secondary)]">Total Activities:</span>
                                            <span className="text-sm font-semibold text-[var(--text-primary)]">{activities.length}</span>
                                        </div>
                                        <div className="flex justify-between items-center">
                                            <span className="text-sm text-[var(--text-secondary)]">Files Analyzed:</span>
                                            <span className="text-sm font-semibold text-[var(--text-primary)]">{activities.filter(a => a.type === 'file_analysis').length}</span>
                                        </div>
                                        <div className="flex justify-between items-center">
                                            <span className="text-sm text-[var(--text-secondary)]">Concepts Explained:</span>
                                            <span className="text-sm font-semibold text-[var(--text-primary)]">{activities.filter(a => a.type === 'concept_explanation').length}</span>
                                        </div>
                                         <div className="flex justify-between items-center">
                                            <span className="text-sm text-[var(--text-secondary)]">Pastes Analyzed:</span>
                                            <span className="text-sm font-semibold text-[var(--text-primary)]">{activities.filter(a => a.type === 'paste_analysis').length}</span>
                                        </div>
                                        <div className="flex justify-between items-center">
                                            <span className="text-sm text-[var(--text-secondary)]">Debug Sessions:</span>
                                            <span className="text-sm font-semibold text-[var(--text-primary)]">{activities.filter(a => a.type === 'debug_analysis').length}</span>
                                        </div>
                                        <div className="flex justify-between items-center">
                                            <span className="text-sm text-[var(--text-secondary)]">Projects Analyzed:</span>
                                            <span className="text-sm font-semibold text-[var(--text-primary)]">{activities.filter(a => a.type === 'project_analysis').length}</span>
                                        </div>
                                    </div>
                                    <div className="mt-6">
                                        <button 
                                            type="button" 
                                            onClick={() => setIsReportModalOpen(true)}
                                            className="btn-secondary w-full"
                                            aria-label="View Detailed Report"
                                            disabled={activities.length === 0}
                                        >
                                            <span className="material-icons-outlined mr-2" aria-hidden="true">summarize</span>
                                            View Detailed Report
                                        </button>
                                    </div>
                                </section>

                                <section className="card">
                                    <h3 className="text-lg font-semibold text-[var(--text-primary)] mb-4">Quick Tips</h3>
                                    <ul className="space-y-3 list-disc list-inside text-sm text-[var(--text-secondary)]">
                                        <li>Use the collapsible sidebar in the analysis view to focus on the results.</li>
                                        <li>Don't hesitate to use the "Ask a Follow-up" chat for specific questions.</li>
                                        <li>Stuck on a practice problem? Use the "More Instructions" button for progressive hints.</li>
                                        <li>Customize your view by hiding sections you don't need in the Settings panel.</li>
                                    </ul>
                                </section>
                            </div>
                        </div>
                    </main>

                    <footer className="bg-[var(--bg-secondary)] py-6 mt-auto border-t border-[var(--border-color)]">
                        <div className="container mx-auto px-6 text-center">
                            <p className="text-xs text-[var(--text-muted)]">
                                Powered by Advanced AI. Ensure API_KEY usage complies with security policies.
                                <br />
                                CodeTutor AI &copy; {new Date().getFullYear()}. All rights reserved.
                            </p>
                        </div>
                    </footer>
                </div>
            </div>
            <AllActivityModal 
                isOpen={isAllActivityModalOpen} 
                onClose={() => setIsAllActivityModalOpen(false)} 
                activities={activities} 
                onViewActivityDetail={handleActivityItemClick} 
            />
            <DetailedReportModal
                isOpen={isReportModalOpen}
                onClose={() => setIsReportModalOpen(false)}
                activities={activities}
            />
        </>
    );
};