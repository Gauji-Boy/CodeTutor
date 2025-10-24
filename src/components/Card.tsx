
import React from 'react';

interface CardProps {
    title: string;
    children: React.ReactNode;
    icon?: string; // Material Icons name, preferably outlined
    iconColor?: string; // Tailwind text color class e.g. text-blue-400
}

// This Card component's previous styling is largely superseded by the new design,
// where content sections are part of a larger glassmorphic panel.
// If specific "cards" are needed again, this component would need a redesign
// to fit the new theme (e.g., subtle inner borders, less dominant background).
// For now, it's left as is but is not actively used in ResultDisplay or FileContentViewer
// in the updated design.

export const Card: React.FC<CardProps> = ({ title, children, icon, iconColor = "text-indigo-400" }) => {
    return (
        <div className="bg-slate-900 p-4 sm:p-5 rounded-xl shadow-xl border border-slate-800/50">
            <h2 className="text-lg sm:text-xl font-semibold mb-3 sm:mb-4 text-slate-100 font-lexend flex items-center gap-2 border-b border-slate-800/70 pb-2.5 sm:pb-3">
                {icon && <span className={`material-icons-outlined ${iconColor} text-xl sm:text-2xl`}>{icon}</span>}
                {title}
            </h2>
            {children}
        </div>
    );
};
