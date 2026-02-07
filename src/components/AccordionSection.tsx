import { LucideIcon, ChevronDown, Copy } from 'lucide-react';
import { ReactNode } from 'react';

interface AccordionSectionProps {
    title: string;
    icon: LucideIcon;
    badge?: string;
    isExpanded: boolean;
    onToggle: () => void;
    children: ReactNode;
    onCopy?: () => void;
}

export default function AccordionSection({
    title,
    icon: Icon,
    badge,
    isExpanded,
    onToggle,
    children,
    onCopy
}: AccordionSectionProps) {
    return (
        <div className="bg-dark-bg-secondary rounded-xl border border-dark-border-primary overflow-hidden transition-all duration-200 hover:border-dark-accent-orange/30">
            {/* Header - Always Visible */}
            <button
                onClick={onToggle}
                className="w-full flex items-center justify-between p-4 hover:bg-dark-bg-tertiary transition-colors group"
            >
                <div className="flex items-center gap-3">
                    <Icon className={`h-5 w-5 transition-colors ${isExpanded ? 'text-dark-accent-orange' : 'text-dark-text-secondary group-hover:text-dark-accent-orange'}`} />
                    <span className="font-semibold text-dark-text-primary text-left">{title}</span>
                    {badge && (
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium transition-colors ${isExpanded
                                ? 'bg-dark-accent-orange/20 text-dark-accent-orange'
                                : 'bg-dark-bg-tertiary text-dark-text-secondary'
                            }`}>
                            {badge}
                        </span>
                    )}
                </div>

                <div className="flex items-center gap-2">
                    {onCopy && (
                        <div
                            onClick={(e) => {
                                e.stopPropagation();
                                onCopy();
                            }}
                            className="p-2 hover:bg-dark-bg-elevated rounded-lg text-dark-text-muted hover:text-dark-accent-orange transition-colors"
                            title="Copy content"
                        >
                            <Copy className="h-4 w-4" />
                        </div>
                    )}
                    <ChevronDown
                        className={`h-5 w-5 text-dark-text-secondary transition-transform duration-300 ${isExpanded ? 'rotate-180' : ''
                            }`}
                    />
                </div>
            </button>

            {/* Collapsible Content */}
            <div
                className={`
          transition-all duration-300 ease-in-out overflow-hidden
          ${isExpanded ? 'max-h-[3000px] opacity-100' : 'max-h-0 opacity-0'}
        `}
            >
                <div className="p-4 md:p-6 border-t border-dark-border-primary bg-dark-bg-primary/30">
                    {children}
                </div>
            </div>
        </div>
    );
}
