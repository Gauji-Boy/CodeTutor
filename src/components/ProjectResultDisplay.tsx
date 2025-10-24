import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { toast } from 'react-hot-toast';
import { 
    ProjectAnalysis, 
    ProjectFile, 
    DependencyAnalysis, 
    DependencyInfo, 
    ChatMessage,
    ActivityItem
} from '../types';
import { 
    generateReadmeWithGemini, 
    analyzeDependenciesWithGemini, 
    getProjectDependenciesWithGemini,
    askProjectFollowUpWithGemini
} from '../services/geminiService';
import { ErrorMessage } from './ErrorMessage';
import { CodeBlock } from './CodeBlock';

type ProjectResultTab = 'overview' | 'dependencies' | 'architecture' | 'chat';

interface ProjectResultDisplayProps {
    analysis: ProjectAnalysis;
    files: ProjectFile[];
    projectName: string;
    onAnalyzeFile: (file: ProjectFile) => void;
    onUpdateActivity: (activity: ActivityItem) => void;
    activity: ActivityItem | null | undefined;
}

const getFileIcon = (path: string): string => {
    const lowerPath = path.toLowerCase();
    if (lowerPath.endsWith('.js') || lowerPath.endsWith('.jsx')) return 'javascript';
    if (lowerPath.endsWith('.ts') || lowerPath.endsWith('.tsx')) return 'javascript'; // Could use a different icon for TS if available
    if (lowerPath.endsWith('.json')) return 'data_object';
    if (lowerPath.endsWith('.py')) return 'code'; // generic code icon can represent python
    if (lowerPath.endsWith('.html')) return 'html';
    if (lowerPath.endsWith('.css') || lowerPath.endsWith('.scss')) return 'css';
    if (lowerPath.endsWith('.md')) return 'article';
    if (lowerPath.includes('config')) return 'settings';
    if (lowerPath.includes('dockerfile') || lowerPath.includes('compose')) return 'deployed_code';
    if (lowerPath.endsWith('.gitignore') || lowerPath.endsWith('.gitattributes')) return 'folder_off';
    if (lowerPath.endsWith('package.json') || lowerPath.endsWith('package-lock.json')) return 'inventory_2';
    if (lowerPath.endsWith('.java')) return 'code';
    if (lowerPath.endsWith('.rs')) return 'code';
    if (lowerPath.endsWith('.c') || lowerPath.endsWith('.h') || lowerPath.endsWith('.cpp') || lowerPath.endsWith('.hpp')) return 'code';

    return 'description'; // default
};

