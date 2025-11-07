import React, { useState, useEffect, useMemo, useCallback, Suspense, lazy } from 'react';
import { toast, Toaster } from 'react-hot-toast';
import { 
    ProjectAnalysis, 
    ProjectFile, 
    DependencyAnalysis, 
    DependencyInfo, 
    ChatMessage,
    ActivityItem,
    AnalysisResult,
    SupportedLanguage,
    LanguageExtensions,
    ExampleDifficulty,
    SupportedLanguage as LangEnum
} from '../types';
import { 
    generateReadmeWithGemini, 
    analyzeDependenciesWithGemini, 
    getProjectDependenciesWithGemini,
    askProjectFollowUpWithGemini,
    analyzeCodeWithGemini,
    GeminiRequestConfig
} from '../services/geminiService';
import { ErrorMessage } from './ErrorMessage';
import { CodeBlock } from './CodeBlock';
import { LoadingSpinner } from './LoadingSpinner';

const ResultDisplay = lazy(() => import('./ResultDisplay').then(module => ({ default: module.ResultDisplay })));

type ProjectResultTab = 'overview' | 'dependencies' | 'architecture' | 'chat';

interface ProjectResultDisplayProps {
    analysis: ProjectAnalysis;
    files: ProjectFile[];
    projectName: string;
    onUpdateActivity: (activity: ActivityItem) => void;
    activity: ActivityItem | null | undefined;
    geminiConfigForFiles: GeminiRequestConfig;
}

const getFileIcon = (path: string): string => {
    const lowerPath = path.toLowerCase();
    if (lowerPath.endsWith('.js') || lowerPath.endsWith('.jsx')) return 'javascript';
    if (lowerPath.endsWith('.ts') || lowerPath.endsWith('.tsx')) return 'javascript';
    if (lowerPath.endsWith('.json')) return 'data_object';
    if (lowerPath.endsWith('.py')) return 'code';
    if (lowerPath.endsWith('.html')) return 'html';
    if (lowerPath.endsWith('.css') || lowerPath.endsWith('.scss')) return 'css';
    if (lowerPath.endsWith('.md')) return 'article';
    if (lowerPath.includes('config')) return 'settings';
    if (lowerPath.includes('dockerfile') || lowerPath.includes('compose')) return 'deployed_code';
    if (lowerPath.endsWith('.gitignore')) return 'folder_off';
    if (lowerPath.endsWith('package.json') || lowerPath.endsWith('package-lock.json')) return 'inventory_2';
    return 'description';
};

