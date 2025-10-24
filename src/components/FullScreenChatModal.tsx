
import React, { useEffect, useRef } from 'react';
import { ChatMessage } from '../types';
import { ErrorMessage } from './ErrorMessage';

interface FullScreenChatModalProps {
    isOpen: boolean;
    onClose: () => void;
    chatHistory: ChatMessage[];
    isChatLoading: boolean;
    chatError: string | null;
    userMessage: string;
    setUserMessage: (msg: string) => void;
    handleSendMessage: () => void;
    handleClearChat: () => void;
    renderChatMessageContent: (text: string) => React.ReactNode;
}

const FullScreenChatModalComponent: React.FC<FullScreenChatModalProps> = ({
    isOpen,
    onClose,
    chatHistory,
    isChatLoading,
    chatError,
    userMessage,
    setUserMessage,
    handleSendMessage,
    handleClearChat,
    renderChatMessageContent
}) => {
    const modalRef = useRef<HTMLDivElement>(null);
    const chatContainerRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLTextAreaElement>(null);

    // Close on Escape key
    useEffect(() => {
        const handleKeyDown = (event: KeyboardEvent) => {
            if (event.key === 'Escape') {
                onClose();
            }
        };

        if (isOpen) {
            document.addEventListener('keydown', handleKeyDown);
            // Focus the input when the modal opens
            setTimeout(() => inputRef.current?.focus(), 100);
        } else {
            document.removeEventListener('keydown', handleKeyDown);
        }

        return () => {
            document.removeEventListener('keydown', handleKeyDown);
        };
    }, [isOpen, onClose]);

    // Auto-scroll chat window
    useEffect(() => {
        if (chatContainerRef.current) {
            chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
        }
    }, [chatHistory, isChatLoading]);


    if (!isOpen) {
        return null;
    }

    return (
        <div
            className="fixed inset-0 bg-gray-900/80 backdrop-blur-md flex items-center justify-center z-[100] p-4 sm:p-6"
            onClick={onClose}
            role="dialog"
            aria-modal="true"
            aria-labelledby="fullscreen-chat-modal-title"
        >
            <div
                ref={modalRef}
                className="bg-gray-800 w-full max-w-4xl h-[90vh] rounded-xl shadow-2xl flex flex-col overflow-hidden ring-1 ring-gray-700/80"
                onClick={(e) => e.stopPropagation()}
            >
                <header className="p-3 sm:p-4 border-b border-gray-700/70 flex justify-between items-center flex-shrink-0">
                    <h2 id="fullscreen-chat-modal-title" className="text-base sm:text-lg font-semibold text-white flex items-center">
                        <span className="material-icons-outlined text-indigo-400 mr-2 text-xl">forum</span>
                        Conversational Chat
                    </h2>
                    <div className="flex items-center gap-2">
                        <button type="button" onClick={handleClearChat} disabled={chatHistory.length === 0} title="Clear chat history" className="p-1.5 rounded-full text-gray-400 hover:text-white hover:bg-gray-700/70 transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
                            <span className="material-icons-outlined text-lg">delete</span>
                        </button>
                        <button
                            onClick={onClose}
                            className="text-gray-400 hover:text-white transition-colors p-1.5 rounded-full hover:bg-gray-700/70 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                            aria-label="Close full-screen chat"
                        >
                            <span className="material-icons-outlined">close</span>
                        </button>
                    </div>
                </header>

                <div ref={chatContainerRef} className="flex-grow p-4 space-y-4 overflow-y-auto custom-scrollbar-small">
                     {chatHistory.map((msg, index) => (
                        <div key={index} className={`flex items-start gap-3 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                            {msg.role === 'ai' && <span className="material-icons-outlined text-indigo-400 text-xl flex-shrink-0 mt-1">assistant</span>}
                            <div className={`max-w-lg p-3 rounded-lg text-sm leading-relaxed whitespace-pre-wrap ${msg.role === 'user' ? 'bg-indigo-600 text-white' : 'bg-gray-700 text-gray-200'}`}>
                                {renderChatMessageContent(msg.content)}
                            </div>
                            {msg.role === 'user' && <span className="material-icons-outlined text-gray-400 text-xl flex-shrink-0 mt-1">account_circle</span>}
                        </div>
                    ))}
                    {isChatLoading && (
                         <div className="flex items-start gap-3 justify-start">
                            <span className="material-icons-outlined text-indigo-400 text-xl flex-shrink-0 mt-1">assistant</span>
                            <div className="bg-gray-700 p-3 rounded-lg flex items-center space-x-1.5">
                                <span className="w-2 h-2 bg-gray-400 rounded-full animate-pulse delay-0"></span>
                                <span className="w-2 h-2 bg-gray-400 rounded-full animate-pulse delay-200"></span>
                                <span className="w-2 h-2 bg-gray-400 rounded-full animate-pulse delay-400"></span>
                            </div>
                        </div>
                    )}
                    {chatError && <ErrorMessage message={chatError} />}
                </div>

                 <footer className="p-3 sm:p-4 border-t border-gray-700/70 flex-shrink-0">
                    <div className="flex items-center gap-3">
                        <textarea 
                            ref={inputRef}
                            id="fullscreen-chat-input"
                            rows={1} value={userMessage}
                            onChange={(e) => setUserMessage(e.target.value)}
                            onKeyDown={(e) => { if(e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSendMessage(); } }}
                            placeholder="Ask a follow-up..."
                            className="flex-grow w-full bg-gray-700/80 border border-gray-600 text-gray-200 rounded-lg p-2.5 text-sm focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 placeholder-gray-500 transition-colors custom-scrollbar-small resize-none"
                            disabled={isChatLoading}
                            aria-label="Your message"
                        />
                        <button
                            type="button"
                            onClick={handleSendMessage}
                            disabled={isChatLoading || !userMessage.trim()}
                            className="bg-indigo-600 hover:bg-indigo-700 text-white font-medium p-2.5 rounded-lg flex items-center justify-center transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500 ring-offset-2 ring-offset-gray-800 disabled:bg-gray-600 disabled:text-gray-400 disabled:cursor-not-allowed shadow-md"
                            aria-label="Send message"
                        >
                            {isChatLoading ? <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div> : <span className="material-icons-outlined text-lg">send</span>}
                        </button>
                    </div>
                 </footer>
            </div>
        </div>
    );
};

export const FullScreenChatModal = React.memo(FullScreenChatModalComponent);
