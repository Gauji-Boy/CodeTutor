

import React, { useState, useEffect, useCallback, Suspense, lazy } from 'react';
import { Toaster, toast } from 'react-hot-toast';
import { ActivityItem } from './types';
import { LoadingSpinner } from './components/LoadingSpinner';
import { ErrorBoundary } from './components/ErrorBoundary';

// Lazy load components for better performance
const DashboardPage = lazy(() => import('./pages/DashboardPage'));
const HomePage = lazy(() => import('./pages/HomePage').then(module => ({ default: module.HomePage })));

const MAX_ACTIVITIES = 50;
const ACTIVITY_STORAGE_KEY = 'codeTutorAI_Activities';

const App: React.FC = () => {
    const [currentView, setCurrentView] = useState<'dashboard' | 'analysis'>('dashboard');
    const [activityToLoad, setActivityToLoad] = useState<ActivityItem | null>(null);
    const [allActivities, setAllActivities] = useState<ActivityItem[]>(() => {
        try {
            const stored = localStorage.getItem(ACTIVITY_STORAGE_KEY);
            if (stored) {
                const parsedActivities = JSON.parse(stored) as any[];
                // Ensure timestamp is a Date object and analysisDifficulty is present
                return parsedActivities.map(activity => ({
                    ...activity,
                    timestamp: new Date(activity.timestamp), 
                    analysisDifficulty: activity.analysisDifficulty || 'easy', // Fallback if old data
                })).sort((a,b) => b.timestamp.getTime() - a.timestamp.getTime());
            }
        } catch (error) {
            console.error("Error loading activities from localStorage:", error);
        }
        return [];
    });

    // Debounced storage to prevent excessive writes
    useEffect(() => {
        const timeoutId = setTimeout(() => {
            try {
                const activitiesToStore = allActivities.map(activity => ({
                    ...activity,
                    timestamp: activity.timestamp.toISOString(), 
                    analysisDifficulty: activity.analysisDifficulty || 'easy',
                }));
                
                const serialized = JSON.stringify(activitiesToStore);
                
                // Check if localStorage has enough space
                const estimatedSize = new Blob([serialized]).size;
                if (estimatedSize > 5 * 1024 * 1024) { // 5MB limit
                    console.warn('Storage size limit approaching, clearing old activities');
                    const recentActivities = allActivities.slice(0, MAX_ACTIVITIES / 2);
                    setAllActivities(recentActivities);
                    return;
                }
                
                localStorage.setItem(ACTIVITY_STORAGE_KEY, serialized);
            } catch (error) {
                console.error("Error saving activities to localStorage:", error);
                if (error instanceof Error && error.name === 'QuotaExceededError') {
                    // Clear old activities if storage is full
                    const recentActivities = allActivities.slice(0, MAX_ACTIVITIES / 2);
                    setAllActivities(recentActivities);
                }
            }
        }, 500); // 500ms debounce

        return () => clearTimeout(timeoutId);
    }, [allActivities]);

    const addActivity = useCallback((newActivity: ActivityItem) => {
        setAllActivities(prevActivities => {
            // Ensure new activity has analysisDifficulty, defaulting if somehow missed
            const activityToAdd = {
                ...newActivity,
                analysisDifficulty: newActivity.analysisDifficulty || 'easy' 
            };
            const updatedActivities = [activityToAdd, ...prevActivities];
            // Sort by timestamp descending and limit the number of activities
            return updatedActivities
                .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
                .slice(0, MAX_ACTIVITIES);
        });
    }, []);

    const clearAllActivities = useCallback(() => {
        setAllActivities([]);
        try {
            localStorage.removeItem(ACTIVITY_STORAGE_KEY);
        } catch (error) {
            console.error("Error clearing activities from localStorage:", error);
        }
        toast.success("All activity data has been cleared from storage.");
    }, []);


    const navigateToAnalysis = (activity: ActivityItem) => {
        if (activity.type === 'settings_update') {
            toast.error("Settings updates cannot be reloaded into the analysis view.", { icon: 'ℹ️', duration: 4000 });
            return;
        }
        // Ensure activityToLoad has analysisDifficulty, defaulting if necessary from older stored items
        setActivityToLoad({
            ...activity,
            analysisDifficulty: activity.analysisDifficulty || 'easy' 
        });
        setCurrentView('analysis');
    };

    const navigateToDashboard = () => {
        setActivityToLoad(null);
        setCurrentView('dashboard');
    };

    return (
        <ErrorBoundary>
            <Toaster
                position="top-center"
                toastOptions={{
                    duration: 3500,
                    style: { background: 'var(--bg-tertiary)', color: 'var(--text-primary)', borderRadius: '0.375rem', padding: '10px 16px', fontSize: '0.9rem', boxShadow: '0 4px 12px rgba(0,0,0,0.4)' },
                    success: { iconTheme: { primary: 'var(--accent-primary)', secondary: 'var(--bg-primary)' } },
                    error: { iconTheme: { primary: '#f43f5e', secondary: 'var(--bg-primary)' } },
                }}
            />
            <Suspense fallback={<LoadingSpinner loadingText="Loading..." />}>
                {currentView === 'dashboard' && (
                    <DashboardPage
                        activities={allActivities}
                        onViewActivityDetail={navigateToAnalysis}
                        onAddActivity={addActivity} 
                        onClearAllActivities={clearAllActivities} 
                    />
                )}
                {currentView === 'analysis' && (
                    <HomePage
                        initialActivity={activityToLoad}
                        onBackToDashboard={navigateToDashboard}
                        onAddActivity={addActivity}
                        onClearAllActivities={clearAllActivities} 
                    />
                )}
            </Suspense>
        </ErrorBoundary>
    );
};

export default App;