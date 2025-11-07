import React, { useState, useEffect, useMemo, useRef } from 'react';
import { SupportedLanguage, VisualFlowStep } from '../types';
import { getPrismLanguageString } from './CodeBlock';
import { escapeHtml } from '../utils/textUtils';
declare var Prism: any;

interface VisualFlowPlayerProps {
    flowSteps: VisualFlowStep[];
    code: string;
    language: SupportedLanguage;
}

const renderStructuredValue = (value: any): React.ReactNode => {
    if (Array.isArray(value)) {
        return (
            <div className="flex flex-col items-start bg-[var(--bg-tertiary)]/30 p-1 rounded-sm">
                <span className="text-[var(--text-muted)] text-xs">[</span>
                <div className="pl-3 space-y-0.5">
                    {value.map((item, index) => (
                         <div key={index} className="flex items-start">
                            <span className="text-[var(--text-muted)] mr-1">{index}:</span>
                            {renderStructuredValue(item)}
                            {index < value.length - 1 && <span className="text-[var(--text-muted)]">,</span>}
                        </div>
                    ))}
                </div>
                <span className="text-[var(--text-muted)] text-xs">]</span>
            </div>
        );
    }
    if (typeof value === 'object' && value !== null) {
        return (
             <div className="flex flex-col items-start bg-[var(--bg-tertiary)]/30 p-1 rounded-sm">
                <span className="text-[var(--text-muted)] text-xs">{'{'}</span>
                <div className="pl-3 space-y-0.5">
                    {Object.entries(value).map(([key, val], index, arr) => (
                        <div key={key} className="flex items-start">
                            <span className="text-[var(--text-muted)] mr-1">{`"${key}"`}:</span>
                            {renderStructuredValue(val)}
                            {index < arr.length - 1 && <span className="text-[var(--text-muted)]">,</span>}
                        </div>
                    ))}
                </div>
                <span className="text-[var(--text-muted)] text-xs">{'}'}</span>
            </div>
        );
    }
    const stringified = JSON.stringify(value);
    return <code className="text-emerald-300 break-all">{stringified !== undefined ? stringified : <span className="text-[var(--text-muted)] italic">undefined</span>}</code>
};

const VariableStateDisplay: React.FC<{ state: Record<string, any>, prevState: Record<string, any> | null }> = ({ state, prevState }) => {
    const allKeys = useMemo(() => {
        const keys = new Set<string>();
        if (prevState) Object.keys(prevState).forEach(k => keys.add(k));
        Object.keys(state).forEach(k => keys.add(k));
        return Array.from(keys).sort();
    }, [state, prevState]);

    if (allKeys.length === 0) {
        return <div className="text-xs text-[var(--text-muted)] italic text-center py-2">No variables tracked at this step.</div>;
    }

    return (
        <div className="space-y-1.5 text-xs font-fira-code">
            {allKeys.map(key => {
                const prevValueJSON = prevState ? JSON.stringify(prevState[key]) : undefined;
                const currentValueJSON = JSON.stringify(state[key]);
                const hasChanged = prevValueJSON !== currentValueJSON;

                return (
                    <div key={key} className={`flex items-start justify-between p-1.5 rounded transition-colors duration-300 ${hasChanged ? 'bg-[var(--accent-primary)]/20 animate-pulse-once' : 'bg-transparent'}`}>
                        <span className="font-semibold text-[var(--text-secondary)] mr-2 shrink-0">{key}:</span>
                        <div className="text-right">{renderStructuredValue(state[key])}</div>
                    </div>
                );
            })}
        </div>
    );
};

const ConsoleOutputDisplay: React.FC<{ cumulativeOutput: string[] }> = ({ cumulativeOutput }) => {
    if (cumulativeOutput.length === 0) {
        return <div className="text-xs text-[var(--text-muted)] italic text-center py-2">No console output yet.</div>;
    }
    return (
        <pre className="text-xs font-fira-code text-gray-300 whitespace-pre-wrap break-words p-1">
            {cumulativeOutput.join('')}
        </pre>
    );
};

