import { useState, useEffect } from 'react';
import { Loader2, ExternalLink, AlertCircle } from 'lucide-react';

interface SimplePDFViewerProps {
    url: string;
    pageNumber?: number;
    className?: string;
}

export default function SimplePDFViewer({ url, pageNumber = 1, className = '' }: SimplePDFViewerProps) {
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [iframeUrl, setIframeUrl] = useState<string>('');

    useEffect(() => {
        if (!url) {
            setError('No PDF URL provided');
            setLoading(false);
            return;
        }

        // Build iframe URL with page number and view settings
        // PDF.js URL fragment parameters:
        // #page=N - jump to page N
        // &view=FitH - fit page width
        // &zoom=page-width - alternative zoom setting
        const pdfUrl = `${url}#page=${pageNumber}&view=FitH`;
        setIframeUrl(pdfUrl);
        setLoading(false);
    }, [url, pageNumber]);

    if (error) {
        return (
            <div className={`flex flex-col items-center justify-center bg-dark-bg-secondary h-full p-8 text-center ${className}`}>
                <AlertCircle className="h-12 w-12 text-red-500 mb-4" />
                <p className="text-dark-text-primary font-medium mb-2">Failed to load PDF</p>
                <p className="text-sm text-dark-text-secondary mb-4 max-w-md">
                    {error}
                </p>
                <a
                    href={url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 px-4 py-2 bg-dark-accent-orange hover:bg-dark-accent-orangeHover text-white rounded-lg transition text-sm font-medium"
                >
                    <ExternalLink className="h-4 w-4" />
                    Open in New Tab
                </a>
            </div>
        );
    }

    return (
        <div className={`flex flex-col h-full bg-dark-bg-secondary ${className}`}>
            {/* Header with info */}
            <div className="flex items-center justify-between p-3 bg-dark-bg-elevated border-b border-dark-border-primary flex-shrink-0">
                <div className="flex items-center gap-2 text-sm text-dark-text-secondary">
                    <span className="font-medium text-dark-text-primary">Page {pageNumber}</span>
                    <span className="text-dark-text-muted">•</span>
                    <span>PDF Document</span>
                </div>
                <a
                    href={url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs bg-dark-bg-tertiary hover:bg-dark-bg-primary text-dark-text-primary rounded-md transition border border-dark-border-primary"
                    title="Open in new tab"
                >
                    <ExternalLink className="h-3 w-3" />
                    Open Externally
                </a>
            </div>

            {/* PDF Viewer */}
            <div className="flex-1 relative bg-dark-bg-primary">
                {loading && (
                    <div className="absolute inset-0 flex items-center justify-center bg-dark-bg-secondary z-10">
                        <div className="flex flex-col items-center gap-3">
                            <Loader2 className="h-8 w-8 animate-spin text-dark-accent-orange" />
                            <p className="text-sm text-dark-text-secondary">Loading PDF...</p>
                        </div>
                    </div>
                )}

                <iframe
                    src={iframeUrl}
                    className="w-full h-full border-none"
                    title="PDF Document Viewer"
                    onLoad={() => setLoading(false)}
                    onError={() => {
                        setLoading(false);
                        setError('Failed to load PDF document. The file may be inaccessible or corrupted.');
                    }}
                />
            </div>

            {/* Footer hint */}
            <div className="px-3 py-2 bg-dark-bg-elevated border-t border-dark-border-primary text-xs text-dark-text-muted flex-shrink-0">
                <p>💡 Use your browser's PDF controls to zoom, navigate, and download</p>
            </div>
        </div>
    );
}
