import React, { useMemo } from 'react';
import { SupportedLanguage } from '../types';
import { getPrismLanguageString } from './CodeBlock';
import { escapeHtml } from '../utils/textUtils';
declare var Prism: any;

interface DiffViewerProps {
    oldCode: string;
    newCode: string;
    language: SupportedLanguage;
}

const DiffViewerComponent: React.FC<DiffViewerProps> = ({ oldCode, newCode, language }) => {
    const prismLang = useMemo(() => getPrismLanguageString(language), [language]);

    const highlight = (code: string) => {
        if (typeof Prism !== 'undefined' && Prism.highlight && code) {
            if (Prism.languages[prismLang]) {
                try {
                    return Prism.highlight(code, Prism.languages[prismLang], prismLang);
                } catch (e) {
                    console.warn(`Prism highlighting failed for ${prismLang}:`, e);
                }
            }
        }
        return escapeHtml(code);
    };

    const diffData = useMemo(() => {
        const oldLines = oldCode.split('\n');
        const newLines = newCode.split('\n');
        const oldLinesSet = new Set(oldLines);
        const newLinesSet = new Set(newLines);

        const highlightedOldLines = oldLines.map(line => ({
            html: highlight(line),
            type: newLinesSet.has(line) ? 'common' : 'removed'
        }));

        const highlightedNewLines = newLines.map(line => ({
            html: highlight(line),
            type: oldLinesSet.has(line) ? 'common' : 'added'
        }));

        return { oldLines: highlightedOldLines, newLines: highlightedNewLines };
    }, [oldCode, newCode, prismLang]);

    const renderLines = (lines: { html: string; type: string }[], type: 'old' | 'new') => (
        <pre className="text-xs font-fira-code leading-relaxed p-2 custom-scrollbar-small overflow-auto">
            <code>
                {lines.map((line, index) => (
                    <div 
                        key={`${type}-${index}`} 
                        className={`relative pl-8 pr-2 ${line.type === 'removed' ? 'diff-line-removed' : ''} ${line.type === 'added' ? 'diff-line-added' : ''}`}
                    >
                        <span className="absolute left-0 w-8 text-right text-[var(--text-muted)] select-none pr-2">{index + 1}</span>
                        <div className="line-content" dangerouslySetInnerHTML={{ __html: line.html || ' ' }} />
                    </div>
                ))}
            </code>
        </pre>
    );

    return (
        <div className="bg-[var(--bg-tertiary)]/50 rounded-lg border border-[var(--border-color)] shadow-lg overflow-hidden">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-px bg-[var(--border-color)]">
                {/* Original Code Panel */}
                <div className="bg-[var(--bg-secondary)] flex flex-col">
                    <div className="text-xs text-[var(--text-secondary)] bg-[var(--bg-tertiary)] px-3 py-1.5 border-b border-[var(--border-color)] font-semibold">
                        Your Original Code (before fixes)
                    </div>
                    {renderLines(diffData.oldLines, 'old')}
                </div>
                {/* Corrected Code Panel */}
                <div className="bg-[var(--bg-secondary)] flex flex-col">
                    <div className="text-xs text-[var(--text-secondary)] bg-[var(--bg-tertiary)] px-3 py-1.5 border-b border-[var(--border-color)] font-semibold">
                        AI Corrected Code
                    </div>
                    {renderLines(diffData.newLines, 'new')}
                </div>
            </div>
        </div>
    );
};

export const DiffViewer = React.memo(DiffViewerComponent);