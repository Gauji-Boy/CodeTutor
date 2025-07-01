



import React, { useState, useCallback, useRef, useEffect } from 'react';
import toast from 'react-hot-toast';
import { SettingsPanel } from '../components/SettingsPanel';
import { AllActivityModal } from '../components/AllActivityModal'; 
import { DetailedReportModal } from '../components/DetailedReportModal';
import { ActivityItem, ActivityType, SupportedLanguage, AnalysisResult, ExampleDifficulty, LanguageDisplayNames, LanguageExtensions } from '../types'; 
// import { useGlobalSettings } from '../hooks/useGlobalSettings';


interface DashboardPageProps {
    activities: ActivityItem[]; // Changed from local state to prop
    onViewActivityDetail: (activity: ActivityItem) => void;
    onAddActivity: (activity: ActivityItem) => void; // Added prop
    onClearAllActivities: () => void; // Added prop
}

type InputType = 'file' | 'concept' | 'paste';

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

const DashboardPage: React.FC<DashboardPageProps> = ({ activities, onViewActivityDetail, onAddActivity, onClearAllActivities }) => {
    const [activeInputType, setActiveInputType] = useState<InputType>('file');
    const [selectedFileName, setSelectedFileName] = useState<string | null>(null);
    const [fileContentForAnalysis, setFileContentForAnalysis] = useState<string | null>(null);
    const [pastedCode, setPastedCode] = useState<string>('');
    const [conceptDescription, setConceptDescription] = useState<string>('');
    const [isLoading, setIsLoading] = useState<boolean>(false); // This local isLoading is for the dashboard's own submissions.

    const [isSettingsPanelOpen, setIsSettingsPanelOpen] = useState(false);
    const settingsPanelRef = useRef<HTMLDivElement>(null);
    const settingsButtonRef = useRef<HTMLButtonElement>(null);

    const [isAllActivityModalOpen, setIsAllActivityModalOpen] = useState<boolean>(false);
    const [isReportModalOpen, setIsReportModalOpen] = useState<boolean>(false);
    
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

    const handleInputTypeChange = (type: InputType) => {
        setActiveInputType(type);
        setSelectedFileName(null); 
        setFileContentForAnalysis(null);
        setPastedCode('');
        setConceptDescription('');
    };

    const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        if (event.target.files && event.target.files[0]) {
            const file = event.target.files[0];
            setSelectedFileName(file.name);
            
            const reader = new FileReader();
            reader.onload = (e) => {
                setFileContentForAnalysis(e.target?.result as string);
            };
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
            reader.onload = (e) => {
                setFileContentForAnalysis(e.target?.result as string);
            };
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

    const handleAnalyze = () => {
        // This function creates an ActivityItem to be sent to HomePage for analysis.
        // HomePage will then call onAddActivity to log it via App.tsx.
        let newActivityType: ActivityType = 'file_analysis';
        let newActivityTitle = "Untitled Analysis";
        let newActivityIcon = 'description';
        let newActivityColor = 'text-[var(--accent-primary)]';
        let newActivityLang: SupportedLanguage | undefined = SupportedLanguage.UNKNOWN;
        let originalInputText = "";

        if (activeInputType === 'file' && selectedFileName && fileContentForAnalysis) {
            newActivityType = 'file_analysis';
            newActivityTitle = selectedFileName;
            originalInputText = fileContentForAnalysis;
            const extension = selectedFileName.substring(selectedFileName.lastIndexOf('.')).toLowerCase();
            newActivityLang = LanguageExtensions[extension] || SupportedLanguage.UNKNOWN;
             if (newActivityLang === SupportedLanguage.UNKNOWN) {
                toast.error(`Unsupported file type: "${extension}". Please ensure the file type is recognized or specify language on the analysis page.`, {duration: 5000});
                // Still proceed to analysis page, where user can manually select language if needed
            }
        } else if (activeInputType === 'concept' && conceptDescription.trim()) {
            newActivityType = 'concept_explanation';
            newActivityTitle = `Concept: ${conceptDescription.substring(0,30)}${conceptDescription.length > 30 ? '...' : ''}`;
            originalInputText = conceptDescription;
            newActivityIcon = 'lightbulb';
            newActivityColor = 'text-green-500';
            // Simple heuristic for language, HomePage will allow override or use default
            if (conceptDescription.toLowerCase().includes("python")) newActivityLang = SupportedLanguage.PYTHON;
            else if (conceptDescription.toLowerCase().includes("javascript") || conceptDescription.toLowerCase().includes("js")) newActivityLang = SupportedLanguage.JAVASCRIPT;
            else newActivityLang = SupportedLanguage.PYTHON; // Default to Python for concepts if not obvious
        } else if (activeInputType === 'paste' && pastedCode.trim()) {
            newActivityType = 'paste_analysis';
            newActivityTitle = `Pasted Code: ${pastedCode.substring(0,20)}...`;
            originalInputText = pastedCode;
            newActivityIcon = 'content_paste_search';
            newActivityColor = 'text-yellow-500';
            // Simple heuristic for language
             if (pastedCode.toLowerCase().includes("python") || pastedCode.toLowerCase().includes("def ")) newActivityLang = SupportedLanguage.PYTHON;
            else if (pastedCode.toLowerCase().includes("javascript") || pastedCode.match(/function|const|let|var/) && pastedCode.match(/=>|\{|\}/g)) newActivityLang = SupportedLanguage.JAVASCRIPT;
            else newActivityLang = SupportedLanguage.PYTHON; // Default
        } else {
            toast.error("Please provide valid input for analysis.");
            return;
        }

        const newActivity: ActivityItem = {
            id: Date.now().toString() + "_dashboard_submission", // Unique ID for dashboard submissions
            type: newActivityType,
            title: newActivityTitle,
            timestamp: new Date(),
            summary: 'Analysis requested from dashboard...', // This will be updated by HomePage
            icon: newActivityIcon,
            colorClass: newActivityColor,
            language: newActivityLang, 
            originalInput: originalInputText,
            analysisResult: null, // Analysis will be performed on HomePage
        };
            
        // Clear dashboard inputs
        setSelectedFileName(null);
        setFileContentForAnalysis(null);
        setPastedCode('');
        setConceptDescription('');
        
        onViewActivityDetail(newActivity); 
    };
    
    const isAnalyzeDisabled = isLoading || 
        (activeInputType === 'file' && (!selectedFileName || !fileContentForAnalysis)) ||
        (activeInputType === 'concept' && !conceptDescription.trim()) ||
        (activeInputType === 'paste' && !pastedCode.trim());

    let analyzeButtonText = "Analyze Code";
    if (activeInputType === 'concept') analyzeButtonText = "Explain Concept";
    else if (activeInputType === 'paste') analyzeButtonText = "Analyze Pasted Code";

    const showComingSoonToast = (featureName: string) => {
        toast(`${featureName} feature is coming soon!`, { icon: '🚧' });
    };

    const recentActivitiesToShow = activities.slice(0, 3); // Use activities prop

    const handleActivityItemClick = (activity: ActivityItem) => {
        if (activity.type !== 'settings_update') {
            // Pass the activity as-is. HomePage will decide if it needs to re-analyze or use existing result.
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
                            onClick={() => setIsAllActivityModalOpen(true)} // Open modal instead of toast
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
                                    onAddActivity={onAddActivity}
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
                                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
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
                                                role="button"
                                                tabIndex={0}
                                                aria-label="File upload drop zone"
                                                onKeyPress={(e) => { if (e.key === 'Enter' || e.key === ' ') document.getElementById('fileUploadInputDashboard')?.click(); }}
                                            >
                                                <span className="material-icons-outlined text-5xl text-[var(--text-muted)] mb-3">cloud_upload</span>
                                                <p className="text-[var(--text-secondary)] mb-1 text-center">
                                                    <span className="font-semibold text-[var(--accent-primary)]">Click to choose file</span> or drag and drop
                                                </p>
                                                <p className="text-xs text-[var(--text-muted)] text-center">
                                                    Max 5MB. Supported: PY, JAVA, JS, TS, HTML, CSS, etc.
                                                </p>
                                                <input className="hidden" id="fileUploadInputDashboard" type="file" onChange={handleFileChange} aria-hidden="true" accept={LanguageExtensions ? Object.keys(LanguageExtensions).join(',') : ''}/>
                                            </div>
                                            {selectedFileName && (
                                                <div className="text-sm text-[var(--text-secondary)] mt-2">Selected file: <span className="font-medium text-[var(--text-primary)]">{selectedFileName}</span></div>
                                            )}
                                        </div>
                                    )}

                                    {activeInputType === 'paste' && (
                                        <div className="space-y-4">
                                            <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1" htmlFor="codePasteArea">Paste Your Code</label>
                                            <textarea 
                                                className="w-full p-3 bg-[var(--bg-primary)] border border-[var(--border-color)] rounded-md text-[var(--text-primary)] focus:ring-2 focus:ring-[var(--accent-primary)] focus:border-[var(--accent-primary)] placeholder-gray-500 min-h-[200px] custom-scrollbar-small font-mono text-sm" 
                                                id="codePasteArea" 
                                                placeholder="Paste your code snippet here..." 
                                                value={pastedCode}
                                                onChange={(e) => setPastedCode(e.target.value)}
                                                aria-label="Paste code area"
                                            ></textarea>
                                        </div>
                                    )}

                                    {activeInputType === 'concept' && (
                                        <div className="space-y-4">
                                            <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1" htmlFor="conceptInput">Describe the Concept</label>
                                            <textarea 
                                                className="w-full p-3 bg-[var(--bg-primary)] border border-[var(--border-color)] rounded-md text-[var(--text-primary)] focus:ring-2 focus:ring-[var(--accent-primary)] focus:border-[var(--accent-primary)] placeholder-gray-500 min-h-[120px] custom-scrollbar-small" 
                                                id="conceptInput" 
                                                placeholder="e.g., 'Explain recursion in Python' or 'How do closures work in JavaScript?'"
                                                value={conceptDescription}
                                                onChange={(e) => setConceptDescription(e.target.value)}
                                                aria-label="Describe concept area"
                                            ></textarea>
                                        </div>
                                    )}

                                    <div className="mt-8">
                                        <button className="btn-primary w-full md:w-auto" onClick={handleAnalyze} disabled={isAnalyzeDisabled} aria-label={`Submit ${activeInputType} for analysis`}>
                                            {isLoading ? 
                                                <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" aria-hidden="true">
                                                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                                </svg>
                                                : <span className="material-icons-outlined mr-2" aria-hidden="true">analytics</span>
                                            }
                                            {isLoading ? 'Processing...' : analyzeButtonText}
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
                                                <span className="text-xs text-[var(--text-muted)] whitespace-nowrap ml-2">
                                                    {formatSimpleTimestamp(activity.timestamp)}
                                                </span>
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
                                        <li>Ensure your code is well-commented for better AI understanding.</li>
                                        <li>Break down large files into smaller, manageable chunks if possible.</li>
                                        <li>For concept explanations, be specific with your query.</li>
                                        <li>Regularly review analysis reports to improve coding practices.</li>
                                    </ul>
                                    <div className="mt-6">
                                        <button 
                                            type="button" 
                                            onClick={() => showComingSoonToast('Learning best practices')}
                                            className="text-sm font-medium text-[var(--accent-primary)] hover:underline bg-transparent border-none p-0 cursor-pointer flex items-center"
                                            aria-label="Learn More Best Practices (Coming Soon)"
                                        >
                                            Learn More Best Practices
                                            <span className="material-icons-outlined text-sm ml-1" aria-hidden="true">open_in_new</span>
                                        </button>
                                    </div>
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

export default DashboardPage;