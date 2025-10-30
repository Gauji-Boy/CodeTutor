
import { useState, useEffect, useCallback } from 'react';
import { toast } from 'react-hot-toast';
import { ExampleDifficulty, GlobalSettings, TopicExplanationVisibility, FontSize, FontFamily, CodeFontFamily, AiModel } from '../types';

const GLOBAL_SETTINGS_KEY = 'codeTutorGlobalSettings';

const defaultSettings: GlobalSettings = {
    // General
    preferredInitialDifficulty: 'easy',
    preferredInstructionFormat: 'normal',
    defaultPracticeDifficulty: 'intermediate',
    visibleSections: {
        topicExplanation: {
            masterToggle: true,
            coreConcepts: true,
            blockByBlock: true,
            lineByLine: true,
            executionFlow: true,
            followUp: true,
        },
        exampleCode: true,
        practiceQuestion: true,
        instructionsToSolve: true,
    },
    // AI Behavior
    preferredModel: 'auto',
    customSystemInstruction: '',
    temperature: 0.4,
    topP: 0.95,
    // Interface
    fontSize: 'base',
    fontFamily: 'inter',
    codeFontFamily: 'fira-code',
    reduceMotion: false,
    // System
    isLeftPanelCollapsed: false,
};

// Helper to safely merge loaded settings with defaults
const mergeSettings = (loaded: any): GlobalSettings => {
    const merged = { ...defaultSettings };
    for (const key of Object.keys(defaultSettings) as Array<keyof GlobalSettings>) {
        if (loaded && typeof loaded[key] !== 'undefined') {
            if (key === 'visibleSections') {
                // Deep merge for visibleSections
                const loadedVS = loaded.visibleSections || {};
                const defaultVS = defaultSettings.visibleSections;
                const topicExplanationSettings = (typeof loadedVS.topicExplanation === 'object' && loadedVS.topicExplanation !== null)
                    ? { ...defaultVS.topicExplanation, ...loadedVS.topicExplanation }
                    : defaultVS.topicExplanation;
                
                merged.visibleSections = {
                    ...defaultVS,
                    ...loadedVS,
                    topicExplanation: topicExplanationSettings
                };
            } else if (key !== 'temperature' && key !== 'topP' && loaded[key] !== null) {
                // Standard merge for other properties, excluding nulls unless it's for temp/topP
                (merged as any)[key] = loaded[key];
            } else if (key === 'temperature' || key === 'topP') {
                // Specifically allow 0 for temp/topP
                if (typeof loaded[key] === 'number') {
                     (merged as any)[key] = loaded[key];
                }
            }
        }
    }
    return merged;
};

