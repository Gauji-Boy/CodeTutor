
import React, { useState, useRef, useCallback } from 'react';
import toast from 'react-hot-toast';
import { ExampleDifficultyLevels, ExampleDifficultyDisplayNames, GlobalSettings, TopicExplanationVisibility, FontSize, FontFamily, CodeFontFamily, AiModel } from '../types';
import { useGlobalSettings } from '../hooks/useGlobalSettings';
import { ToggleSwitch } from './ToggleSwitch';

interface SettingsPanelProps {
    onClearAllActivities: () => void;
}

type SettingsTab = 'general' | 'ai' | 'interface' | 'data';

const InfoTooltip: React.FC<{ text: string }> = ({ text }) => (
    <div className="relative group flex items-center">
        <span className="material-icons-outlined text-gray-400 text-xs cursor-help">info</span>
        <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-48 bg-gray-800 text-white text-xs rounded-md p-2 shadow-lg opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10 border border-gray-600">
            {text}
        </div>
    </div>
);

const SettingsPanelComponent: React.FC<SettingsPanelProps> = ({ onClearAllActivities }) => {
    const { 
        preferredInitialDifficulty, setPreferredInitialDifficulty, 
        preferredInstructionFormat, setPreferredInstructionFormat, 
        defaultPracticeDifficulty, setDefaultPracticeDifficulty,
        visibleSections, toggleVisibility,
        preferredModel, setPreferredModel,
        customSystemInstruction, setCustomSystemInstruction,
        temperature, setTemperature,
        topP, setTopP,
        fontSize, setFontSize,
        fontFamily, setFontFamily,
        codeFontFamily, setCodeFontFamily,
        reduceMotion, setReduceMotion,
        resetSettings,
        importSettings,
        settings // Get the whole settings object for export
    } = useGlobalSettings();

    const [activeTab, setActiveTab] = useState<SettingsTab>('general');
    const [isTopicDetailsExpanded, setIsTopicDetailsExpanded] = useState(false);
    const importFileInputRef = useRef<HTMLInputElement>(null);

    const handleClearData = () => {
        if (window.confirm("Are you sure you want to clear all recent activity data? This action cannot be undone.")) {
            onClearAllActivities();
        }
    };
    
    const handleResetAllSettings = () => {
        if (window.confirm("Are you sure you want to reset ALL settings to their default values?")) {
            resetSettings();
            toast.success("All settings have been reset to default.");
        }
    };

    const handleExportSettings = () => {
        try {
            const settingsJson = JSON.stringify(settings, null, 2);
            const blob = new Blob([settingsJson], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `codetutor-ai-settings-${new Date().toISOString().split('T')[0]}.json`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
            toast.success("Settings exported successfully!");
        } catch (error) {
            toast.error("Failed to export settings.");
            console.error("Export settings error:", error);
        }
    };

    const handleImportClick = () => {
        importFileInputRef.current?.click();
    };

    const handleFileImport = (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;
        
        const reader = new FileReader();
        reader.onload = (e) => {
            const text = e.target?.result;
            if (typeof text === 'string') {
                importSettings(text);
            } else {
                toast.error("Could not read the imported file.");
            }
        };
        reader.onerror = () => toast.error("Error reading file.");
        reader.readAsText(file);
        event.target.value = ''; // Reset input to allow re-importing same file
    };

    const TabButton: React.FC<{ tabId: SettingsTab, label: string }> = ({ tabId, label }) => (
        <button
            onClick={() => setActiveTab(tabId)}
            className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors ${activeTab === tabId ? 'bg-indigo-600 text-white' : 'hover:bg-gray-600/70 text-gray-300'}`}
        >
            {label}
        </button>
    );

    const renderGeneralTab = () => (
        <div className="space-y-4">
            <fieldset>
                <legend className="text-xs font-semibold text-indigo-300 mb-1.5 px-1">Analysis & Practice</legend>
                <div className="space-y-3">
                    <div>
                        <label className="block text-xs text-gray-300 mb-1 px-1">Default Example Difficulty</label>
                        <select value={preferredInitialDifficulty} onChange={e => setPreferredInitialDifficulty(e.target.value as any)} className="w-full bg-gray-600 border-gray-500 text-gray-200 rounded p-1 text-xs focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500">
                            {ExampleDifficultyLevels.map(level => <option key={level} value={level}>{ExampleDifficultyDisplayNames[level]}</option>)}
                        </select>
                    </div>
                    <div>
                        <label className="block text-xs text-gray-300 mb-1 px-1">Default Practice Difficulty</label>
                        <select value={defaultPracticeDifficulty} onChange={e => setDefaultPracticeDifficulty(e.target.value as any)} className="w-full bg-gray-600 border-gray-500 text-gray-200 rounded p-1 text-xs focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500">
                           {ExampleDifficultyLevels.map(level => <option key={level} value={level}>{ExampleDifficultyDisplayNames[level]}</option>)}
                        </select>
                    </div>
                     <div>
                        <label className="block text-xs text-gray-300 mb-1 px-1">Default Instruction Format</label>
                        <select value={preferredInstructionFormat} onChange={e => setPreferredInstructionFormat(e.target.value as any)} className="w-full bg-gray-600 border-gray-500 text-gray-200 rounded p-1 text-xs focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500">
                            <option value="normal">Conceptual</option>
                            <option value="line-by-line">Line-by-Line (Code)</option>
                        </select>
                    </div>
                </div>
            </fieldset>
            <button type="button" onClick={() => resetSettings('general')} className="w-full text-xs text-indigo-300 hover:text-white hover:bg-gray-600 p-1 rounded-md transition-colors">Reset General Settings</button>
        </div>
    );
    
    const renderAiBehaviorTab = () => (
        <div className="space-y-4">
            <fieldset>
                 <legend className="text-xs font-semibold text-indigo-300 mb-1.5 px-1">Model Configuration</legend>
                 <div className="space-y-3">
                    <div>
                        <label className="flex items-center gap-1 text-xs text-gray-300 mb-1 px-1">
                           AI Model
                           <InfoTooltip text="Auto mode selects the best model for the task: Flash for quick analyses and Pro for complex tasks like debugging or project overviews." />
                        </label>
                        <select value={preferredModel} onChange={e => setPreferredModel(e.target.value as AiModel)} className="w-full bg-gray-600 border-gray-500 text-gray-200 rounded p-1 text-xs focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500">
                            <option value="auto">Auto (Recommended)</option>
                            <option value="gemini-2.5-flash">Gemini 2.5 Flash (Fast)</option>
                            <option value="gemini-2.5-pro">Gemini 2.5 Pro (Advanced)</option>
                        </select>
                    </div>
                    <div>
                        <label className="block text-xs text-gray-300 mb-1 px-1">Custom System Instruction</label>
                        <textarea value={customSystemInstruction} onChange={e => setCustomSystemInstruction(e.target.value)} rows={3} className="w-full bg-gray-600 border-gray-500 text-gray-200 rounded p-1 text-xs focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 custom-scrollbar-small" placeholder="e.g., Explain concepts for a beginner..."></textarea>
                    </div>
                    <div>
                        <label className="flex items-center gap-1 text-xs text-gray-300 mb-1 px-1">Temperature: <span className="font-mono text-indigo-300">{temperature.toFixed(2)}</span> <InfoTooltip text="Controls randomness. Lower values are more deterministic." /></label>
                        <input type="range" min="0" max="1" step="0.05" value={temperature} onChange={e => setTemperature(parseFloat(e.target.value))} className="w-full h-1.5 accent-indigo-500" />
                    </div>
                     <div>
                        <label className="flex items-center gap-1 text-xs text-gray-300 mb-1 px-1">Top-P: <span className="font-mono text-indigo-300">{topP.toFixed(2)}</span> <InfoTooltip text="Controls diversity. Lower values are less random." /></label>
                        <input type="range" min="0" max="1" step="0.05" value={topP} onChange={e => setTopP(parseFloat(e.target.value))} className="w-full h-1.5 accent-indigo-500" />
                    </div>
                 </div>
            </fieldset>
            <button type="button" onClick={() => resetSettings('ai')} className="w-full text-xs text-indigo-300 hover:text-white hover:bg-gray-600 p-1 rounded-md transition-colors">Reset AI Settings</button>
        </div>
    );
    
    const renderInterfaceTab = () => (
         <div className="space-y-4">
            <fieldset>
                 <legend className="text-xs font-semibold text-indigo-300 mb-1.5 px-1">Appearance & Accessibility</legend>
                 <div className="space-y-3">
                    <div>
                        <label className="block text-xs text-gray-300 mb-1 px-1">UI Font Size</label>
                        <select value={fontSize} onChange={e => setFontSize(e.target.value as FontSize)} className="w-full bg-gray-600 border-gray-500 text-gray-200 rounded p-1 text-xs focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500">
                            <option value="sm">Small</option>
                            <option value="base">Medium</option>
                            <option value="lg">Large</option>
                        </select>
                    </div>
                    <div>
                        <label className="block text-xs text-gray-300 mb-1 px-1">UI Font Family</label>
                        <select value={fontFamily} onChange={e => setFontFamily(e.target.value as FontFamily)} className="w-full bg-gray-600 border-gray-500 text-gray-200 rounded p-1 text-xs focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500">
                            <option value="inter">Inter (Sans-serif)</option>
                            <option value="lexend">Lexend (Sans-serif)</option>
                            <option value="roboto-slab">Roboto Slab (Serif)</option>
                        </select>
                    </div>
                     <div>
                        <label className="block text-xs text-gray-300 mb-1 px-1">Code Font Family</label>
                        <select value={codeFontFamily} onChange={e => setCodeFontFamily(e.target.value as CodeFontFamily)} className="w-full bg-gray-600 border-gray-500 text-gray-200 rounded p-1 text-xs focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500">
                            <option value="fira-code">Fira Code</option>
                            <option value="jetbrains-mono">JetBrains Mono</option>
                        </select>
                    </div>
                    <div className="p-1">
                        <ToggleSwitch id="reduce-motion-toggle" label="Reduce Motion" checked={reduceMotion} onChange={() => setReduceMotion(!reduceMotion)} />
                    </div>
                 </div>
            </fieldset>
            <button type="button" onClick={() => resetSettings('interface')} className="w-full text-xs text-indigo-300 hover:text-white hover:bg-gray-600 p-1 rounded-md transition-colors">Reset Interface Settings</button>
        </div>
    );

    const renderDataTab = () => (
         <div className="space-y-4">
            <fieldset>
                 <legend className="text-xs font-semibold text-indigo-300 mb-1.5 px-1">Data Management</legend>
                 <div className="space-y-2">
                    <button onClick={handleExportSettings} className="w-full text-xs flex items-center justify-center gap-1.5 bg-gray-600 hover:bg-gray-500 p-1.5 rounded-md transition-colors">
                        <span className="material-icons-outlined text-sm">download</span>Export Settings
                    </button>
                    <button onClick={handleImportClick} className="w-full text-xs flex items-center justify-center gap-1.5 bg-gray-600 hover:bg-gray-500 p-1.5 rounded-md transition-colors">
                        <span className="material-icons-outlined text-sm">upload</span>Import Settings
                    </button>
                    <input type="file" ref={importFileInputRef} onChange={handleFileImport} accept=".json" className="hidden" />
                 </div>
            </fieldset>
            <fieldset>
                 <legend className="text-xs font-semibold text-red-400 mb-1.5 px-1">Danger Zone</legend>
                  <div className="space-y-2">
                    <button onClick={handleResetAllSettings} className="w-full text-xs flex items-center justify-center gap-1.5 bg-yellow-600/20 hover:bg-yellow-600/40 text-yellow-300 p-1.5 rounded-md transition-colors">
                        <span className="material-icons-outlined text-sm">restart_alt</span>Reset All Settings
                    </button>
                    <button onClick={handleClearData} className="w-full text-xs flex items-center justify-center gap-1.5 bg-red-600/20 hover:bg-red-600/40 text-red-300 p-1.5 rounded-md transition-colors">
                        <span className="material-icons-outlined text-sm">delete_sweep</span>Clear All Activity
                    </button>
                  </div>
            </fieldset>
        </div>
    );

    return (
        <div className="bg-gray-700/90 backdrop-blur-sm border border-gray-600/70 rounded-lg shadow-xl p-3 w-64 sm:w-72">
            <header className="mb-2 border-b border-gray-600/80 pb-2 flex justify-between items-center">
                <h3 id="settings-panel-title" className="text-sm font-medium text-white flex items-center">
                    <span className="material-icons-outlined text-indigo-400 mr-1.5 text-base">settings</span>
                    Settings
                </h3>
            </header>

            <div className="flex items-center justify-around bg-gray-800/50 p-1 rounded-md mb-3">
                <TabButton tabId="general" label="General" />
                <TabButton tabId="ai" label="AI" />
                <TabButton tabId="interface" label="UI" />
                <TabButton tabId="data" label="Data" />
            </div>

            <div className="max-h-96 overflow-y-auto custom-scrollbar-small pr-1.5">
                {activeTab === 'general' && renderGeneralTab()}
                {activeTab === 'ai' && renderAiBehaviorTab()}
                {activeTab === 'interface' && renderInterfaceTab()}
                {activeTab === 'data' && renderDataTab()}
            </div>
        </div>
    );
};

export const SettingsPanel = React.memo(SettingsPanelComponent);