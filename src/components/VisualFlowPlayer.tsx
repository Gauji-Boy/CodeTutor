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

const VariableStateDisplay: React.FC<{ state: Record<string, any>, prevState: Record<string, any> | null }> = ({ state, prevState }) => {
    const allKeys = useMemo(() => {
        const keys = new Set<string>();
        if (prevState) Object.keys(prevState).forEach(k => keys.add(k));
        Object.keys(state).forEach(k => keys.add(k));
        return Array.from(keys).sort();
    }, [state, prevState]);

    if (allKeys.length === 0) {
        return <div className="text-xs text-gray-500 italic text-center py-2">No variables tracked at this step.</div>;
    }

    return (
        <div className="space-y-1.5 text-xs">
            {allKeys.map(key => {
                const prevValue = prevState ? JSON.stringify(prevState[key]) : undefined;
                const currentValue = JSON.stringify(state[key]);
                const hasChanged = prevValue !== currentValue;

                return (
                    <div key={key} className={`flex items-center justify-between p-1.5 rounded transition-colors duration-300 ${hasChanged ? 'bg-indigo-500/20' : 'bg-gray-700/30'}`}>
                        <span className="font-semibold text-gray-300 mr-2">{key}:</span>
                        <code className="text-emerald-300 text-right break-all">{currentValue !== undefined ? currentValue : <span className="text-gray-500 italic">undefined</span>}</code>
                    </div>
                );
            })}
        </div>
    );
};

export const VisualFlowPlayer: React.FC<VisualFlowPlayerProps> = ({ flowSteps, code, language }) => {
    const [currentStepIndex, setCurrentStepIndex] = useState(0);
    const [highlightedHtml, setHighlightedHtml] = useState('');
    const codeLineRefs = useRef<(HTMLDivElement | null)[]>([]);

    const prismLang = useMemo(() => getPrismLanguageString(language), [language]);

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

    useEffect(() => {
        const lineToScrollTo = flowSteps[currentStepIndex]?.lineNumber;
        if (lineToScrollTo !== null && lineToScrollTo !== undefined) {
            const ref = codeLineRefs.current[lineToScrollTo - 1];
            ref?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        }
    }, [currentStepIndex, flowSteps]);

    const handleNext = () => {
        setCurrentStepIndex(prev => Math.min(prev + 1, flowSteps.length - 1));
    };

    const handlePrev = () => {
        setCurrentStepIndex(prev => Math.max(prev - 1, 0));
    };
    
    const handleReset = () => {
        setCurrentStepIndex(0);
    };

    const handleLineClick = (lineNumber: number) => {
        const stepIndex = lineToStepMap.get(lineNumber);
        if (stepIndex !== undefined) {
            setCurrentStepIndex(stepIndex);
        }
    };

    const currentStepData = flowSteps[currentStepIndex];
    const prevStepData = currentStepIndex > 0 ? flowSteps[currentStepIndex - 1] : null;

    return (
        <div className="bg-gray-700/30 rounded-lg border border-gray-600/50 p-3 sm:p-4 shadow-lg">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {/* Code Panel */}
                <div className="bg-gray-900/60 rounded-md overflow-hidden ring-1 ring-gray-600/50 flex flex-col max-h-[500px]">
                    <div className="text-xs text-gray-400 bg-gray-700/50 px-3 py-1.5 border-b border-gray-600/50 font-semibold">Code</div>
                    <pre className="text-xs font-fira-code leading-relaxed overflow-auto custom-scrollbar-small p-2 flex-grow">
                        <code>
                            {highlightedLines.map((lineHtml, index) => {
                                const lineNumber = index + 1;
                                const isClickable = lineToStepMap.has(lineNumber);
                                return (
                                <div
                                    key={index}
                                    ref={el => codeLineRefs.current[index] = el}
                                    onClick={() => isClickable && handleLineClick(lineNumber)}
                                    className={`flex items-start transition-colors duration-300 rounded-sm ${lineNumber === currentStepData?.lineNumber ? 'bg-indigo-500/20' : ''} ${isClickable ? 'cursor-pointer hover:bg-gray-700/50' : ''}`}
                                >
                                    <span className="text-right text-gray-500 select-none mr-3 w-8 shrink-0">{lineNumber}</span>
                                    <div 
                                      className={`flex-grow border-l-2 ${lineNumber === currentStepData?.lineNumber ? 'border-indigo-400' : 'border-transparent'} pl-2`}
                                      dangerouslySetInnerHTML={{ __html: lineHtml || ' ' }}
                                    />
                                </div>
                                );
                            })}
                        </code>
                    </pre>
                </div>

                {/* State & Explanation Panel */}
                <div className="bg-gray-900/60 rounded-md overflow-hidden ring-1 ring-gray-600/50 flex flex-col max-h-[500px]">
                    <div className="text-xs text-gray-400 bg-gray-700/50 px-3 py-1.5 border-b border-gray-600/50 font-semibold">State & Explanation</div>
                    <div className="flex-grow p-3 space-y-3 overflow-y-auto custom-scrollbar-small">
                        <div>
                            <h4 className="text-sm font-semibold text-gray-200 mb-1.5">Explanation</h4>
                            <p className="text-sm text-gray-300 bg-gray-700/30 p-2 rounded-md leading-relaxed">{currentStepData?.explanation || 'Initial state'}</p>
                        </div>
                        <div>
                            <h4 className="text-sm font-semibold text-gray-200 mb-1.5">Variable State</h4>
                            <VariableStateDisplay state={currentStepData?.variablesState || {}} prevState={prevStepData?.variablesState || null}/>
                        </div>
                    </div>
                </div>
            </div>

            {/* Controls */}
            <div className="mt-4 pt-3 border-t border-gray-600/50">
                <div className="flex items-center justify-between gap-4">
                    <div className="text-xs text-gray-400 font-medium">
                        Step {currentStepIndex + 1} / {flowSteps.length}
                    </div>
                    <div className="flex items-center gap-2">
                        <button onClick={handleReset} disabled={currentStepIndex === 0} className="p-2 rounded-full text-gray-300 hover:text-white bg-gray-600/50 hover:bg-gray-500/50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors" title="Reset">
                            <span className="material-icons-outlined text-xl">replay</span>
                        </button>
                         <button onClick={handlePrev} disabled={currentStepIndex === 0} className="p-2 rounded-full text-gray-300 hover:text-white bg-gray-600/50 hover:bg-gray-500/50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors" title="Previous Step">
                            <span className="material-icons-outlined text-xl">skip_previous</span>
                        </button>
                        <button onClick={handleNext} disabled={currentStepIndex >= flowSteps.length - 1} className="p-2 rounded-full text-gray-300 hover:text-white bg-gray-600/50 hover:bg-gray-500/50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors" title="Next Step">
                            <span className="material-icons-outlined text-xl">skip_next</span>
                        </button>
                    </div>
                    <div className="w-1/3">
                        <input
                            type="range"
                            min="0"
                            max={flowSteps.length - 1}
                            value={currentStepIndex}
                            onChange={(e) => {
                                setCurrentStepIndex(Number(e.target.value));
                            }}
                            className="w-full h-1.5 bg-gray-600 rounded-lg appearance-none cursor-pointer range-sm accent-indigo-500"
                            aria-label="Execution step slider"
                        />
                    </div>
                </div>
            </div>
        </div>
    );
};