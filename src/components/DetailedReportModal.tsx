
import React from 'react';
import toast from 'react-hot-toast';
import { ActivityItem, ActivityType, SupportedLanguage, LanguageDisplayNames } from '../types';

interface DetailedReportModalProps {
    isOpen: boolean;
    onClose: () => void;
    activities: ActivityItem[];
}

interface ActivityCounts {
    total: number;
    file_analysis: number;
    concept_explanation: number;
    paste_analysis: number;
    settings_update: number;
    debug_analysis: number;
}

interface LanguageFocus {
    name: string;
    count: number;
}

const DetailedReportModalComponent: React.FC<DetailedReportModalProps> = ({ isOpen, onClose, activities }) => {
    if (!isOpen) return null;

    const calculateActivityCounts = (): ActivityCounts => {
        const counts: ActivityCounts = {
            total: activities.length,
            file_analysis: 0,
            concept_explanation: 0,
            paste_analysis: 0,
            settings_update: 0,
            debug_analysis: 0,
        };
        activities.forEach(activity => {
            if (counts.hasOwnProperty(activity.type)) {
                counts[activity.type]++;
            }
        });
        return counts;
    };

    const getLanguageFocus = (): LanguageFocus | null => {
        const langCounts: Record<SupportedLanguage, number> = {} as Record<SupportedLanguage, number>;
        let maxCount = 0;
        let mostFrequentLang: SupportedLanguage | null = null;

        activities.forEach(activity => {
            if (activity.language && activity.language !== SupportedLanguage.UNKNOWN) {
                langCounts[activity.language] = (langCounts[activity.language] || 0) + 1;
                if (langCounts[activity.language] > maxCount) {
                    maxCount = langCounts[activity.language];
                    mostFrequentLang = activity.language;
                }
            }
        });

        if (mostFrequentLang) {
            return { name: LanguageDisplayNames[mostFrequentLang], count: maxCount };
        }
        return null;
    };

    const getKeyConcepts = (): string[] => {
        const concepts = new Set<string>();
        activities.forEach(activity => {
            if (activity.type === 'concept_explanation') {
                // Assuming title for concept_explanation is "Concept: Actual Concept Name"
                const conceptName = activity.title.replace(/^Concept:\s*/, '');
                concepts.add(conceptName);
            }
        });
        return Array.from(concepts);
    };

    const activityCounts = calculateActivityCounts();
    const languageFocus = getLanguageFocus();
    const keyConcepts = getKeyConcepts();
    
    const showComingSoonToast = (featureName: string) => {
        toast(`${featureName} feature is coming soon!`, { icon: '🚧' });
    };

    const renderStatisticItem = (label: string, value: string | number) => (
        <div className="flex justify-between items-center py-2 border-b border-[var(--border-color)] last:border-b-0">
            <span className="text-sm text-[var(--text-secondary)]">{label}:</span>
            <span className="text-sm font-semibold text-[var(--text-primary)]">{value}</span>
        </div>
    );

    return (
        <div 
            className="fixed inset-0 bg-[var(--bg-primary)] bg-opacity-80 backdrop-blur-sm flex items-center justify-center z-[70] p-4" // Increased z-index
            onClick={onClose}
            role="dialog"
            aria-modal="true"
            aria-labelledby="detailed-report-modal-title"
        >
            <div 
                className="bg-[var(--bg-secondary)] w-full max-w-2xl max-h-[85vh] rounded-xl shadow-2xl flex flex-col overflow-hidden ring-1 ring-[var(--border-color)]"
                onClick={(e) => e.stopPropagation()} 
            >
                <header className="p-4 sm:p-5 border-b border-[var(--border-color)] flex justify-between items-center">
                    <h2 id="detailed-report-modal-title" className="text-lg sm:text-xl font-semibold text-white flex items-center">
                        <span className="material-icons-outlined text-[var(--accent-primary)] mr-2">assessment</span>
                        Detailed Activity Report
                    </h2>
                    <button 
                        onClick={onClose} 
                        className="text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors p-1 rounded-full hover:bg-[var(--bg-tertiary)]"
                        aria-label="Close detailed report modal"
                    >
                        <span className="material-icons-outlined">close</span>
                    </button>
                </header>

                <div className="flex-grow p-4 sm:p-6 space-y-6 overflow-y-auto custom-scrollbar-small">
                    <section>
                        <h3 className="text-md font-semibold text-[var(--text-primary)] mb-3 flex items-center">
                            <span className="material-icons-outlined text-base text-[var(--accent-primary)] mr-2">bar_chart</span>
                            Overall Statistics
                        </h3>
                        <div className="bg-[var(--bg-primary)] p-3 sm:p-4 rounded-lg shadow">
                            {renderStatisticItem("Total Activities", activityCounts.total)}
                            {renderStatisticItem("File Analyses", activityCounts.file_analysis)}
                            {renderStatisticItem("Concept Explanations", activityCounts.concept_explanation)}
                            {renderStatisticItem("Pasted Code Analyses", activityCounts.paste_analysis)}
                            {renderStatisticItem("Debug Analyses", activityCounts.debug_analysis)}
                            {renderStatisticItem("Settings Updates", activityCounts.settings_update)}
                        </div>
                    </section>

                    <section>
                        <h3 className="text-md font-semibold text-[var(--text-primary)] mb-3 flex items-center">
                             <span className="material-icons-outlined text-base text-[var(--accent-primary)] mr-2">translate</span>
                            Language Focus
                        </h3>
                        <div className="bg-[var(--bg-primary)] p-3 sm:p-4 rounded-lg shadow">
                            {languageFocus ? (
                                renderStatisticItem(`Most Frequent: ${languageFocus.name}`, `${languageFocus.count} activities`)
                            ) : (
                                <p className="text-sm text-[var(--text-muted)]">No specific language data tracked yet.</p>
                            )}
                        </div>
                    </section>

                    <section>
                        <h3 className="text-md font-semibold text-[var(--text-primary)] mb-3 flex items-center">
                            <span className="material-icons-outlined text-base text-[var(--accent-primary)] mr-2">psychology</span>
                            Key Concepts Explored
                        </h3>
                        <div className="bg-[var(--bg-primary)] p-3 sm:p-4 rounded-lg shadow">
                            {keyConcepts.length > 0 ? (
                                <ul className="list-disc list-inside space-y-1">
                                    {keyConcepts.map((concept, index) => (
                                        <li key={index} className="text-sm text-[var(--text-secondary)]">{concept}</li>
                                    ))}
                                </ul>
                            ) : (
                                <p className="text-sm text-[var(--text-muted)]">No specific concepts explored via "Explain Concept" feature yet.</p>
                            )}
                        </div>
                    </section>
                </div>
                
                <footer className="p-3 sm:p-4 border-t border-[var(--border-color)] flex flex-col sm:flex-row justify-between items-center gap-3">
                     <button
                        onClick={() => showComingSoonToast("Export Report")}
                        className="btn-secondary py-2 px-4 text-sm w-full sm:w-auto flex items-center justify-center"
                        aria-label="Export Report (Coming Soon)"
                    >
                        <span className="material-icons-outlined mr-2 text-base">download</span>
                        Export Report
                    </button>
                    <button
                        onClick={onClose}
                        className="btn-primary py-2 px-5 text-sm w-full sm:w-auto" // Changed to primary for main close action
                        aria-label="Close modal"
                    >
                        Close
                    </button>
                </footer>
            </div>
        </div>
    );
};

export const DetailedReportModal = React.memo(DetailedReportModalComponent);