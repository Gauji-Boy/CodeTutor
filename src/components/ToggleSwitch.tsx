import React from 'react';

interface ToggleSwitchProps {
    id: string;
    checked: boolean;
    onChange: () => void;
    disabled?: boolean;
    label: string;
}

export const ToggleSwitch: React.FC<ToggleSwitchProps> = ({ id, checked, onChange, disabled, label }) => (
    <div className="flex items-center justify-between">
        <label htmlFor={id} className={`text-xs select-none ${disabled ? 'text-gray-500' : 'text-gray-300'}`}>
            {label}
        </label>
        <button
            id={id}
            type="button"
            role="switch"
            aria-checked={checked}
            onClick={onChange}
            disabled={disabled}
            className={`${checked ? 'bg-indigo-600' : 'bg-gray-500'} relative inline-flex h-4 w-8 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:ring-offset-2 focus:ring-offset-gray-700 disabled:opacity-50 disabled:cursor-not-allowed`}
        >
            <span aria-hidden="true" className="sr-only">{label}</span>
            <span aria-hidden="true" className={`${checked ? 'translate-x-4' : 'translate-x-0'} pointer-events-none inline-block h-3 w-3 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out`}></span>
        </button>
    </div>
);