export const useGlobalSettings = () => {
    const [settings, setSettings] = useState<GlobalSettings>(() => {
        try {
            const storedSettings = localStorage.getItem(GLOBAL_SETTINGS_KEY);
            if (storedSettings) {
                return mergeSettings(JSON.parse(storedSettings));
            }
        } catch (error) {
            console.error("Error loading settings from localStorage:", error);
        }
        return defaultSettings;
    });

    // Effect to apply settings to the DOM and save to localStorage
    useEffect(() => {
        try {
            // Apply DOM settings
            const body = document.body;
            body.dataset.fontSize = settings.fontSize;
            body.dataset.fontFamily = settings.fontFamily;
            body.dataset.codeFontFamily = settings.codeFontFamily;
            body.dataset.reduceMotion = String(settings.reduceMotion);

            // Save to localStorage
            localStorage.setItem(GLOBAL_SETTINGS_KEY, JSON.stringify(settings));
        } catch (error) {
            console.error("Error saving settings to localStorage or applying to DOM:", error);
        }
    }, [settings]);

    const setPreferredInitialDifficulty = useCallback((difficulty: ExampleDifficulty) => setSettings(p => ({ ...p, preferredInitialDifficulty: difficulty })), []);
    const setIsLeftPanelCollapsed = useCallback((isCollapsed: boolean) => setSettings(p => ({ ...p, isLeftPanelCollapsed: isCollapsed })), []);
    const setPreferredInstructionFormat = useCallback((format: 'normal' | 'line-by-line') => setSettings(p => ({ ...p, preferredInstructionFormat: format })), []);
    const setDefaultPracticeDifficulty = useCallback((difficulty: ExampleDifficulty) => setSettings(p => ({ ...p, defaultPracticeDifficulty: difficulty })), []);
    
    // New setters for AI Behavior
    const setPreferredModel = useCallback((model: AiModel) => setSettings(p => ({ ...p, preferredModel: model })), []);
    const setCustomSystemInstruction = useCallback((instruction: string) => setSettings(p => ({ ...p, customSystemInstruction: instruction })), []);
    const setTemperature = useCallback((temp: number) => setSettings(p => ({ ...p, temperature: temp })), []);
    const setTopP = useCallback((topP: number) => setSettings(p => ({ ...p, topP: topP })), []);

    // New setters for Interface
    const setFontSize = useCallback((size: FontSize) => setSettings(p => ({ ...p, fontSize: size })), []);
    const setFontFamily = useCallback((family: FontFamily) => setSettings(p => ({ ...p, fontFamily: family })), []);
    const setCodeFontFamily = useCallback((family: CodeFontFamily) => setSettings(p => ({ ...p, codeFontFamily: family })), []);
    const setReduceMotion = useCallback((reduce: boolean) => setSettings(p => ({ ...p, reduceMotion: reduce })), []);


    const toggleVisibility = useCallback((key: keyof GlobalSettings['visibleSections'] | keyof TopicExplanationVisibility, isTopicSubSection: boolean = false) => {
        setSettings(prev => {
            const newVisibleSections = { ...prev.visibleSections };

            if (key === 'topicExplanation' && !isTopicSubSection) {
                const topicSettings = { ...newVisibleSections.topicExplanation };
                const newMasterState = !topicSettings.masterToggle;
                Object.keys(topicSettings).forEach(subKey => {
                    topicSettings[subKey as keyof TopicExplanationVisibility] = newMasterState;
                });
                newVisibleSections.topicExplanation = topicSettings;
            } else if (isTopicSubSection) {
                const topicSettings = { ...newVisibleSections.topicExplanation };
                topicSettings[key as keyof TopicExplanationVisibility] = !topicSettings[key as keyof TopicExplanationVisibility];
                const { masterToggle, ...children } = topicSettings;
                topicSettings.masterToggle = Object.values(children).some(v => v);
                newVisibleSections.topicExplanation = topicSettings;
            } else {
                 newVisibleSections[key as keyof Omit<GlobalSettings['visibleSections'], 'topicExplanation'>] = !newVisibleSections[key as keyof Omit<GlobalSettings['visibleSections'], 'topicExplanation'>];
            }

            return { ...prev, visibleSections: newVisibleSections };
        });
    }, []);

    const resetSettings = useCallback((section?: 'general' | 'ai' | 'interface') => {
        setSettings(prev => {
            if (!section) return defaultSettings; // Full reset

            const newSettings = { ...prev };
            if (section === 'general') {
                newSettings.preferredInitialDifficulty = defaultSettings.preferredInitialDifficulty;
                newSettings.defaultPracticeDifficulty = defaultSettings.defaultPracticeDifficulty;
                newSettings.preferredInstructionFormat = defaultSettings.preferredInstructionFormat;
                newSettings.visibleSections = defaultSettings.visibleSections;
            } else if (section === 'ai') {
                newSettings.preferredModel = defaultSettings.preferredModel;
                newSettings.customSystemInstruction = defaultSettings.customSystemInstruction;
                newSettings.temperature = defaultSettings.temperature;
                newSettings.topP = defaultSettings.topP;
            } else if (section === 'interface') {
                newSettings.fontSize = defaultSettings.fontSize;
                newSettings.fontFamily = defaultSettings.fontFamily;
                newSettings.codeFontFamily = defaultSettings.codeFontFamily;
                newSettings.reduceMotion = defaultSettings.reduceMotion;
            }
            return newSettings;
        });
    }, []);

    const importSettings = useCallback((jsonString: string) => {
        try {
            const imported = JSON.parse(jsonString);
            const validatedAndMerged = mergeSettings(imported);
            setSettings(validatedAndMerged);
            toast.success("Settings imported successfully!");
        } catch (error) {
            console.error("Failed to import settings:", error);
            toast.error("Failed to import settings. The file may be invalid.");
        }
    }, []);

    return {
        ...settings,
        settings, // Expose the whole settings object
        importSettings,
        resetSettings,
        toggleVisibility,
        setPreferredInitialDifficulty,
        setIsLeftPanelCollapsed,
        setPreferredInstructionFormat,
        setDefaultPracticeDifficulty,
        setPreferredModel,
        setCustomSystemInstruction,
        setTemperature,
        setTopP,
        setFontSize,
        setFontFamily,
        setCodeFontFamily,
        setReduceMotion,
    };
};