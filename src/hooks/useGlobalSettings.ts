
import { useState, useEffect, useCallback } from 'react';
import { ExampleDifficulty, GlobalSettings } from '../types';

const GLOBAL_SETTINGS_KEY = 'codeTutorGlobalSettings';

const defaultSettings: GlobalSettings = {
    preferredInitialDifficulty: 'easy', // Changed from 'intermediate' to 'easy'
};

export const useGlobalSettings = () => {
    const [settings, setSettings] = useState<GlobalSettings>(() => {
        try {
            const storedSettings = localStorage.getItem(GLOBAL_SETTINGS_KEY);
            if (storedSettings) {
                const parsed = JSON.parse(storedSettings) as Partial<GlobalSettings>;
                // Ensure all keys are present, falling back to defaults if necessary
                return {
                    preferredInitialDifficulty: parsed.preferredInitialDifficulty && ['easy', 'intermediate', 'hard'].includes(parsed.preferredInitialDifficulty)
                        ? parsed.preferredInitialDifficulty
                        : defaultSettings.preferredInitialDifficulty,
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

    return {
        preferredInitialDifficulty: settings.preferredInitialDifficulty,
        setPreferredInitialDifficulty,
    };
};