export const VisualFlowPlayer: React.FC<VisualFlowPlayerProps> = ({ flowSteps, code, language }) => {
    const [currentStepIndex, setCurrentStepIndex] = useState(0);
    const [highlightedHtml, setHighlightedHtml] = useState('');
    const [isPlaying, setIsPlaying] = useState(false);
    const [playSpeed, setPlaySpeed] = useState(1000); // ms per step, 1x
    const [userInputOverrides, setUserInputOverrides] = useState<Record<number, Record<string, any>>>({});
    const [currentInputValue, setCurrentInputValue] = useState('');
    const [tooltip, setTooltip] = useState<{ visible: boolean; content: string; x: number } | null>(null);

    const codeLineRefs = useRef<(HTMLDivElement | null)[]>([]);
    const playIntervalRef = useRef<number | null>(null);
    const inputRef = useRef<HTMLInputElement>(null);

    const prismLang = useMemo(() => getPrismLanguageString(language), [language]);
    
    const speedOptions = [
        { label: '0.25x', value: 4000 },
        { label: '0.5x', value: 2000 },
        { label: '0.75x', value: 1500 },
        { label: '1x', value: 1000 },
        { label: '1.5x', value: 750 },
        { label: '2x', value: 500 },
        { label: '4x', value: 250 },
    ];

    useEffect(() => {
        let isMounted = true;
    
        const highlightCode = () => {
            if (typeof Prism === 'undefined' || !Prism.highlight || !code) {
                if (isMounted) setHighlightedHtml(escapeHtml(code || ''));
                return;
            }
    
            const applyHighlight = (grammar: any, lang: string) => {
                try {
                    const html = Prism.highlight(code, grammar, lang);
                    if (isMounted) setHighlightedHtml(html);
                } catch (e) {
                    console.warn(`Prism highlighting failed for ${lang}:`, e);
                    if (isMounted) setHighlightedHtml(escapeHtml(code));
                }
            };
    
            if (Prism.languages[prismLang]) {
                applyHighlight(Prism.languages[prismLang], prismLang);
            } else if (Prism.plugins?.autoloader) {
                Prism.plugins.autoloader.loadLanguages(prismLang, () => {
                    if (Prism.languages[prismLang]) {
                        applyHighlight(Prism.languages[prismLang], prismLang);
                    } else {
                        console.warn(`Prism autoloader failed to load grammar for ${prismLang}.`);
                        if (isMounted) setHighlightedHtml(escapeHtml(code));
                    }
                });
            } else {
                console.warn(`Prism grammar for ${prismLang} not found and autoloader is unavailable.`);
                if (isMounted) setHighlightedHtml(escapeHtml(code));
            }
        };
    
        highlightCode();
    
        return () => {
            isMounted = false;
        };
    }, [code, prismLang]);

    const highlightedLines = useMemo(() => highlightedHtml.split('\n'), [highlightedHtml]);

    const lineToStepMap = useMemo(() => {
        const map = new Map<number, number>();
        flowSteps.forEach((step, index) => {
            if (step.lineNumber !== null && !map.has(step.lineNumber)) {
                map.set(step.lineNumber, index);
            }
        });
        return map;
    }, [flowSteps]);
    
    // Autoplay logic
    useEffect(() => {
        if (isPlaying) {
            playIntervalRef.current = window.setInterval(() => {
                setCurrentStepIndex(prev => {
                    if (prev >= flowSteps.length - 1) {
                        setIsPlaying(false); // Stop at the end
                        return prev;
                    }
                     // Pause if the *next* step requires input
                    if (flowSteps[prev + 1]?.inputRequired) {
                        setIsPlaying(false);
                        return prev + 1; // Move to the input step and then stop
                    }
                    return prev + 1;
                });
            }, playSpeed);
        } else {
            if (playIntervalRef.current) {
                clearInterval(playIntervalRef.current);
                playIntervalRef.current = null;
            }
        }

        return () => {
            if (playIntervalRef.current) {
                clearInterval(playIntervalRef.current);
            }
        };
    }, [isPlaying, playSpeed, flowSteps]);

    const currentStepData = useMemo(() => flowSteps[currentStepIndex], [flowSteps, currentStepIndex]);
    const prevStepData = useMemo(() => currentStepIndex > 0 ? flowSteps[currentStepIndex - 1] : null, [flowSteps, currentStepIndex]);
    
    const resolvedStates = useMemo(() => {
        const resolved = { ...currentStepData?.variablesState };
        // Apply all overrides from previous input steps up to the current step
        Object.keys(userInputOverrides).forEach(stepIndexStr => {
            const stepIndex = parseInt(stepIndexStr, 10);
            if (stepIndex < currentStepIndex) {
                 Object.assign(resolved, userInputOverrides[stepIndex]);
            }
        });
        return resolved;
    }, [currentStepIndex, currentStepData, userInputOverrides]);

    const resolvedPrevStates = useMemo(() => {
        if (!prevStepData) return null;
        const resolved = { ...prevStepData.variablesState };
        Object.keys(userInputOverrides).forEach(stepIndexStr => {
            const stepIndex = parseInt(stepIndexStr, 10);
            if (stepIndex < currentStepIndex - 1) {
                 Object.assign(resolved, userInputOverrides[stepIndex]);
            }
        });
        return resolved;
    }, [currentStepIndex, prevStepData, userInputOverrides]);
    
     useEffect(() => {
        // If we land on an input step, pause playback
        if (currentStepData?.inputRequired) {
            setIsPlaying(false);
            // Focus the input field for better UX
            setTimeout(() => inputRef.current?.focus(), 100);
        }
    }, [currentStepData]);


    useEffect(() => {
        const lineToScrollTo = flowSteps[currentStepIndex]?.lineNumber;
        if (lineToScrollTo !== null && lineToScrollTo !== undefined) {
            const ref = codeLineRefs.current[lineToScrollTo - 1];
            ref?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        }
    }, [currentStepIndex, flowSteps]);

    const handleNext = () => {
        setIsPlaying(false);
        if (currentStepData?.inputRequired) {
            const { variableName } = currentStepData.inputRequired;
            const originalValue = currentStepData.variablesState[variableName];
            let parsedValue: any = currentInputValue;
            // Attempt to parse input to match original placeholder type
            if (typeof originalValue === 'number') {
                parsedValue = parseFloat(currentInputValue);
                if (isNaN(parsedValue)) parsedValue = 0;
            } else if (typeof originalValue === 'boolean') {
                parsedValue = ['true', '1', 'yes'].includes(currentInputValue.toLowerCase());
            }
            
            setUserInputOverrides(prev => ({
                ...prev,
                [currentStepIndex]: { [variableName]: parsedValue }
            }));
            setCurrentInputValue('');
        }
        if (currentStepIndex < flowSteps.length - 1) {
             setCurrentStepIndex(currentStepIndex + 1);
        }
    };

    const handlePrev = () => {
        setIsPlaying(false);
        setCurrentStepIndex(prev => Math.max(prev - 1, 0));
    };
    
    const handleReset = () => {
        setIsPlaying(false);
        setCurrentStepIndex(0);
        setUserInputOverrides({});
        setCurrentInputValue('');
    };

    const handleLineClick = (lineNumber: number) => {
        const stepIndex = lineToStepMap.get(lineNumber);
        if (stepIndex !== undefined) {
            setIsPlaying(false);
            setCurrentStepIndex(stepIndex);
        }
    };

    const handleScrubberChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setIsPlaying(false);
        setCurrentStepIndex(Number(e.target.value));
    };

    const handleScrubberHover = (e: React.MouseEvent<HTMLInputElement>) => {
        const scrubber = e.currentTarget;
        const rect = scrubber.getBoundingClientRect();
        const hoverX = e.clientX - rect.left;
        const hoverFraction = Math.max(0, Math.min(1, hoverX / rect.width));
        const stepIndex = Math.floor(hoverFraction * (flowSteps.length > 0 ? flowSteps.length - 1 : 0));
        
        if (flowSteps[stepIndex]) {
            const step = flowSteps[stepIndex];
            const content = `Step ${stepIndex + 1}: ${step.explanation}`;
            setTooltip({
                visible: true,
                content,
                x: hoverX
            });
        }
    };

    const handleScrubberLeave = () => {
        setTooltip(null);
    };
    
    const cumulativeConsoleOutput = useMemo(() => {
        return flowSteps.slice(0, currentStepIndex + 1)
            .filter(step => step.consoleOutput)
            .map(step => step.consoleOutput!);
    }, [currentStepIndex, flowSteps]);

    return (
        <div className="bg-[var(--bg-tertiary)]/50 rounded-lg border border-[var(--border-color)] p-3 sm:p-4 shadow-lg">
            <style>{`.animate-pulse-once { animation: pulse-once 0.7s cubic-bezier(0.4, 0, 0.6, 1); } @keyframes pulse-once { 50% { background-color: rgba(79, 70, 229, 0.4); } }`}</style>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {/* Code Panel */}
                <div className="bg-[var(--bg-secondary)] rounded-md overflow-hidden ring-1 ring-[var(--border-color)] flex flex-col h-[400px]">
                    <div className="text-xs text-[var(--text-muted)] bg-[var(--bg-tertiary)] px-3 py-1.5 border-b border-[var(--border-color)] font-semibold">Code</div>
                    <pre className="text-xs font-fira-code leading-relaxed overflow-auto custom-scrollbar-small p-2 flex-grow">
                        <code>
                            {highlightedLines.map((lineHtml, index) => {
                                const lineNumber = index + 1;
                                const isClickable = lineToStepMap.has(lineNumber);
                                return (
                                <div
                                    key={index}
                                    ref={el => { codeLineRefs.current[index] = el; }}
                                    onClick={() => isClickable && handleLineClick(lineNumber)}
                                    className={`flex items-start transition-colors duration-300 rounded-sm ${lineNumber === currentStepData?.lineNumber ? 'bg-[var(--accent-primary)]/20' : ''} ${isClickable ? 'cursor-pointer hover:bg-[var(--bg-tertiary)]/80' : ''}`}
                                >
                                    <span className="text-right text-[var(--text-muted)] select-none mr-3 w-8 shrink-0">{lineNumber}</span>
                                    <div 
                                      className={`flex-grow border-l-2 ${lineNumber === currentStepData?.lineNumber ? 'border-[var(--accent-primary)]' : 'border-transparent'} pl-2`}
                                      dangerouslySetInnerHTML={{ __html: lineHtml || ' ' }}
                                    />
                                </div>
                                );
                            })}
                        </code>
                    </pre>
                </div>

                {/* State & Explanation Panel */}
                <div className="bg-[var(--bg-secondary)] rounded-md overflow-hidden ring-1 ring-[var(--border-color)] flex flex-col h-[400px]">
                     <div className="text-xs text-[var(--text-muted)] bg-[var(--bg-tertiary)] px-3 py-1.5 border-b border-[var(--border-color)] font-semibold">
                        Execution Details
                    </div>

                    <div className="flex-grow p-3 overflow-y-auto custom-scrollbar-small space-y-4">
                        {/* Input Required Section */}
                        {currentStepData?.inputRequired && (
                            <div>
                                <h4 className="text-xs font-semibold text-yellow-400 uppercase tracking-wider flex items-center border-b border-yellow-500/50 pb-2 mb-2">
                                    <span className="material-icons-outlined text-sm mr-1.5">input</span>
                                    Input Required
                                </h4>
                                <div className="p-2.5 bg-yellow-600/10 rounded-md">
                                    <label htmlFor="visual-flow-input" className="block text-sm text-yellow-300 mb-2">{currentStepData.inputRequired.prompt}</label>
                                    <input
                                        ref={inputRef}
                                        id="visual-flow-input"
                                        type="text"
                                        value={currentInputValue}
                                        onChange={(e) => setCurrentInputValue(e.target.value)}
                                        onKeyDown={(e) => { if (e.key === 'Enter') handleNext(); }}
                                        className="w-full bg-[var(--bg-primary)] border border-[var(--border-color)] text-[var(--text-primary)] rounded-md p-2 text-sm font-fira-code focus:ring-1 focus:ring-yellow-400 focus:border-yellow-400 placeholder-[var(--text-muted)] transition-colors"
                                    />
                                </div>
                            </div>
                        )}
                        
                        {/* Explanation Section */}
                        <div>
                            <h4 className="text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wider flex items-center border-b border-[var(--border-color)] pb-2 mb-2">
                                <span className="material-icons-outlined text-sm mr-1.5 text-[var(--accent-primary)]">description</span>
                                Explanation
                            </h4>
                            <div className="p-2.5 border-l-4 border-[var(--accent-primary)] bg-[var(--accent-primary)]/10 rounded-r-md">
                                <p className="text-sm text-[var(--text-secondary)] leading-relaxed">{currentStepData?.explanation || 'Initial state'}</p>
                            </div>
                        </div>

                        {/* Variables Section */}
                        <div>
                            <h4 className="text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wider flex items-center border-b border-[var(--border-color)] pb-2 mb-2">
                                <span className="material-icons-outlined text-sm mr-1.5 text-[var(--accent-primary)]">data_object</span>
                                Variable State
                            </h4>
                            <div className="max-h-48 overflow-y-auto custom-scrollbar-small bg-[var(--bg-tertiary)]/40 p-2 rounded-md border border-[var(--border-color)]">
                                <VariableStateDisplay state={resolvedStates} prevState={resolvedPrevStates} />
                            </div>
                        </div>

                        {/* Console Section */}
                        <div>
                            <h4 className="text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wider flex items-center border-b border-[var(--border-color)] pb-2 mb-2">
                                <span className="material-icons-outlined text-sm mr-1.5 text-[var(--accent-primary)]">terminal</span>
                                Console (Live)
                            </h4>
                            <div className="max-h-32 overflow-y-auto custom-scrollbar-small bg-[var(--bg-primary)] p-2 rounded-md border border-[var(--border-color)]">
                                <ConsoleOutputDisplay cumulativeOutput={cumulativeConsoleOutput} />
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Controls */}
            <div className="pt-4 mt-3 border-t border-[var(--border-color)]">
                {/* Scrubber */}
                <div className="relative px-1 mb-2">
                    {tooltip && tooltip.visible && (
                        <div
                            className="absolute bottom-full mb-2 bg-[var(--bg-primary)] text-[var(--text-primary)] text-xs rounded py-1 px-2 shadow-lg pointer-events-none transform -translate-x-1/2 whitespace-nowrap max-w-xs truncate border border-[var(--border-color)]"
                            style={{ left: `${tooltip.x}px` }}
                            aria-live="polite"
                        >
                            {tooltip.content}
                        </div>
                    )}
                    <input
                        type="range"
                        min="0"
                        max={flowSteps.length > 0 ? flowSteps.length - 1 : 0}
                        value={currentStepIndex}
                        onMouseMove={handleScrubberHover}
                        onMouseLeave={handleScrubberLeave}
                        onChange={handleScrubberChange}
                        className="w-full h-1.5 bg-[var(--bg-tertiary)] rounded-lg appearance-none cursor-pointer accent-[var(--accent-primary)] focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-[var(--bg-secondary)] focus:ring-[var(--accent-primary)]"
                        aria-label="Execution Step Scrubber"
                        disabled={flowSteps.length === 0}
                    />
                </div>
                {/* Buttons and info */}
                <div className="flex flex-col sm:flex-row items-center justify-between gap-4 mt-2">
                    <div className="flex items-center gap-2">
                        <button onClick={handleReset} className="p-2 text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)] rounded-full transition-colors" title="Reset to Start"><span className="material-icons-outlined">replay</span></button>
                        <button onClick={handlePrev} disabled={currentStepIndex === 0} className="p-2 text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)] rounded-full transition-colors disabled:opacity-50 disabled:cursor-not-allowed" title="Previous Step"><span className="material-icons-outlined">skip_previous</span></button>
                        
                        <button onClick={() => setIsPlaying(!isPlaying)} className="p-2 bg-[var(--accent-primary)] text-white rounded-full shadow-lg hover:bg-[var(--accent-primary-hover)] transition-colors" title={isPlaying ? "Pause" : "Play"}>
                            <span className="material-icons-outlined">{isPlaying ? 'pause' : 'play_arrow'}</span>
                        </button>

                        <button onClick={handleNext} disabled={currentStepIndex >= flowSteps.length - 1} className="p-2 text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)] rounded-full transition-colors disabled:opacity-50 disabled:cursor-not-allowed" title="Next Step"><span className="material-icons-outlined">skip_next</span></button>
                    </div>
                    
                    <div className="flex items-center gap-2 text-xs">
                         <label htmlFor="speed-select" className="text-[var(--text-muted)]">Speed:</label>
                        <select
                            id="speed-select"
                            value={playSpeed}
                            onChange={(e) => setPlaySpeed(Number(e.target.value))}
                            className="bg-[var(--bg-tertiary)] border border-[var(--border-color)] text-[var(--text-primary)] rounded-md py-1 px-2 text-xs focus:ring-1 focus:ring-[var(--accent-primary)] focus:border-[var(--accent-primary)] appearance-none bg-no-repeat bg-right-1.5"
                            style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 20 20' fill='%239ca3af'%3E%3Cpath fill-rule='evenodd' d='M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z' clip-rule='evenodd' /%3E%3C/svg%3E")`, backgroundSize: '1em' }}
                        >
                            {speedOptions.map(({ label, value }) => (
                                <option key={value} value={value}>{label}</option>
                            ))}
                        </select>
                    </div>

                    <div className="text-xs text-[var(--text-muted)] font-medium">
                        Step <span className="text-[var(--text-primary)] font-bold">{currentStepIndex + 1}</span> / {flowSteps.length}
                    </div>
                </div>
            </div>
        </div>
    );
};