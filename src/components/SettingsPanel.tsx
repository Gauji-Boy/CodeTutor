
import React from 'react';
import { ExampleDifficultyLevels, ExampleDifficultyDisplayNames } from '../types';
import { useGlobalSettings } from '../hooks/useGlobalSettings';

interface SettingsPanelProps {}

export const SettingsPanel: React.FC<SettingsPanelProps> = () => {
    const { preferredInitialDifficulty, setPreferredInitialDifficulty } = useGlobalSettings();

    return (
        <div className="glassmorphism rounded-lg shadow-2xl p-4 w-64 sm:w-72">
            <h3 className="text-base font-medium text-white mb-3 border-b border-gray-700 pb-2.5 flex items-center">
                <span className="material-icons text-indigo-400 mr-2">tune</span>
                Settings
            </h3>
            <fieldset>
                <legend id="difficulty-legend-popover" className="block text-sm font-normal text-gray-300 mb-2">
                    Default Example Difficulty:
                </legend>
                <div className="flex flex-col space-y-1.5 sm:flex-row sm:space-y-0 sm:space-x-1.5" role="radiogroup" aria-labelledby="difficulty-legend-popover">
                    {ExampleDifficultyLevels.map((level) => (
                        <button
                            key={level}
                            type="button"
                            role="radio"
                            aria-checked={preferredInitialDifficulty === level}
                            onClick={() => setPreferredInitialDifficulty(level)}
                            className={`flex-1 px-2.5 py-1.5 rounded-md text-xs font-medium transition-colors duration-150 focus:outline-none focus:ring-2 focus:ring-offset-1 focus:ring-offset-gray-800
                                ${preferredInitialDifficulty === level
                                    ? 'bg-indigo-600 text-white hover:bg-indigo-700 focus:ring-indigo-500'
                                    : 'bg-gray-700 hover:bg-gray-600 text-gray-300 focus:ring-indigo-600'
                                }`}
                            aria-label={`Set default example difficulty to ${ExampleDifficultyDisplayNames[level]}`}
                        >
                            {ExampleDifficultyDisplayNames[level]}
                        </button>
                    ))}
                </div>
            </fieldset>
        </div>
    );
};
