
import React from 'react';
import { SupportedLanguage, LanguageDisplayNames, SupportedLanguage as LangEnum } from '../types';

interface ConceptInputProps {
    concept: string;
    onConceptChange: (concept: string) => void;
    selectedLanguage: SupportedLanguage | null;
    onLanguageChange: (language: SupportedLanguage) => void;
    isLoading: boolean;
}

export const ConceptInput: React.FC<ConceptInputProps> = ({
    concept,
    onConceptChange,
    selectedLanguage,
    onLanguageChange,
    isLoading,
}) => {
    const languageOptions = Object.values(LangEnum)
        .filter(lang => lang !== LangEnum.UNKNOWN)
        .map(lang => ({
            value: lang,
            label: LanguageDisplayNames[lang]
        }));

    return (
        <div className="space-y-6 pt-6" id="concept-typing-panel" role="tabpanel" aria-labelledby="type-concept-tab">
            <div>
                <label htmlFor="concept-textarea" className="block text-base font-medium text-slate-300 mb-1.5">
                    Enter Programming Concept
                </label>
                <textarea
                    id="concept-textarea"
                    name="concept-textarea"
                    rows={5}
                    className="block w-full p-3 shadow-inner focus:ring-2 focus:ring-sky-500 focus:border-sky-500 border border-slate-600/80 bg-slate-700/60 text-slate-100 text-sm rounded-lg font-fira-code disabled:opacity-70 transition-colors custom-scrollbar-small placeholder-slate-400"
                    placeholder="e.g., Python Dictionaries, C++ Polymorphism, JavaScript Arrow Functions, Rust Ownership..."
                    value={concept}
                    onChange={(e) => onConceptChange(e.target.value)}
                    disabled={isLoading}
                    aria-label="Enter programming concept"
                />
            </div>

            <div className="relative">
                <label htmlFor="language-select-concept" className="block text-base font-medium text-slate-300 mb-1.5">
                    Select Language Context
                </label>
                <div className="relative group">
                    <select
                        id="language-select-concept"
                        name="language-select-concept"
                        className="block w-full appearance-none pl-3.5 pr-10 py-2.5 text-sm border border-slate-600 bg-slate-700/80 text-slate-100 focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-sky-500 rounded-lg disabled:opacity-60 transition-all duration-150 shadow-sm hover:border-slate-500"
                        value={selectedLanguage || ''}
                        onChange={(e) => onLanguageChange(e.target.value as SupportedLanguage)}
                        disabled={isLoading}
                        aria-label="Select language context for the concept"
                    >
                        {/* Ensure a placeholder is always selectable if no language is yet chosen */}
                        <option value="" disabled={selectedLanguage !== null && selectedLanguage !== SupportedLanguage.UNKNOWN}>
                            Select language...
                        </option>
                        {languageOptions.map(opt => (
                            <option key={opt.value} value={opt.value}>{opt.label}</option>
                        ))}
                    </select>
                    <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-3 text-slate-400 group-hover:text-sky-400 transition-colors">
                        <span className="material-icons text-xl">unfold_more</span>
                    </div>
                </div>
            </div>
        </div>
    );
};
