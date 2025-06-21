
import React, { useState, useEffect, useCallback } from 'react';
import DashboardPage from './pages/DashboardPage';
import { HomePage } from './pages/HomePage'; // The analysis page
import { Toaster, toast } from 'react-hot-toast';
import { ActivityItem } from './types';

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
                return parsedActivities.map(activity => ({
                    ...activity,
                    timestamp: new Date(activity.timestamp), // Ensure timestamp is a Date object
                })).sort((a,b) => b.timestamp.getTime() - a.timestamp.getTime());
            }
        } catch (error) {
            console.error("Error loading activities from localStorage:", error);
        }
        return [];
    });

    useEffect(() => {
        try {
            const activitiesToStore = allActivities.map(activity => ({
                ...activity,
                timestamp: activity.timestamp.toISOString(), // Store timestamp as ISO string
            }));
            localStorage.setItem(ACTIVITY_STORAGE_KEY, JSON.stringify(activitiesToStore));
        } catch (error) {
            console.error("Error saving activities to localStorage:", error);
        }
    }, [allActivities]);

    const addActivity = useCallback((newActivity: ActivityItem) => {
        setAllActivities(prevActivities => {
            const updatedActivities = [newActivity, ...prevActivities];
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
        setActivityToLoad(activity);
        setCurrentView('analysis');
    };

    const navigateToDashboard = () => {
        setActivityToLoad(null);
        setCurrentView('dashboard');
    };

    return (
        <>
            <Toaster
                position="top-center"
                toastOptions={{
                    duration: 3500,
                    style: { background: 'var(--bg-tertiary)', color: 'var(--text-primary)', borderRadius: '0.375rem', padding: '10px 16px', fontSize: '0.9rem', boxShadow: '0 4px 12px rgba(0,0,0,0.4)' },
                    success: { iconTheme: { primary: 'var(--accent-primary)', secondary: 'var(--bg-primary)' } },
                    error: { iconTheme: { primary: '#f43f5e', secondary: 'var(--bg-primary)' } },
                }}
            />
            {currentView === 'dashboard' && (
                <DashboardPage
                    activities={allActivities}
                    onViewActivityDetail={navigateToAnalysis}
                    onAddActivity={addActivity} // Pass addActivity
                    onClearAllActivities={clearAllActivities} // Pass clearAllActivities
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
        </>
    );
};

export default App;