import React, { useState, useEffect, useCallback, Suspense, lazy } from 'react';
import { ActivityItem } from './types';
import { ErrorMessage } from './components/ErrorMessage';
import { LoadingSpinner } from './components/LoadingSpinner';

// FIX: Lazy load page components for route-based code splitting.
const DashboardPage = lazy(() => import('./pages/DashboardPage').then(module => ({ default: module.DashboardPage })));
const HomePage = lazy(() => import('./pages/HomePage').then(module => ({ default: module.HomePage })));


const MAX_ACTIVITIES = 50;
const ACTIVITY_STORAGE_KEY = 'codeTutorAI_Activities';

const App: React.FC = () => {
    const [apiKeyMissing, setApiKeyMissing] = useState<boolean>(false);
    const [currentView, setCurrentView] = useState<'dashboard' | 'analysis'>('dashboard');
    const [activityToLoad, setActivityToLoad] = useState<ActivityItem | null>(null);
    const [allActivities, setAllActivities] = useState<ActivityItem[]>(() => {
        try {
            const stored = localStorage.getItem(ACTIVITY_STORAGE_KEY);
            if (stored) {
                const parsedActivities = JSON.parse(stored) as any[];
                // Ensure all fields, including new ones, are handled gracefully on load
                return parsedActivities.map(activity => ({
                    ...activity,
                    timestamp: new Date(activity.timestamp),
                    analysisDifficulty: activity.analysisDifficulty || 'easy',
                    projectChatHistory: activity.projectChatHistory || null,
                })).sort((a,b) => b.timestamp.getTime() - a.timestamp.getTime());
            }
        } catch (error) {
            console.error("Error loading activities from localStorage:", error);
        }
        return [];
    });

    useEffect(() => {
        if (!process.env.API_KEY) {
            setApiKeyMissing(true);
        }
    }, []);

    useEffect(() => {
        try {
            const activitiesToStore = allActivities.map(activity => ({
                ...activity,
                timestamp: activity.timestamp.toISOString(),
            }));
            localStorage.setItem(ACTIVITY_STORAGE_KEY, JSON.stringify(activitiesToStore));
        } catch (error) {
            console.error("Error saving activities to localStorage:", error);
        }
    }, [allActivities]);

    const updateOrAddActivity = useCallback((activityToUpdate: ActivityItem) => {
        setAllActivities(prevActivities => {
            const index = prevActivities.findIndex(a => a.id === activityToUpdate.id);
            let updatedActivities;

            if (index !== -1) {
                // Update existing activity
                updatedActivities = [...prevActivities];
                updatedActivities[index] = activityToUpdate;
            } else {
                // Add new activity
                updatedActivities = [activityToUpdate, ...prevActivities];
            }

            // Sort by timestamp and slice to max length
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
        console.log("All activity data has been cleared from storage.");
    }, []);

    const navigateToAnalysis = (activity: ActivityItem) => {
        if (activity.type === 'settings_update') {
            console.log("Settings updates cannot be reloaded into the analysis view.");
            return;
        }
        setActivityToLoad(activity);
        setCurrentView('analysis');
    };

    const navigateToDashboard = () => {
        setActivityToLoad(null);
        setCurrentView('dashboard');
    };

    if (apiKeyMissing) {
        return (
            <div className="flex flex-col min-h-screen bg-gray-900 text-gray-200 items-center justify-center p-4 sm:p-8 text-center">
                <div className="max-w-2xl w-full">
                    <ErrorMessage message="Critical Setup Error: The API_KEY environment variable is missing. This application requires a Google Gemini API key to function. Please refer to the setup instructions in the README.md file to configure your API_KEY." />
                    <p className="mt-4 text-sm text-gray-400">
                        After configuring the API key, please refresh this page.
                    </p>
                    <a 
                        href="README.md" 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="mt-6 inline-block bg-indigo-600 hover:bg-indigo-700 text-white font-semibold py-2.5 px-6 rounded-lg shadow-md transition-colors duration-150"
                    >
                        View Setup Instructions (README.md)
                    </a>
                </div>
            </div>
        );
    }

    return (
        <Suspense fallback={<div className="flex h-screen w-full items-center justify-center"><LoadingSpinner loadingText="Loading App..." /></div>}>
            {currentView === 'dashboard' && (
                <DashboardPage
                    activities={allActivities}
                    onViewActivityDetail={navigateToAnalysis}
                    onUpdateActivity={updateOrAddActivity}
                    onClearAllActivities={clearAllActivities}
                />
            )}
            {currentView === 'analysis' && (
                <HomePage
                    key={activityToLoad ? activityToLoad.id : 'new_analysis_view'} // Added key here
                    initialActivity={activityToLoad}
                    onBackToDashboard={navigateToDashboard}
                    onUpdateActivity={updateOrAddActivity}
                    onClearAllActivities={clearAllActivities}
                />
            )}
        </Suspense>
    );
};

export default App;