const ArchitectureGraph: React.FC<{ data: DependencyInfo[] }> = ({ data }) => {
    if (!data || data.length === 0) {
        return <div className="text-center text-sm text-gray-400 py-8">No dependency information could be generated for the core modules.</div>;
    }

    const [selectedNode, setSelectedNode] = useState<string | null>(null);

    const nodes = useMemo(() => data.map(d => ({ id: d.modulePath, description: d.description })), [data]);
    const edges = useMemo(() => {
        const result: { source: string; target: string }[] = [];
        data.forEach(d => {
            d.imports.forEach(imp => {
                if (nodes.some(n => n.id === imp)) {
                    result.push({ source: d.modulePath, target: imp });
                }
            });
        });
        return result;
    }, [data, nodes]);

    return (
        <div className="space-y-3">
             <p className="text-xs text-gray-400 italic">This is an AI-generated visualization of the core architectural dependencies. Click on a module to highlight its connections.</p>
            {nodes.map(node => {
                const isSelected = selectedNode === node.id;
                const isRelated = selectedNode && (
                    edges.some(e => (e.source === node.id && e.target === selectedNode) || (e.source === selectedNode && e.target === node.id))
                );

                const imports = data.find(d => d.modulePath === node.id)?.imports || [];
                const importedBy = data.find(d => d.modulePath === node.id)?.importedBy || [];

                return (
                    <div
                        key={node.id}
                        onClick={() => setSelectedNode(node.id === selectedNode ? null : node.id)}
                        className={`p-3 rounded-md border transition-all duration-200 cursor-pointer ${isSelected ? 'bg-indigo-600/30 border-indigo-500 ring-2 ring-indigo-500' : isRelated ? 'bg-indigo-600/20 border-indigo-500/50' : 'bg-gray-700/40 hover:bg-gray-700/70 border-gray-600/80'}`}
                    >
                        <div className="font-semibold text-sm text-indigo-300 font-fira-code mb-1 truncate">{node.id}</div>
                        <p className="text-xs text-gray-300 mb-3">{node.description}</p>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                            <div>
                                <h5 className="font-semibold text-gray-400 mb-1">Imports ({imports.length})</h5>
                                <ul className="list-none space-y-1 pl-2">
                                    {imports.length > 0 ? imports.map(imp => <li key={imp} className="flex items-start"><span className="material-icons-outlined text-green-500 text-xs mr-1.5 mt-px">arrow_downward</span><span className="truncate" title={imp}>{imp}</span></li>) : <li className="text-gray-500 italic">None</li>}
                                </ul>
                            </div>
                            <div>
                                <h5 className="font-semibold text-gray-400 mb-1">Imported By ({importedBy.length})</h5>
                                 <ul className="list-none space-y-1 pl-2">
                                    {importedBy.length > 0 ? importedBy.map(imp => <li key={imp} className="flex items-start"><span className="material-icons-outlined text-yellow-500 text-xs mr-1.5 mt-px">arrow_upward</span><span className="truncate" title={imp}>{imp}</span></li>) : <li className="text-gray-500 italic">None</li>}
                                </ul>
                            </div>
                        </div>
                    </div>
                );
            })}
        </div>
    );
};