const ArchitectureGraph: React.FC<{ data: DependencyInfo[] }> = ({ data }) => {
    if (!data || data.length === 0) return <div className="text-center text-sm text-[var(--text-muted)] py-8">No dependency information could be generated.</div>;
    const [selectedNode, setSelectedNode] = useState<string | null>(null);
    const nodes = useMemo(() => data.map(d => ({ id: d.modulePath, description: d.description })), [data]);
    const edges = useMemo(() => {
        const result: { source: string; target: string }[] = [];
        data.forEach(d => { d.imports.forEach(imp => { if (nodes.some(n => n.id === imp)) result.push({ source: d.modulePath, target: imp }); }); });
        return result;
    }, [data, nodes]);

    return (
        <div className="space-y-3">
             <p className="text-xs text-[var(--text-muted)] italic">AI-generated visualization of core architectural dependencies. Click a module to highlight connections.</p>
            {nodes.map(node => {
                const isSelected = selectedNode === node.id;
                const isRelated = selectedNode && (edges.some(e => (e.source === node.id && e.target === selectedNode) || (e.source === selectedNode && e.target === node.id)));
                const imports = data.find(d => d.modulePath === node.id)?.imports || [];
                const importedBy = data.find(d => d.modulePath === node.id)?.importedBy || [];
                return (
                    <div key={node.id} onClick={() => setSelectedNode(node.id === selectedNode ? null : node.id)} className={`p-3 rounded-md border transition-all duration-200 cursor-pointer ${isSelected ? 'bg-[var(--accent-primary)]/30 border-[var(--accent-primary)] ring-2 ring-[var(--accent-primary)]' : isRelated ? 'bg-[var(--accent-primary)]/20 border-[var(--accent-primary)]/50' : 'bg-[var(--bg-tertiary)]/80 hover:bg-[var(--border-color)]/70 border-[var(--border-color)]'}`}>
                        <div className="font-semibold text-sm text-[var(--accent-primary)] font-fira-code mb-1 truncate">{node.id}</div>
                        <p className="text-xs text-[var(--text-secondary)] mb-3">{node.description}</p>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                            <div>
                                <h5 className="font-semibold text-[var(--text-muted)] mb-1">Imports ({imports.length})</h5>
                                <ul className="list-none space-y-1 pl-2">{imports.length > 0 ? imports.map(imp => <li key={imp} className="flex items-start"><span className="material-icons-outlined text-green-500 text-xs mr-1.5 mt-px">arrow_downward</span><span className="truncate" title={imp}>{imp}</span></li>) : <li className="text-[var(--text-muted)] italic">None</li>}</ul>
                            </div>
                            <div>
                                <h5 className="font-semibold text-[var(--text-muted)] mb-1">Imported By ({importedBy.length})</h5>
                                 <ul className="list-none space-y-1 pl-2">{importedBy.length > 0 ? importedBy.map(imp => <li key={imp} className="flex items-start"><span className="material-icons-outlined text-yellow-500 text-xs mr-1.5 mt-px">arrow_upward</span><span className="truncate" title={imp}>{imp}</span></li>) : <li className="text-[var(--text-muted)] italic">None</li>}</ul>
                            </div>
                        </div>
                    </div>
                );
            })}
        </div>
    );
};

