
import React from 'react';

interface CardProps {
    title: string;
    children: React.ReactNode;
    icon?: string; // Material Icons name
    iconColor?: string; // Tailwind text color class e.g. text-blue-400
}

export const Card: React.FC<CardProps> = ({ title, children, icon, iconColor = "text-blue-400" }) => { // Default icon color to blue-400
    return (
        <div className="bg-slate-900 p-5 sm:p-6 rounded-xl shadow-2xl border border-slate-800/60">
            <h2 className="text-xl sm:text-2xl font-semibold mb-4 text-slate-100 font-lexend flex items-center gap-2">
                {icon && <span className={`material-icons-outlined ${iconColor}`}>{icon}</span>}
                {title}
            </h2>
            {children}
        </div>
    );
};