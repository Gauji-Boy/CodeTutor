import React from 'react';
import { ActivityItem } from '../types';
import toast from 'react-hot-toast';

interface AllActivityModalProps {
    isOpen: boolean;
    onClose: () => void;
    activities: ActivityItem[];
    onViewActivityDetail: (activity: ActivityItem) => void; 
}

const formatTimestamp = (date: Date): string => {
    const now = new Date();
    const diffSeconds = Math.round((now.getTime() - date.getTime()) / 1000);
    const diffMinutes = Math.round(diffSeconds / 60);
    const diffHours = Math.round(diffMinutes / 60);
    const diffDays = Math.round(diffHours / 24);

    if (diffSeconds < 60) return `${diffSeconds}s ago`;
    if (diffMinutes < 60) return `${diffMinutes}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays === 1) return `Yesterday`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString();
};

const AllActivityModalComponent: React.FC<AllActivityModalProps> = ({ isOpen, onClose, activities, onViewActivityDetail }) => {
    if (!isOpen) return null;

    const handleActivityClick = (activity: ActivityItem) => {
        if (activity.type !== 'settings_update') {
            // Pass the activity as-is. HomePage will decide if it needs to re-analyze or use existing result.
            onViewActivityDetail(activity);
            onClose(); // Close modal after navigating
        } else {
            toast('This activity type cannot be reloaded or has no detailed view.', { icon: 'ℹ️', duration: 4000 });
        }
    };

    return (
        <div 
            className="fixed inset-0 bg-[var(--bg-primary)] bg-opacity-80 backdrop-blur-sm flex items-center justify-center z-50 p-4"
            onClick={onClose}
            role="dialog"
            aria-modal="true"
            aria-labelledby="all-activity-modal-title"
        >
            <div 
                className="bg-[var(--bg-secondary)] w-full max-w-2xl max-h-[80vh] rounded-xl shadow-2xl flex flex-col overflow-hidden ring-1 ring-[var(--border-color)]"
                onClick={(e) => e.stopPropagation()} 
            >
                <header className="p-4 sm:p-5 border-b border-[var(--border-color)] flex justify-between items-center">
                    <h2 id="all-activity-modal-title" className="text-lg sm:text-xl font-semibold text-white flex items-center">
                        <span className="material-icons-outlined text-[var(--accent-primary)] mr-2">manage_history</span>
                        All Recent Activity
                    </h2>
                    <button 
                        onClick={onClose} 
                        className="text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors p-1 rounded-full hover:bg-[var(--bg-tertiary)]"
                        aria-label="Close activity modal"
                    >
                        <span className="material-icons-outlined">close</span>
                    </button>
                </header>

                <div className="flex-grow p-4 sm:p-5 space-y-3 sm:space-y-4 overflow-y-auto custom-scrollbar-small">
                    {activities.length > 0 ? (
                        activities.map((activity) => (
                            <div 
                                key={activity.id} 
                                className="flex items-start p-3 bg-[var(--bg-primary)] rounded-lg shadow hover:shadow-lg hover:ring-1 hover:ring-[var(--accent-primary)] transition-all duration-150 cursor-pointer"
                                onClick={() => handleActivityClick(activity)}
                                onKeyPress={(e) => e.key === 'Enter' && handleActivityClick(activity)}
                                role="button"
                                tabIndex={0}
                                aria-label={`View details for activity: ${activity.title}`}
                            >
                                <span className={`material-icons-outlined ${activity.colorClass} mr-3 mt-1 text-xl`}>{activity.icon}</span>
                                <div className="flex-grow overflow-hidden">
                                    <p className="text-sm font-medium text-[var(--text-primary)] truncate" title={activity.title}>{activity.title}</p>
                                    {activity.summary && <p className="text-xs text-[var(--text-secondary)] mt-0.5 truncate" title={activity.summary}>{activity.summary}</p>}
                                </div>
                                <p className="text-xs text-[var(--text-muted)] whitespace-nowrap ml-2 mt-1">{formatTimestamp(activity.timestamp)}</p>
                            </div>
                        ))
                    ) : (
                        <p className="text-center text-[var(--text-muted)] py-8">No activities recorded yet.</p>
                    )}
                </div>
                
                <footer className="p-3 sm:p-4 border-t border-[var(--border-color)] text-right">
                    <button
                        onClick={onClose}
                        className="btn-secondary py-2 px-4 text-sm"
                        aria-label="Close modal"
                    >
                        Close
                    </button>
                </footer>
            </div>
        </div>
    );
};
export const AllActivityModal = React.memo(AllActivityModalComponent);