const ProjectResultDisplayComponent: React.FC<ProjectResultDisplayProps> = ({ analysis, files, projectName, onUpdateActivity, activity, geminiConfigForFiles }) => {
    const [searchTerm, setSearchTerm] = useState('');
    const [activeTab, setActiveTab] = useState<ProjectResultTab>('overview');
    
    const [readmeContent, setReadmeContent] = useState<string | null>(analysis.readmeContent || null);
    const [dependencies, setDependencies] = useState<DependencyAnalysis[] | null>(analysis.dependencyAnalysis || null);
    const [dependencyInfo, setDependencyInfo] = useState<DependencyInfo[] | null>(analysis.dependencyInfo || null);
    const [chatHistory, setChatHistory] = useState<ChatMessage[]>(activity?.projectChatHistory || []);

    const [isReadmeLoading, setIsReadmeLoading] = useState(false);
    const [readmeError, setReadmeError] = useState<string|null>(null);
    const [isDepsLoading, setIsDepsLoading] = useState(false);
    const [depsError, setDepsError] = useState<string|null>(null);
    const [isArchLoading, setIsArchLoading] = useState(false);
    const [archError, setArchError] = useState<string|null>(null);
    const [isChatLoading, setIsChatLoading] = useState(false);
    const [chatError, setChatError] = useState<string|null>(null);
    const [userMessage, setUserMessage] = useState('');

    const [isAnalysisModalOpen, setIsAnalysisModalOpen] = useState(false);
    const [isAnalyzingFile, setIsAnalyzingFile] = useState(false);
    const [fileAnalysisError, setFileAnalysisError] = useState<string|null>(null);
    const [analyzedFileResult, setAnalyzedFileResult] = useState<AnalysisResult | null>(null);
    const [analyzedFileContext, setAnalyzedFileContext] = useState<{ file: ProjectFile, lang: SupportedLanguage } | null>(null);

    const packageJsonFile = useMemo(() => files.find(f => f.path.endsWith('package.json')), [files]);

    const handleGenerateReadme = async () => {
        setIsReadmeLoading(true); setReadmeError(null);
        try {
            const readme = await generateReadmeWithGemini(files, analysis.overview, projectName, geminiConfigForFiles);
            setReadmeContent(readme);
            if (activity) onUpdateActivity({ ...activity, projectAnalysis: { ...analysis, readmeContent: readme } });
            toast.success("README.md generated successfully!");
        } catch (err) {
            const msg = err instanceof Error ? err.message : "Failed to generate README.";
            setReadmeError(msg); toast.error(msg);
        } finally {
            setIsReadmeLoading(false);
        }
    };

    const handleFetchDependencies = useCallback(async () => {
        if (!packageJsonFile || dependencies) return;
        setIsDepsLoading(true); setDepsError(null);
        try {
            const deps = await analyzeDependenciesWithGemini(packageJsonFile.content, geminiConfigForFiles);
            setDependencies(deps);
            if (activity) onUpdateActivity({ ...activity, projectAnalysis: { ...analysis, dependencyAnalysis: deps } });
            toast.success("Dependency analysis complete!");
        } catch(err) {
            const msg = err instanceof Error ? err.message : "Failed to analyze dependencies.";
            setDepsError(msg); toast.error(msg);
        } finally {
            setIsDepsLoading(false);
        }
    }, [packageJsonFile, dependencies, analysis, activity, onUpdateActivity, geminiConfigForFiles]);

    const handleFetchArchitecture = useCallback(async () => {
        if (dependencyInfo) return;
        setIsArchLoading(true); setArchError(null);
        try {
            const arch = await getProjectDependenciesWithGemini(files, geminiConfigForFiles);
            setDependencyInfo(arch);
             if (activity) onUpdateActivity({ ...activity, projectAnalysis: { ...analysis, dependencyInfo: arch } });
            toast.success("Architecture analysis complete!");
        } catch(err) {
            const msg = err instanceof Error ? err.message : "Failed to analyze architecture.";
            setArchError(msg); toast.error(msg);
        } finally {
            setIsArchLoading(false);
        }
    }, [dependencyInfo, files, analysis, activity, onUpdateActivity, geminiConfigForFiles]);

    useEffect(() => {
        if (activeTab === 'dependencies' && !dependencies && packageJsonFile) handleFetchDependencies();
        else if (activeTab === 'architecture' && !dependencyInfo) handleFetchArchitecture();
    }, [activeTab, dependencies, dependencyInfo, packageJsonFile, handleFetchDependencies, handleFetchArchitecture]);

    const handleSendMessage = async () => {
        if (!userMessage.trim() || isChatLoading) return;
        const newUserMessage: ChatMessage = { role: 'user', content: userMessage };
        const newHistory = [...chatHistory, newUserMessage];
        setChatHistory(newHistory); setUserMessage(''); setIsChatLoading(true); setChatError(null);
        try {
            const aiResponse = await askProjectFollowUpWithGemini(newUserMessage.content, chatHistory, analysis.overview, files.map(f => f.path), geminiConfigForFiles);
            // FIX: Explicitly type the new message object to prevent TypeScript from widening the 'role' property to a generic string.
            const aiResponseMessage: ChatMessage = { role: 'ai', content: aiResponse };
            const finalHistory = [...newHistory, aiResponseMessage];
            setChatHistory(finalHistory);
            if(activity) onUpdateActivity({ ...activity, projectChatHistory: finalHistory });
        } catch (err) {
            const msg = err instanceof Error ? err.message : "Failed to get response from AI.";
            setChatError(msg);
            // FIX: Explicitly type `aiErrorMsg` to match the `ChatMessage` interface,
            // which prevents TypeScript from widening the `role` property to a generic `string`.
            const aiErrorMsg: ChatMessage = { role: 'ai', content: `Error: ${msg}` };
            setChatHistory(prev => [...prev, aiErrorMsg]);
        } finally {
            setIsChatLoading(false);
        }
    };
    
    const filteredFiles = useMemo(() => analysis.fileBreakdown.filter(f => f.path.toLowerCase().includes(searchTerm.toLowerCase())), [analysis.fileBreakdown, searchTerm]);

    const handleAnalyzeFile = async (fileToAnalyze: ProjectFile) => {
        const extension = fileToAnalyze.path.substring(fileToAnalyze.path.lastIndexOf('.')).toLowerCase();
        const lang = LanguageExtensions[extension] || LangEnum.UNKNOWN;
        if (lang === LangEnum.UNKNOWN) {
            toast.error("Cannot analyze file with unsupported or unknown extension.");
            return;
        }
        setAnalyzedFileContext({ file: fileToAnalyze, lang });
        setIsAnalysisModalOpen(true);
        setIsAnalyzingFile(true);
        setFileAnalysisError(null);
        setAnalyzedFileResult(null);

        try {
            const result = await analyzeCodeWithGemini(fileToAnalyze.content, lang, 'easy', 'intermediate', geminiConfigForFiles);
            setAnalyzedFileResult(result);
        } catch (err) {
            setFileAnalysisError(err instanceof Error ? err.message : "An unexpected error occurred during file analysis.");
        } finally {
            setIsAnalyzingFile(false);
        }
    };

    const TabButton: React.FC<{ tabId: ProjectResultTab; label: string; icon: string; disabled?: boolean; }> = ({ tabId, label, icon, disabled = false }) => (
        <button role="tab" aria-selected={activeTab === tabId} disabled={disabled} onClick={() => setActiveTab(tabId)} className={`flex items-center gap-2 px-3 py-2 text-sm font-medium rounded-md transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-[var(--bg-secondary)] focus:ring-[var(--accent-primary)] ${activeTab === tabId ? 'bg-[var(--accent-primary)] text-white' : 'text-[var(--text-secondary)] hover:bg-[var(--bg-tertiary)] hover:text-[var(--text-primary)]'} ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}>
            <span className="material-icons-outlined text-base">{icon}</span> {label}
        </button>
    );

    return (
        <div className="space-y-4">
            <Toaster position="bottom-center" toastOptions={{ style: { background: '#333', color: '#fff' }}}/>
             <section aria-labelledby="project-overview-title">
                <h3 id="project-overview-title" className="text-lg font-semibold text-[var(--text-primary)] mb-3 flex items-center">
                    <span className="material-icons-outlined text-[var(--accent-primary)] mr-2 text-xl">account_tree</span>
                    Project Analysis: {projectName.replace(/^Project:\s*/, '')}
                </h3>
                <div className="border-b border-[var(--border-color)] mb-4"><nav className="flex flex-wrap items-center gap-2" role="tablist" aria-label="Project Analysis Sections">
                    <TabButton tabId="overview" label="Overview" icon="summarize" />
                    <TabButton tabId="dependencies" label="Dependencies" icon="hub" disabled={!packageJsonFile} />
                    <TabButton tabId="architecture" label="Architecture" icon="schema" />
                    <TabButton tabId="chat" label="Chat" icon="question_answer" />
                </nav></div>
            </section>
            
            <div role="tabpanel">
                {activeTab === 'overview' && (<div className="space-y-6">
                    <div><h4 className="text-md font-semibold text-[var(--text-primary)] mb-2">Project Summary</h4><div className="bg-[var(--bg-tertiary)]/50 p-3 sm:p-4 rounded-lg border border-[var(--border-color)]"><p className="text-sm text-[var(--text-secondary)] leading-relaxed whitespace-pre-wrap">{analysis.overview}</p></div></div>
                    <div>
                        <div className="flex justify-between items-center mb-2"><h4 className="text-md font-semibold text-[var(--text-primary)]">Generated README.md</h4><button onClick={handleGenerateReadme} disabled={isReadmeLoading} className="bg-[var(--accent-primary)] hover:bg-[var(--accent-primary-hover)] text-white font-medium py-1 px-3 rounded-md flex items-center gap-1.5 transition-colors text-xs shadow disabled:opacity-60 disabled:cursor-wait">{isReadmeLoading ? <div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin"></div> : <span className="material-icons-outlined text-sm">auto_stories</span>}<span>{isReadmeLoading ? 'Generating...' : (readmeContent ? 'Regenerate' : 'Generate README')}</span></button></div>
                        {readmeError && <ErrorMessage message={readmeError} />}
                        {/* FIX: Use the SupportedLanguage enum for the 'language' prop. */}
                        {readmeContent && !isReadmeLoading && <div className="mt-2"><CodeBlock code={readmeContent} language={LangEnum.MARKDOWN} /></div>}
                    </div>
                    <div>
                        <h4 className="text-md font-semibold text-[var(--text-primary)] mb-3">File Breakdown</h4>
                        <div className="relative mb-3"><span className="material-icons-outlined absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)] text-lg">search</span><input type="text" placeholder="Search files..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="w-full bg-[var(--bg-tertiary)] border border-[var(--border-color)] text-[var(--text-primary)] rounded-md py-2 px-3 pl-10 text-sm focus:ring-1 focus:ring-[var(--accent-primary)]" /></div>
                        <div className="space-y-2 max-h-[50vh] overflow-y-auto custom-scrollbar-small pr-2">
                            {filteredFiles.map(file => (<div key={file.path} className="p-3 bg-[var(--bg-tertiary)]/80 rounded-md hover:bg-[var(--border-color)]/70">
                                <div className="flex justify-between items-start gap-3">
                                    <div className="flex-grow overflow-hidden">
                                        <div className="flex items-center text-sm font-medium text-[var(--accent-primary)] font-fira-code mb-1"><span className="material-icons-outlined text-base mr-2">{getFileIcon(file.path)}</span><span className="truncate">{file.path}</span></div>
                                        <p className="text-xs text-[var(--text-secondary)] pl-7">{file.description}</p>
                                    </div>
                                    <button onClick={() => { const f = files.find(fd => fd.path === file.path); if (f) handleAnalyzeFile(f); }} className="bg-[var(--bg-tertiary)] hover:bg-[var(--accent-primary)] text-white font-medium py-1 px-2.5 rounded-md flex items-center gap-1 transition-colors text-xs shadow shrink-0"><span className="material-icons-outlined text-sm">analytics</span>Analyze</button>
                                </div>
                            </div>))}
                        </div>
                    </div>
                </div>)}
                {activeTab === 'dependencies' && (<div className="space-y-4">
                    {isDepsLoading && <p className="text-sm text-[var(--text-muted)] italic">Analyzing dependencies...</p>}
                    {depsError && <ErrorMessage message={depsError} />}
                    {dependencies && dependencies.map(dep => (<div key={dep.name} className="p-3 bg-[var(--bg-tertiary)]/80 rounded-md border border-[var(--border-color)]"><h5 className="font-semibold text-sm text-[var(--accent-primary)] font-fira-code">{dep.name}</h5><p className="text-xs text-[var(--text-secondary)] mt-1">{dep.description}</p></div>))}
                </div>)}
                {activeTab === 'architecture' && (<div className="space-y-4">
                    {isArchLoading && <p className="text-sm text-[var(--text-muted)] italic">Analyzing project architecture...</p>}
                    {archError && <ErrorMessage message={archError} />}
                    {dependencyInfo && <ArchitectureGraph data={dependencyInfo} />}
                </div>)}
                {activeTab === 'chat' && (<div className="flex flex-col h-[70vh]">
                    <div className="flex-grow p-3 space-y-4 overflow-y-auto custom-scrollbar-small bg-[var(--bg-tertiary)]/50 rounded-t-lg border border-b-0 border-[var(--border-color)]">
                        {chatHistory.map((msg, index) => (<div key={index} className={`flex items-start gap-2.5 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>{msg.role === 'ai' && <span className="material-icons-outlined text-[var(--accent-primary)] text-lg flex-shrink-0 mt-1">assistant</span>}<div className={`max-w-md p-2.5 rounded-lg text-sm leading-normal ${msg.role === 'user' ? 'bg-[var(--accent-primary)] text-white' : 'bg-[var(--bg-tertiary)] text-[var(--text-primary)]'}`}><p className="whitespace-pre-wrap">{msg.content}</p></div></div>))}
                        {isChatLoading && <div className="flex items-start gap-2.5"><span className="material-icons-outlined text-[var(--accent-primary)] text-lg flex-shrink-0 mt-1">assistant</span><div className="bg-[var(--bg-tertiary)] p-2.5 rounded-lg flex items-center space-x-1.5"><span className="w-2 h-2 bg-[var(--text-muted)] rounded-full animate-pulse"></span><span className="w-2 h-2 bg-[var(--text-muted)] rounded-full animate-pulse delay-200"></span><span className="w-2 h-2 bg-[var(--text-muted)] rounded-full animate-pulse delay-400"></span></div></div>}
                        {chatError && <ErrorMessage message={chatError} />}
                    </div>
                    <div className="flex items-center gap-2 p-3 bg-[var(--bg-tertiary)]/80 rounded-b-lg border border-t-0 border-[var(--border-color)]"><textarea value={userMessage} onChange={e => setUserMessage(e.target.value)} onKeyDown={e => {if(e.key === 'Enter' && !e.shiftKey) {e.preventDefault(); handleSendMessage();}}} placeholder="Ask about the project..." className="flex-grow w-full bg-[var(--bg-tertiary)] border border-[var(--border-color)] text-[var(--text-primary)] rounded-md p-2.5 text-sm focus:ring-1 focus:ring-[var(--accent-primary)] custom-scrollbar-small resize-none" rows={1} disabled={isChatLoading} /><button onClick={handleSendMessage} disabled={isChatLoading || !userMessage.trim()} className="bg-[var(--accent-primary)] hover:bg-[var(--accent-primary-hover)] text-white p-2.5 rounded-md flex items-center justify-center transition-colors disabled:bg-[var(--bg-tertiary)]"><span className="material-icons-outlined text-lg">send</span></button></div>
                </div>)}
            </div>

            {isAnalysisModalOpen && (
                <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={() => setIsAnalysisModalOpen(false)}>
                    <div className="bg-[var(--bg-secondary)] w-full max-w-4xl h-[90vh] rounded-xl shadow-2xl flex flex-col overflow-hidden ring-1 ring-[var(--border-color)]" onClick={e => e.stopPropagation()}>
                        <header className="p-3 sm:p-4 border-b border-[var(--border-color)] flex justify-between items-center flex-shrink-0">
                            <h2 className="text-base sm:text-lg font-semibold text-[var(--text-primary)] flex items-center truncate"><span className="material-icons-outlined text-[var(--accent-primary)] mr-2 text-xl">analytics</span>Analysis: <span className="font-fira-code ml-2 truncate">{analyzedFileContext?.file.path}</span></h2>
                            <button onClick={() => setIsAnalysisModalOpen(false)} className="text-[var(--text-muted)] hover:text-[var(--text-primary)] p-1.5 rounded-full hover:bg-[var(--bg-tertiary)]"><span className="material-icons-outlined">close</span></button>
                        </header>
                        <div className="flex-grow p-4 sm:p-6 overflow-y-auto custom-scrollbar-small">
                            {isAnalyzingFile && <LoadingSpinner loadingText={`Analyzing ${analyzedFileContext?.file.path}...`} />}
                            {!isAnalyzingFile && fileAnalysisError && <ErrorMessage message={fileAnalysisError} />}
                            {!isAnalyzingFile && analyzedFileResult && analyzedFileContext && (
                                <Suspense fallback={<LoadingSpinner loadingText="Loading results..." />}>
                                    {/* FIX: Pass the required `geminiConfig` prop. */}
                                    <ResultDisplay 
                                        result={analyzedFileResult}
                                        language={analyzedFileResult.detectedLanguage || analyzedFileContext.lang}
                                        difficultyOfProvidedExample={'easy'}
                                        initialPracticeDifficulty={'intermediate'}
                                        originalInputContext={analyzedFileContext.file.content}
                                        originalInputType={'code'}
                                        geminiConfig={geminiConfigForFiles}
                                    />
                                </Suspense>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
export const ProjectResultDisplay = React.memo(ProjectResultDisplayComponent);