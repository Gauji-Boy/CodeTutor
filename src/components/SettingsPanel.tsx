

import React from 'react';
import toast from 'react-hot-toast';
import { ExampleDifficultyLevels, ExampleDifficultyDisplayNames, ActivityItem } from '../types';
import { useGlobalSettings } from '../hooks/useGlobalSettings';

interface SettingsPanelProps {
    onAddActivity: (activity: ActivityItem) => void;
    onClearAllActivities: () => void;
}

const SettingsPanelComponent: React.FC<SettingsPanelProps> = ({ onAddActivity, onClearAllActivities }) => {
    const { preferredInitialDifficulty, setPreferredInitialDifficulty, preferredInstructionFormat, setPreferredInstructionFormat, defaultPracticeDifficulty, setDefaultPracticeDifficulty } = useGlobalSettings();

    const renderPlaceholder = (text: string) => (
        <p className="px-2 py-1 text-xs text-gray-500 italic">{text}</p>
    );

    const handleClearData = () => {
        if (window.confirm("Are you sure you want to clear all recent activity and analysis summary data? This action cannot be undone.")) {
            onClearAllActivities();
            // Removed the onAddActivity call for "All Activity Data Cleared"
            toast.success("All activity data has been cleared.");
        } else {
            toast.error("Data clearing cancelled.", { icon: 'ℹ️' });
        }
    };

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
                    <h4 id="general-settings-title" className="text-xs font-semibold text-indigo-300 mb-1.5 px-1">General</h4>
                    <fieldset>
                        <legend id="difficulty-legend-popover" className="block text-xs font-normal text-gray-300 mb-1.5 px-1">
                            Default Example Difficulty:
                        </legend>
                        <div className="flex flex-col space-y-1 sm:space-y-1.5" role="radiogroup" aria-labelledby="difficulty-legend-popover">
                            {ExampleDifficultyLevels.map((level) => (
                                <button
                                    key={level}
                                    type="button"
                                    role="radio"
                                    aria-checked={preferredInitialDifficulty === level}
                                    onClick={() => setPreferredInitialDifficulty(level)}
                                    className={`w-full px-2 py-1 rounded text-xs font-medium transition-colors duration-150 focus:outline-none focus:ring-1 focus:ring-offset-1 focus:ring-offset-gray-700
                                        ${preferredInitialDifficulty === level
                                            ? 'bg-indigo-600 text-white hover:bg-indigo-700 focus:ring-indigo-500'
                                            : 'bg-gray-600 hover:bg-gray-500 text-gray-200 focus:ring-indigo-600'
                                        }`}
                                    aria-label={`Set default example difficulty to ${ExampleDifficultyDisplayNames[level]}`}
                                >
                                    {ExampleDifficultyDisplayNames[level]}
                                </button>
                            ))}
                        </div>
                    </fieldset>
                    
                    <fieldset className="mt-3">
                        <legend id="practice-difficulty-legend" className="block text-xs font-normal text-gray-300 mb-1.5 px-1">
                            Default Practice Question Difficulty:
                        </legend>
                        <div className="flex flex-col space-y-1 sm:space-y-1.5" role="radiogroup" aria-labelledby="practice-difficulty-legend">
                            {ExampleDifficultyLevels.map((level) => (
                                <button
                                    key={level}
                                    type="button"
                                    role="radio"
                                    aria-checked={defaultPracticeDifficulty === level}
                                    onClick={() => setDefaultPracticeDifficulty(level)}
                                    className={`w-full px-2 py-1 rounded text-xs font-medium transition-colors duration-150 focus:outline-none focus:ring-1 focus:ring-offset-1 focus:ring-offset-gray-700
                                        ${defaultPracticeDifficulty === level
                                            ? 'bg-indigo-600 text-white hover:bg-indigo-700 focus:ring-indigo-500'
                                            : 'bg-gray-600 hover:bg-gray-500 text-gray-200 focus:ring-indigo-600'
                                        }`}
                                    aria-label={`Set default practice question difficulty to ${ExampleDifficultyDisplayNames[level]}`}
                                >
                                    {ExampleDifficultyDisplayNames[level]}
                                </button>
                            ))}
                        </div>
                    </fieldset>

                    <fieldset className="mt-3">
                        <legend id="instruction-format-legend" className="block text-xs font-normal text-gray-300 mb-1.5 px-1">
                            Default Instruction Format:
                        </legend>
                        <div className="flex flex-col space-y-1 sm:space-y-1.5" role="radiogroup" aria-labelledby="instruction-format-legend">
                            {(['normal', 'line-by-line'] as const).map((format) => (
                                <button
                                    key={format}
                                    type="button"
                                    role="radio"
                                    aria-checked={preferredInstructionFormat === format}
                                    onClick={() => setPreferredInstructionFormat(format)}
                                    className={`w-full px-2 py-1 rounded text-xs font-medium transition-colors duration-150 focus:outline-none focus:ring-1 focus:ring-offset-1 focus:ring-offset-gray-700
                                        ${preferredInstructionFormat === format
                                            ? 'bg-indigo-600 text-white hover:bg-indigo-700 focus:ring-indigo-500'
                                            : 'bg-gray-600 hover:bg-gray-500 text-gray-200 focus:ring-indigo-600'
                                        }`}
                                >
                                    {format === 'normal' ? 'Normal (Conceptual)' : 'Line-by-Line (Code)'}
                                </button>
                            ))}
                        </div>
                    </fieldset>

                </section>
                
                <hr className="border-gray-600/70" />

                {/* Section 4: Data Management */}
                <section aria-labelledby="data-management-title">
                    <h4 id="data-management-title" className="text-xs font-semibold text-red-400 mb-1.5 px-1">Data Management</h4>
                    <button
                        type="button"
                        onClick={handleClearData}
                        className="w-full px-2 py-1.5 rounded text-xs font-medium bg-red-600 hover:bg-red-700 text-white focus:outline-none focus:ring-1 focus:ring-offset-1 focus:ring-offset-gray-700 focus:ring-red-500 flex items-center justify-center space-x-1.5 transition-colors"
                        aria-label="Clear all activity data"
                    >
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