export const ProjectResultDisplay: React.FC<ProjectResultDisplayProps> = ({ analysis, files, projectName, onAnalyzeFile, onUpdateActivity, activity }) => {
    const [searchTerm, setSearchTerm] = useState('');
    const [activeTab, setActiveTab] = useState<ProjectResultTab>('overview');
    
    // State for generated content
    const [readmeContent, setReadmeContent] = useState<string | null>(analysis.readmeContent || null);
    const [dependencies, setDependencies] = useState<DependencyAnalysis[] | null>(analysis.dependencyAnalysis || null);
    const [dependencyInfo, setDependencyInfo] = useState<DependencyInfo[] | null>(analysis.dependencyInfo || null);
    const [chatHistory, setChatHistory] = useState<ChatMessage[]>(activity?.projectChatHistory || []);

    // Loading and error states for each feature
    const [isReadmeLoading, setIsReadmeLoading] = useState(false);
    const [readmeError, setReadmeError] = useState<string|null>(null);
    const [isDepsLoading, setIsDepsLoading] = useState(false);
    const [depsError, setDepsError] = useState<string|null>(null);
    const [isArchLoading, setIsArchLoading] = useState(false);
    const [archError, setArchError] = useState<string|null>(null);
    const [isChatLoading, setIsChatLoading] = useState(false);
    const [chatError, setChatError] = useState<string|null>(null);
    const [userMessage, setUserMessage] = useState('');

    const packageJsonFile = useMemo(() => files.find(f => f.path.endsWith('package.json')), [files]);

    const handleGenerateReadme = async () => {
        setIsReadmeLoading(true);
        setReadmeError(null);
        try {
            const readme = await generateReadmeWithGemini(files, analysis.overview, projectName);
            setReadmeContent(readme);
            if (activity) {
                onUpdateActivity({ ...activity, projectAnalysis: { ...analysis, readmeContent: readme } });
            }
            toast.success("README.md generated successfully!");
        } catch (err) {
            const msg = err instanceof Error ? err.message : "Failed to generate README.";
            setReadmeError(msg);
            toast.error(msg);
        } finally {
            setIsReadmeLoading(false);
        }
    };

    const handleFetchDependencies = useCallback(async () => {
        if (!packageJsonFile || dependencies) return;
        setIsDepsLoading(true);
        setDepsError(null);
        try {
            const deps = await analyzeDependenciesWithGemini(packageJsonFile.content);
            setDependencies(deps);
            if (activity) {
                 onUpdateActivity({ ...activity, projectAnalysis: { ...analysis, dependencyAnalysis: deps } });
            }
            toast.success("Dependency analysis complete!");
        } catch(err) {
            const msg = err instanceof Error ? err.message : "Failed to analyze dependencies.";
            setDepsError(msg);
            toast.error(msg);
        } finally {
            setIsDepsLoading(false);
        }
    }, [packageJsonFile, dependencies, files, analysis, activity, onUpdateActivity]);

    const handleFetchArchitecture = useCallback(async () => {
        if (dependencyInfo) return;
        setIsArchLoading(true);
        setArchError(null);
        try {
            const arch = await getProjectDependenciesWithGemini(files);
            setDependencyInfo(arch);
             if (activity) {
                 onUpdateActivity({ ...activity, projectAnalysis: { ...analysis, dependencyInfo: arch } });
            }
            toast.success("Architecture analysis complete!");
        } catch(err) {
            const msg = err instanceof Error ? err.message : "Failed to analyze architecture.";
            setArchError(msg);
            toast.error(msg);
        } finally {
            setIsArchLoading(false);
        }
    }, [dependencyInfo, files, analysis, activity, onUpdateActivity]);

    useEffect(() => {
        if (activeTab === 'dependencies' && !dependencies && packageJsonFile) {
            handleFetchDependencies();
        } else if (activeTab === 'architecture' && !dependencyInfo) {
            handleFetchArchitecture();
        }
    }, [activeTab, dependencies, dependencyInfo, packageJsonFile, handleFetchDependencies, handleFetchArchitecture]);

    const handleSendMessage = async () => {
        if (!userMessage.trim() || isChatLoading) return;
        const newUserMessage: ChatMessage = { role: 'user', content: userMessage };
        const newHistory = [...chatHistory, newUserMessage];

        setChatHistory(newHistory);
        setUserMessage('');
        setIsChatLoading(true);
        setChatError(null);

        try {
            const aiResponse = await askProjectFollowUpWithGemini(
                newUserMessage.content,
                chatHistory,
                analysis.overview,
                files.map(f => f.path)
            );
            const newAiMessage: ChatMessage = { role: 'ai', content: aiResponse };
            const finalHistory = [...newHistory, newAiMessage];
            setChatHistory(finalHistory);
            if(activity) {
                onUpdateActivity({ ...activity, projectChatHistory: finalHistory });
            }
        } catch (err) {
            const msg = err instanceof Error ? err.message : "Failed to get response from AI.";
            setChatError(msg);
            const errorAiMessage: ChatMessage = { role: 'ai', content: `Error: ${msg}` };
            setChatHistory(prev => [...prev, errorAiMessage]);
        } finally {
            setIsChatLoading(false);
        }
    };
    
    const filteredFiles = analysis.fileBreakdown.filter(f => 
        f.path.toLowerCase().includes(searchTerm.toLowerCase())
    );

    const handleFileClick = (filePath: string) => {
        const fileData = files.find(f => f.path === filePath);
        if (fileData) {
            onAnalyzeFile(fileData);
        } else {
            toast.error(`Could not find file content for path: ${filePath}`);
        }
    };

    const TabButton: React.FC<{ tabId: ProjectResultTab; label: string; icon: string; disabled?: boolean; }> = ({ tabId, label, icon, disabled = false }) => (
        <button
            role="tab"
            aria-selected={activeTab === tabId}
            aria-controls={`tab-panel-${tabId}`}
            id={`tab-button-${tabId}`}
            disabled={disabled}
            onClick={() => setActiveTab(tabId)}
            className={`flex items-center gap-2 px-3 py-2 text-sm font-medium rounded-md transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-gray-800 focus:ring-indigo-500 ${activeTab === tabId ? 'bg-indigo-600 text-white' : 'text-gray-300 hover:bg-gray-700/60 hover:text-white'} ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
        >
            <span className="material-icons-outlined text-base">{icon}</span>
            {label}
        </button>
    );

    return (
        <div className="space-y-4">
             <section aria-labelledby="project-overview-title">
                <h3 id="project-overview-title" className="text-lg font-semibold text-white mb-3 flex items-center">
                    <span className="material-icons-outlined text-indigo-400 mr-2 text-xl">account_tree</span>
                    Project Analysis: {projectName.replace(/^Project:\s*/, '')}
                </h3>
                <div className="border-b border-gray-700 mb-4">
                    <nav className="flex flex-wrap items-center gap-2" role="tablist" aria-label="Project Analysis Sections">
                        <TabButton tabId="overview" label="Overview" icon="summarize" />
                        <TabButton tabId="dependencies" label="Dependencies" icon="hub" disabled={!packageJsonFile} />
                        <TabButton tabId="architecture" label="Architecture" icon="schema" />
                        <TabButton tabId="chat" label="Chat" icon="question_answer" />
                    </nav>
                </div>
            </section>

            {activeTab === 'overview' && (
                <div role="tabpanel" id="tab-panel-overview" aria-labelledby="tab-button-overview" className="space-y-6">
                    <div>
                         <h4 className="text-md font-semibold text-gray-100 mb-2">Project Summary</h4>
                         <div className="bg-gray-700/20 p-3 sm:p-4 rounded-lg border border-gray-600/40">
                            <p className="text-sm text-gray-300 leading-relaxed whitespace-pre-wrap">{analysis.overview}</p>
                        </div>
                    </div>
                    <div>
                        <div className="flex justify-between items-center mb-2">
                             <h4 className="text-md font-semibold text-gray-100">Generated README.md</h4>
                             <button onClick={handleGenerateReadme} disabled={isReadmeLoading} className="bg-indigo-600 hover:bg-indigo-700 text-white font-medium py-1 px-3 rounded-md flex items-center gap-1.5 transition-colors text-xs shadow focus:outline-none focus:ring-2 focus:ring-indigo-500 ring-offset-1 ring-offset-gray-800 disabled:opacity-60 disabled:cursor-wait">
                                {isReadmeLoading ? <div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin"></div> : <span className="material-icons-outlined text-sm">auto_stories</span>}
                                <span>{isReadmeLoading ? 'Generating...' : (readmeContent ? 'Regenerate' : 'Generate README')}</span>
                             </button>
                        </div>
                        {readmeError && <ErrorMessage message={readmeError} />}
                        {readmeContent && !isReadmeLoading && <div className="mt-2"><CodeBlock code={readmeContent} language="markdown" /></div>}
                    </div>
                    <div>
                        <h4 className="text-md font-semibold text-gray-100 mb-3">File Breakdown</h4>
                        <div className="relative mb-3">
                            <span className="material-icons-outlined absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-lg">search</span>
                            <input type="text" placeholder="Search files..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="w-full bg-gray-700/80 border border-gray-600 text-gray-200 rounded-md py-2 px-3 pl-10 text-sm focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 placeholder-gray-500" />
                        </div>
                        <div className="space-y-2 max-h-[50vh] overflow-y-auto custom-scrollbar-small pr-2">
                            {filteredFiles.map(file => (
                                <div key={file.path} className="p-3 bg-gray-700/40 rounded-md hover:bg-gray-700/60">
                                    <div className="flex justify-between items-start gap-3">
                                        <div className="flex-grow overflow-hidden">
                                            <div className="flex items-center text-sm font-medium text-indigo-300 font-fira-code mb-1"><span className="material-icons-outlined text-base mr-2">{getFileIcon(file.path)}</span><span className="truncate">{file.path}</span></div>
                                            <p className="text-xs text-gray-400 pl-7">{file.description}</p>
                                        </div>
                                        <button onClick={() => handleFileClick(file.path)} className="bg-gray-600 hover:bg-indigo-600 text-white font-medium py-1 px-2.5 rounded-md flex items-center gap-1 transition-colors text-xs shadow shrink-0">
                                            <span className="material-icons-outlined text-sm">analytics</span>Analyze
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            )}
            
            {activeTab === 'dependencies' && (
                <div role="tabpanel" id="tab-panel-dependencies" aria-labelledby="tab-button-dependencies" className="space-y-4">
                    {isDepsLoading && <p className="text-sm text-gray-400 italic">Analyzing dependencies...</p>}
                    {depsError && <ErrorMessage message={depsError} />}
                    {dependencies && dependencies.length > 0 && dependencies.map(dep => (
                        <div key={dep.name} className="p-3 bg-gray-700/40 rounded-md border border-gray-600/60">
                            <h5 className="font-semibold text-sm text-indigo-300 font-fira-code">{dep.name}</h5>
                            <p className="text-xs text-gray-300 mt-1">{dep.description}</p>
                        </div>
                    ))}
                     {dependencies && dependencies.length === 0 && <p className="text-sm text-gray-400">No dependencies found or listed in package.json.</p>}
                </div>
            )}

             {activeTab === 'architecture' && (
                <div role="tabpanel" id="tab-panel-architecture" aria-labelledby="tab-button-architecture" className="space-y-4">
                    {isArchLoading && <p className="text-sm text-gray-400 italic">Analyzing project architecture...</p>}
                    {archError && <ErrorMessage message={archError} />}
                    {dependencyInfo && <ArchitectureGraph data={dependencyInfo} />}
                </div>
            )}

            {activeTab === 'chat' && (
                <div role="tabpanel" id="tab-panel-chat" aria-labelledby="tab-button-chat" className="flex flex-col h-[70vh]">
                     <div className="flex-grow p-3 space-y-4 overflow-y-auto custom-scrollbar-small bg-gray-700/20 rounded-t-lg border border-b-0 border-gray-600/50">
                        {chatHistory.map((msg, index) => (
                             <div key={index} className={`flex items-start gap-2.5 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                                {msg.role === 'ai' && <span className="material-icons-outlined text-indigo-400 text-lg flex-shrink-0 mt-1">assistant</span>}
                                <div className={`max-w-md p-2.5 rounded-lg text-sm leading-normal ${msg.role === 'user' ? 'bg-indigo-600 text-white' : 'bg-gray-600 text-gray-200'}`}><p className="whitespace-pre-wrap">{msg.content}</p></div>
                             </div>
                        ))}
                        {isChatLoading && <div className="flex items-start gap-2.5"><span className="material-icons-outlined text-indigo-400 text-lg flex-shrink-0 mt-1">assistant</span><div className="bg-gray-600 p-2.5 rounded-lg flex items-center space-x-1.5"><span className="w-2 h-2 bg-gray-400 rounded-full animate-pulse"></span><span className="w-2 h-2 bg-gray-400 rounded-full animate-pulse delay-200"></span><span className="w-2 h-2 bg-gray-400 rounded-full animate-pulse delay-400"></span></div></div>}
                        {chatError && <ErrorMessage message={chatError} />}
                    </div>
                    <div className="flex items-center gap-2 p-3 bg-gray-700/40 rounded-b-lg border border-t-0 border-gray-600/50">
                        <textarea value={userMessage} onChange={e => setUserMessage(e.target.value)} onKeyDown={e => {if(e.key === 'Enter' && !e.shiftKey) {e.preventDefault(); handleSendMessage();}}} placeholder="Ask about the project..." className="flex-grow w-full bg-gray-700/80 border border-gray-600 text-gray-200 rounded-md p-2.5 text-sm focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 placeholder-gray-500 transition-colors custom-scrollbar-small resize-none" rows={1} disabled={isChatLoading} />
                        <button onClick={handleSendMessage} disabled={isChatLoading || !userMessage.trim()} className="bg-indigo-600 hover:bg-indigo-700 text-white p-2.5 rounded-md flex items-center justify-center transition-colors disabled:bg-gray-600"><span className="material-icons-outlined text-lg">send</span></button>
                    </div>
                </div>
            )}
        </div>
    );
};