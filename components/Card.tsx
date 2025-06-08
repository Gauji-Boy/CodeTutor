
import React from 'react';

interface CardProps {
    title: string;
    children: React.ReactNode;
}

export const Card: React.FC<CardProps> = ({ title, children }) => {
    return (
        <div className="bg-slate-800/60 backdrop-blur-lg shadow-2xl rounded-xl overflow-hidden ring-1 ring-slate-700/60 transform transition-all duration-300 hover:shadow-sky-500/10">
            <div className="px-5 py-4 sm:px-6 sm:py-5 bg-slate-700/50 border-b border-slate-700/70">
                <h3 className="text-xl sm:text-2xl font-semibold text-sky-300 leading-tight tracking-tight">{title}</h3>
            </div>
            <div className="p-5 sm:p-6">
                {children}
            </div>
        </div>
    );
};