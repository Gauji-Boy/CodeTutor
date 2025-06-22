
import React, { Component, ErrorInfo, ReactNode } from 'react';

interface Props {
    children: ReactNode;
    fallback?: ReactNode;
}

interface State {
    hasError: boolean;
    error?: Error;
}

export class ErrorBoundary extends Component<Props, State> {
    constructor(props: Props) {
        super(props);
        this.state = { hasError: false };
    }

    static getDerivedStateFromError(error: Error): State {
        return { hasError: true, error };
    }

    componentDidCatch(error: Error, errorInfo: ErrorInfo) {
        console.error('Error caught by boundary:', error, errorInfo);
        
        // Log error details for debugging
        const errorDetails = {
            message: error.message,
            stack: error.stack,
            componentStack: errorInfo.componentStack,
            timestamp: new Date().toISOString()
        };
        
        // Store error in localStorage for debugging
        try {
            const existingErrors = JSON.parse(localStorage.getItem('app_errors') || '[]');
            existingErrors.push(errorDetails);
            // Keep only last 10 errors
            const recentErrors = existingErrors.slice(-10);
            localStorage.setItem('app_errors', JSON.stringify(recentErrors));
        } catch (e) {
            console.error('Failed to log error to localStorage:', e);
        }
    }

    render() {
        if (this.state.hasError) {
            return this.props.fallback || (
                <div className="flex flex-col items-center justify-center min-h-screen bg-gray-900 text-white p-8">
                    <div className="bg-red-900/30 border border-red-500 rounded-lg p-6 max-w-md text-center">
                        <span className="material-icons-outlined text-red-400 text-4xl mb-4">error</span>
                        <h2 className="text-xl font-semibold mb-2">Something went wrong</h2>
                        <p className="text-gray-300 mb-4">
                            The application encountered an unexpected error. Please refresh the page to continue.
                        </p>
                        <button 
                            onClick={() => window.location.reload()}
                            className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-md transition-colors"
                        >
                            Refresh Page
                        </button>
                    </div>
                </div>
            );
        }

        return this.props.children;
    }
}
