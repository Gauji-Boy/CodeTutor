

import { useState, useEffect, useCallback } from 'react';
import { ExampleDifficulty, GlobalSettings } from '../types';

const GLOBAL_SETTINGS_KEY = 'codeTutorGlobalSettings';

const defaultSettings: GlobalSettings = {
    preferredInitialDifficulty: 'easy',
    isLeftPanelCollapsed: false,
    preferredInstructionFormat: 'normal',
    defaultPracticeDifficulty: 'intermediate',
};

export const useGlobalSettings = () => {
    const [settings, setSettings] = useState<GlobalSettings>(() => {
        try {
            const storedSettings = localStorage.getItem(GLOBAL_SETTINGS_KEY);
            if (storedSettings) {
                const parsed = JSON.parse(storedSettings) as Partial<GlobalSettings>;
                return {
                    preferredInitialDifficulty: parsed.preferredInitialDifficulty && ['easy', 'intermediate', 'hard'].includes(parsed.preferredInitialDifficulty)
                        ? parsed.preferredInitialDifficulty
                        : defaultSettings.preferredInitialDifficulty,
                    isLeftPanelCollapsed: typeof parsed.isLeftPanelCollapsed === 'boolean'
                        ? parsed.isLeftPanelCollapsed
                        : defaultSettings.isLeftPanelCollapsed,
                    preferredInstructionFormat: parsed.preferredInstructionFormat && ['normal', 'line-by-line'].includes(parsed.preferredInstructionFormat)
                        ? parsed.preferredInstructionFormat
                        : defaultSettings.preferredInstructionFormat,
                    defaultPracticeDifficulty: parsed.defaultPracticeDifficulty && ['easy', 'intermediate', 'hard'].includes(parsed.defaultPracticeDifficulty)
                        ? parsed.defaultPracticeDifficulty
                        : defaultSettings.defaultPracticeDifficulty,
                };
            }
        } catch (error) {
            console.error("Error loading settings from localStorage:", error);
        }
        return defaultSettings;
    });

    useEffect(() => {
        try {
            localStorage.setItem(GLOBAL_SETTINGS_KEY, JSON.stringify(settings));
        } catch (error) {
            console.error("Error saving settings to localStorage:", error);
        }
    }, [settings]);

    const setPreferredInitialDifficulty = useCallback((difficulty: ExampleDifficulty) => {
        setSettings(prevSettings => ({
            ...prevSettings,
            preferredInitialDifficulty: difficulty,
        }));
    }, []);

    const setIsLeftPanelCollapsed = useCallback((isCollapsed: boolean) => {
        setSettings(prevSettings => ({
            ...prevSettings,
            isLeftPanelCollapsed: isCollapsed,
        }));
    }, []);

    const setPreferredInstructionFormat = useCallback((format: 'normal' | 'line-by-line') => {
        setSettings(prevSettings => ({
            ...prevSettings,
            preferredInstructionFormat: format,
        }));
    }, []);

    const setDefaultPracticeDifficulty = useCallback((difficulty: ExampleDifficulty) => {
        setSettings(prevSettings => ({
            ...prevSettings,
            defaultPracticeDifficulty: difficulty,
        }));
    }, []);


    return {
        preferredInitialDifficulty: settings.preferredInitialDifficulty,
        setPreferredInitialDifficulty,
        isLeftPanelCollapsed: settings.isLeftPanelCollapsed ?? false,
        setIsLeftPanelCollapsed,
        preferredInstructionFormat: settings.preferredInstructionFormat,
        setPreferredInstructionFormat,
        defaultPracticeDifficulty: settings.defaultPracticeDifficulty,
        setDefaultPracticeDifficulty,
    };
};