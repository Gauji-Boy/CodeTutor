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

    // Auto-resize chat textarea
    useEffect(() => {
        const textarea = inputRef.current;
        if (textarea) {
            textarea.style.height = 'auto';
            textarea.style.height = `${textarea.scrollHeight}px`;
        }
    }, [userMessage]);


    if (!isOpen) {
        return null;
    }

    return (
        <div
            className="fixed inset-0 bg-[var(--bg-primary)]/80 backdrop-blur-md flex items-center justify-center z-[100] p-4 sm:p-6"
            onClick={onClose}
            role="dialog"
            aria-modal="true"
            aria-labelledby="fullscreen-chat-modal-title"
        >
            <div
                ref={modalRef}
                className="bg-[var(--bg-secondary)] w-full max-w-4xl h-[90vh] rounded-xl shadow-2xl flex flex-col overflow-hidden ring-1 ring-[var(--border-color)]"
                onClick={(e) => e.stopPropagation()}
            >
                <header className="p-3 sm:p-4 border-b border-[var(--border-color)] flex justify-between items-center flex-shrink-0">
                    <h2 id="fullscreen-chat-modal-title" className="text-base sm:text-lg font-semibold text-[var(--text-primary)] flex items-center">
                        <span className="material-icons-outlined text-[var(--accent-primary)] mr-2 text-xl">forum</span>
                        Conversational Chat
                    </h2>
                    <div className="flex items-center gap-2">
                        <button type="button" onClick={handleClearChat} disabled={chatHistory.length === 0} title="Clear chat history" className="p-1.5 rounded-full text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)] transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
                            <span className="material-icons-outlined text-lg">delete</span>
                        </button>
                        <button
                            onClick={onClose}
                            className="text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors p-1.5 rounded-full hover:bg-[var(--bg-tertiary)] focus:outline-none focus:ring-1 focus:ring-[var(--accent-primary)]"
                            aria-label="Close full-screen chat"
                        >
                            <span className="material-icons-outlined">close</span>
                        </button>
                    </div>
                </header>

                <div ref={chatContainerRef} className="flex-grow p-4 space-y-4 overflow-y-auto custom-scrollbar-small">
                     {chatHistory.map((msg, index) => (
                        <div key={index} className={`flex items-start gap-3 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                            {msg.role === 'ai' && <span className="material-icons-outlined text-[var(--accent-primary)] text-xl flex-shrink-0 mt-1">assistant</span>}
                            <div className={`max-w-lg p-3 rounded-lg text-sm leading-relaxed whitespace-pre-wrap ${msg.role === 'user' ? 'bg-[var(--accent-primary)] text-white' : 'bg-[var(--bg-tertiary)] text-[var(--text-primary)]'}`}>
                                {renderChatMessageContent(msg.content)}
                            </div>
                            {msg.role === 'user' && <span className="material-icons-outlined text-[var(--text-muted)] text-xl flex-shrink-0 mt-1">account_circle</span>}
                        </div>
                    ))}
                    {isChatLoading && (
                         <div className="flex items-start gap-3 justify-start">
                            <span className="material-icons-outlined text-[var(--accent-primary)] text-xl flex-shrink-0 mt-1">assistant</span>
                            <div className="bg-[var(--bg-tertiary)] p-3 rounded-lg flex items-center space-x-1.5">
                                <span className="w-2 h-2 bg-[var(--text-muted)] rounded-full animate-pulse delay-0"></span>
                                <span className="w-2 h-2 bg-[var(--text-muted)] rounded-full animate-pulse delay-200"></span>
                                <span className="w-2 h-2 bg-[var(--text-muted)] rounded-full animate-pulse delay-400"></span>
                            </div>
                        </div>
                    )}
                    {chatError && <ErrorMessage message={chatError} />}
                </div>

                 <footer className="p-3 sm:p-4 border-t border-[var(--border-color)] flex-shrink-0">
                    <div className="flex items-center gap-3">
                        <textarea 
                            ref={inputRef}
                            id="fullscreen-chat-input"
                            rows={1} value={userMessage}
                            onChange={(e) => setUserMessage(e.target.value)}
                            onKeyDown={(e) => { if(e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSendMessage(); } }}
                            placeholder="Ask a follow-up..."
                            className="flex-grow w-full bg-[var(--bg-tertiary)] border border-[var(--border-color)] text-[var(--text-primary)] rounded-lg p-2.5 text-sm focus:ring-1 focus:ring-[var(--accent-primary)] focus:border-[var(--accent-primary)] placeholder-[var(--text-muted)] transition-colors custom-scrollbar-small resize-none min-h-[44px] max-h-40"
                            disabled={isChatLoading}
                            aria-label="Your message"
                        />
                        <button
                            type="button"
                            onClick={handleSendMessage}
                            disabled={isChatLoading || !userMessage.trim()}
                            className="bg-[var(--accent-primary)] hover:bg-[var(--accent-primary-hover)] text-white font-medium p-2.5 rounded-lg flex items-center justify-center transition-colors focus:outline-none focus:ring-2 focus:ring-[var(--accent-primary)] ring-offset-2 ring-offset-[var(--bg-secondary)] disabled:bg-[var(--bg-tertiary)] disabled:text-[var(--text-muted)] disabled:cursor-not-allowed shadow-md"
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