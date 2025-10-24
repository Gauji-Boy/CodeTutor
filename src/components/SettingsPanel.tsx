import React, { useState } from 'react';
import toast from 'react-hot-toast';
import { ExampleDifficultyLevels, ExampleDifficultyDisplayNames, ActivityItem, GlobalSettings, TopicExplanationVisibility } from '../types';
import { useGlobalSettings } from '../hooks/useGlobalSettings';

interface SettingsPanelProps {
    onUpdateActivity: (activity: ActivityItem) => void;
    onClearAllActivities: () => void;
}

const SettingsPanelComponent: React.FC<SettingsPanelProps> = ({ onUpdateActivity, onClearAllActivities }) => {
    const { 
        preferredInitialDifficulty, setPreferredInitialDifficulty, 
        preferredInstructionFormat, setPreferredInstructionFormat, 
        defaultPracticeDifficulty, setDefaultPracticeDifficulty,
        visibleSections, toggleVisibility
    } = useGlobalSettings();

    const [isTopicDetailsExpanded, setIsTopicDetailsExpanded] = useState(false);

    const topicSubSections: { key: keyof Omit<TopicExplanationVisibility, 'masterToggle'>, label: string }[] = [
        { key: 'coreConcepts', label: 'Core Concepts' },
        { key: 'blockByBlock', label: 'Block-by-Block' },
        { key: 'lineByLine', label: 'Line-by-Line' },
        { key: 'executionFlow', label: 'Execution Flow' },
        { key: 'followUp', label: 'Follow-up Q&A' },
    ];
    
    const otherSections: { key: keyof Omit<GlobalSettings['visibleSections'], 'topicExplanation'>, label: string }[] = [
        { key: 'exampleCode', label: 'Example Code' },
        { key: 'practiceQuestion', label: 'Practice Question' },
        { key: 'instructionsToSolve', label: 'Instructions to Solve' },
    ];

    const handleClearData = () => {
        if (window.confirm("Are you sure you want to clear all recent activity and analysis summary data? This action cannot be undone.")) {
            onClearAllActivities();
            toast.success("All activity data has been cleared.");
        } else {
            toast.error("Data clearing cancelled.", { icon: 'ℹ️' });
        }
    };

    const ToggleSwitch: React.FC<{id: string; checked: boolean; onChange: () => void; disabled?: boolean}> = ({ id, checked, onChange, disabled }) => (
         <button
            id={id}
            type="button"
            role="switch"
            aria-checked={checked}
            onClick={onChange}
            disabled={disabled}
            className={`${checked ? 'bg-indigo-600' : 'bg-gray-500'} relative inline-flex h-4 w-8 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:ring-offset-2 focus:ring-offset-gray-700 disabled:opacity-50 disabled:cursor-not-allowed`}
        >
            <span aria-hidden="true" className={`${checked ? 'translate-x-4' : 'translate-x-0'} pointer-events-none inline-block h-3 w-3 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out`}></span>
        </button>
    );

    return (
        <div className="bg-gray-700/90 backdrop-blur-sm border border-gray-600/70 rounded-lg shadow-xl p-3.5 w-64 sm:w-72">
            <header className="mb-3 border-b border-gray-600/80 pb-2">
                <h3 id="settings-panel-title" className="text-sm font-medium text-white flex items-center">
                    <span className="material-icons-outlined text-indigo-400 mr-1.5 text-base">settings</span>
                    Application Settings
                </h3>
            </header>

            <div className="space-y-4">
                {/* Section 1: General Settings */}
                <section aria-labelledby="general-settings-title">
                    <h4 id="general-settings-title" className="text-xs font-semibold text-indigo-300 mb-1.5 px-1">Defaults</h4>
                    <fieldset>
                        <legend id="difficulty-legend-popover" className="block text-xs font-normal text-gray-300 mb-1.5 px-1">Default Example Difficulty:</legend>
                        <div className="flex flex-col space-y-1 sm:space-y-1.5" role="radiogroup" aria-labelledby="difficulty-legend-popover">
                            {ExampleDifficultyLevels.map((level) => (
                                <button key={level} type="button" role="radio" aria-checked={preferredInitialDifficulty === level} onClick={() => setPreferredInitialDifficulty(level)} className={`w-full px-2 py-1 rounded text-xs font-medium transition-colors duration-150 focus:outline-none focus:ring-1 focus:ring-offset-1 focus:ring-offset-gray-700 ${preferredInitialDifficulty === level ? 'bg-indigo-600 text-white hover:bg-indigo-700 focus:ring-indigo-500' : 'bg-gray-600 hover:bg-gray-500 text-gray-200 focus:ring-indigo-600'}`} aria-label={`Set default example difficulty to ${ExampleDifficultyDisplayNames[level]}`}>
                                    {ExampleDifficultyDisplayNames[level]}
                                </button>
                            ))}
                        </div>
                    </fieldset>
                    
                    <fieldset className="mt-3">
                        <legend id="practice-difficulty-legend" className="block text-xs font-normal text-gray-300 mb-1.5 px-1">Default Practice Difficulty:</legend>
                        <div className="flex flex-col space-y-1 sm:space-y-1.5" role="radiogroup" aria-labelledby="practice-difficulty-legend">
                            {ExampleDifficultyLevels.map((level) => (
                                <button key={level} type="button" role="radio" aria-checked={defaultPracticeDifficulty === level} onClick={() => setDefaultPracticeDifficulty(level)} className={`w-full px-2 py-1 rounded text-xs font-medium transition-colors duration-150 focus:outline-none focus:ring-1 focus:ring-offset-1 focus:ring-offset-gray-700 ${defaultPracticeDifficulty === level ? 'bg-indigo-600 text-white hover:bg-indigo-700 focus:ring-indigo-500' : 'bg-gray-600 hover:bg-gray-500 text-gray-200 focus:ring-indigo-600'}`} aria-label={`Set default practice question difficulty to ${ExampleDifficultyDisplayNames[level]}`}>
                                    {ExampleDifficultyDisplayNames[level]}
                                </button>
                            ))}
                        </div>
                    </fieldset>

                    <fieldset className="mt-3">
                        <legend id="instruction-format-legend" className="block text-xs font-normal text-gray-300 mb-1.5 px-1">Default Instruction Format:</legend>
                        <div className="flex flex-col space-y-1 sm:space-y-1.5" role="radiogroup" aria-labelledby="instruction-format-legend">
                            {(['normal', 'line-by-line'] as const).map((format) => (
                                <button key={format} type="button" role="radio" aria-checked={preferredInstructionFormat === format} onClick={() => setPreferredInstructionFormat(format)} className={`w-full px-2 py-1 rounded text-xs font-medium transition-colors duration-150 focus:outline-none focus:ring-1 focus:ring-offset-1 focus:ring-offset-gray-700 ${preferredInstructionFormat === format ? 'bg-indigo-600 text-white hover:bg-indigo-700 focus:ring-indigo-500' : 'bg-gray-600 hover:bg-gray-500 text-gray-200 focus:ring-indigo-600'}`}>
                                    {format === 'normal' ? 'Conceptual' : 'Line-by-Line (Code)'}
                                </button>
                            ))}
                        </div>
                    </fieldset>
                </section>
                
                <hr className="border-gray-600/70" />

                <section aria-labelledby="visibility-settings-title">
                    <h4 id="visibility-settings-title" className="text-xs font-semibold text-indigo-300 mb-1.5 px-1">Manage Visible Sections</h4>
                    <div className="space-y-1">
                        {/* Topic Explanation (collapsible) */}
                        <div className="bg-gray-600/30 rounded-md p-1">
                            <div className="flex items-center justify-between">
                                <label htmlFor="toggle-topicExplanation-master" className="text-xs text-gray-300 select-none flex-grow">Topic Explanation</label>
                                <div className="flex items-center">
                                    <button
                                        onClick={() => setIsTopicDetailsExpanded(prev => !prev)}
                                        className="p-1 rounded-full hover:bg-gray-500/50 text-gray-400 hover:text-white transition-colors"
                                        aria-expanded={isTopicDetailsExpanded}
                                        aria-controls="topic-explanation-sub-sections"
                                        title="Show/hide sub-sections"
                                    >
                                        <span className={`material-icons-outlined text-sm transition-transform duration-200 ${isTopicDetailsExpanded ? 'rotate-180' : ''}`}>expand_more</span>
                                    </button>
                                    <ToggleSwitch id="toggle-topicExplanation-master" checked={visibleSections.topicExplanation.masterToggle} onChange={() => toggleVisibility('topicExplanation')} />
                                </div>
                            </div>
                            {isTopicDetailsExpanded && (
                                <div id="topic-explanation-sub-sections" className="mt-2 pt-2 border-t border-gray-600/50 pl-4 space-y-2">
                                    {topicSubSections.map(({ key, label }) => (
                                        <div key={key} className="flex items-center justify-between">
                                            <label htmlFor={`toggle-${key}`} className="text-xs text-gray-400 select-none">{label}</label>
                                            <ToggleSwitch id={`toggle-${key}`} checked={visibleSections.topicExplanation[key]} onChange={() => toggleVisibility(key, true)} disabled={!visibleSections.topicExplanation.masterToggle} />
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                        
                        {/* Other sections */}
                        {otherSections.map(({ key, label }) => (
                            <div key={key} className="flex items-center justify-between p-1">
                                <label htmlFor={`toggle-${key}`} className="text-xs text-gray-300 select-none">{label}</label>
                                <ToggleSwitch id={`toggle-${key}`} checked={visibleSections[key]} onChange={() => toggleVisibility(key)} />
                            </div>
                        ))}
                    </div>
                </section>

                <hr className="border-gray-600/70" />

                <section aria-labelledby="data-management-title">
                    <h4 id="data-management-title" className="text-xs font-semibold text-red-400 mb-1.5 px-1">Data Management</h4>
                    <button type="button" onClick={handleClearData} className="w-full px-2 py-1.5 rounded text-xs font-medium bg-red-600 hover:bg-red-700 text-white focus:outline-none focus:ring-1 focus:ring-offset-1 focus:ring-offset-gray-700 focus:ring-red-500 flex items-center justify-center space-x-1.5 transition-colors" aria-label="Clear all activity data">
                        <span className="material-icons-outlined text-sm">delete_sweep</span>
                        <span>Clear All Activity Data</span>
                    </button>
                    <p className="text-xxs text-gray-400 mt-1 px-1">Clears recent activities and summary counts. This cannot be undone.</p>
                </section>
            </div>
        </div>
    );
};

export const SettingsPanel = React.memo(SettingsPanelComponent);