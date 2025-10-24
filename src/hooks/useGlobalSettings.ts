
import { useState, useEffect, useCallback } from 'react';
import { ExampleDifficulty, GlobalSettings, TopicExplanationVisibility } from '../types';

const GLOBAL_SETTINGS_KEY = 'codeTutorGlobalSettings';

const defaultSettings: GlobalSettings = {
    preferredInitialDifficulty: 'easy',
    isLeftPanelCollapsed: false,
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
    }
};

export const useGlobalSettings = () => {
    const [settings, setSettings] = useState<GlobalSettings>(() => {
        try {
            const storedSettings = localStorage.getItem(GLOBAL_SETTINGS_KEY);
            if (storedSettings) {
                const parsed = JSON.parse(storedSettings) as Partial<GlobalSettings> & { visibleSections?: Partial<GlobalSettings['visibleSections']> & { topicExplanation?: boolean | Partial<TopicExplanationVisibility>, followUp?: boolean } };
                
                const loadedVisibleSections = parsed.visibleSections || {};
                const defaultVisibleSections = defaultSettings.visibleSections;

                // Handle backward compatibility for topicExplanation and followUp
                let topicExplanationSettings: TopicExplanationVisibility;
                if ('topicExplanation' in loadedVisibleSections && typeof loadedVisibleSections.topicExplanation === 'object' && loadedVisibleSections.topicExplanation !== null) {
                    topicExplanationSettings = { ...defaultVisibleSections.topicExplanation, ...loadedVisibleSections.topicExplanation };
                } else {
                    const masterState = 'topicExplanation' in loadedVisibleSections && typeof loadedVisibleSections.topicExplanation === 'boolean' ? loadedVisibleSections.topicExplanation : true;
                    topicExplanationSettings = {
                        masterToggle: masterState,
                        coreConcepts: masterState,
                        blockByBlock: masterState,
                        lineByLine: masterState,
                        executionFlow: masterState,
                        followUp: 'followUp' in loadedVisibleSections && typeof loadedVisibleSections.followUp === 'boolean' ? loadedVisibleSections.followUp : masterState,
                    };
                }

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
                    visibleSections: {
                        ...defaultVisibleSections,
                        ...loadedVisibleSections,
                        topicExplanation: topicExplanationSettings,
                    }
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
        setSettings(prev => ({ ...prev, preferredInitialDifficulty: difficulty }));
    }, []);

    const setIsLeftPanelCollapsed = useCallback((isCollapsed: boolean) => {
        setSettings(prev => ({ ...prev, isLeftPanelCollapsed: isCollapsed }));
    }, []);

    const setPreferredInstructionFormat = useCallback((format: 'normal' | 'line-by-line') => {
        setSettings(prev => ({ ...prev, preferredInstructionFormat: format }));
    }, []);

    const setDefaultPracticeDifficulty = useCallback((difficulty: ExampleDifficulty) => {
        setSettings(prev => ({ ...prev, defaultPracticeDifficulty: difficulty }));
    }, []);

    const toggleVisibility = useCallback((key: keyof GlobalSettings['visibleSections'] | keyof TopicExplanationVisibility, isTopicSubSection: boolean = false) => {
        setSettings(prev => {
            const newVisibleSections = { ...prev.visibleSections };

            if (key === 'topicExplanation' && !isTopicSubSection) {
                // Handle master toggle
                const topicSettings = { ...newVisibleSections.topicExplanation };
                const newMasterState = !topicSettings.masterToggle;
                Object.keys(topicSettings).forEach(subKey => {
                    topicSettings[subKey as keyof TopicExplanationVisibility] = newMasterState;
                });
                newVisibleSections.topicExplanation = topicSettings;
            } else if (isTopicSubSection) {
                // Handle sub-section toggle
                const topicSettings = { ...newVisibleSections.topicExplanation };
                topicSettings[key as keyof TopicExplanationVisibility] = !topicSettings[key as keyof TopicExplanationVisibility];

                const { masterToggle, ...children } = topicSettings;
                const anyChildOn = Object.values(children).some(v => v);
                topicSettings.masterToggle = anyChildOn;

                newVisibleSections.topicExplanation = topicSettings;
            } else {
                 // Handle other top-level toggles
                 newVisibleSections[key as keyof Omit<GlobalSettings['visibleSections'], 'topicExplanation'>] = !newVisibleSections[key as keyof Omit<GlobalSettings['visibleSections'], 'topicExplanation'>];
            }

            return { ...prev, visibleSections: newVisibleSections };
        });
    }, []);


    return {
        ...settings,
        toggleVisibility,
        setPreferredInitialDifficulty,
        setIsLeftPanelCollapsed,
        setPreferredInstructionFormat,
        setDefaultPracticeDifficulty,
    };
};
