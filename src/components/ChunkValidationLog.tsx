import { useState } from 'react';
import { X, FileText, CheckCircle, AlertTriangle, ExternalLink } from 'lucide-react';
import { ChunkValidationResult } from '../services/chunkingService';
import SimplePDFViewer from './SimplePDFViewer';

interface ChunkValidationLogProps {
    validationResults: ChunkValidationResult[];
    documentUrl: string; // Signed URL to the PDF
    onClose: () => void;
}

interface StatCardProps {
    label: string;
    value: number;
    icon: React.ComponentType<{ className?: string }>;
    color?: 'green' | 'red' | 'blue';
}

function StatCard({ label, value, icon: Icon, color = 'blue' }: StatCardProps) {
    const colorClasses = {
        green: 'bg-green-500/20 text-green-400',
        red: 'bg-red-500/20 text-red-400',
        blue: 'bg-blue-500/20 text-blue-400'
    };

    return (
        <div className="bg-dark-bg-tertiary rounded-lg p-4 border border-dark-border-primary">
            <div className="flex items-center gap-3">
                <div className={`p-2 rounded-lg ${colorClasses[color]}`}>
                    <Icon className="h-5 w-5" />
                </div>
                <div>
                    <p className="text-2xl font-bold text-dark-text-primary">{value}</p>
                    <p className="text-sm text-dark-text-muted">{label}</p>
                </div>
            </div>
        </div>
    );
}

export default function ChunkValidationLog({
    validationResults,
    documentUrl,
    onClose
}: ChunkValidationLogProps) {
    const [selectedChunk, setSelectedChunk] = useState<ChunkValidationResult | null>(null);

    const invalidChunks = validationResults.filter(r => !r.valid);
    const validChunks = validationResults.filter(r => r.valid);

    return (
        <div className="bg-dark-bg-secondary rounded-lg border border-dark-border-primary p-4 mt-4">
            {/* Header */}
            <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-dark-text-primary flex items-center gap-2">
                    <FileText className="h-5 w-5 text-dark-accent-orange" />
                    Chunk Validation Report
                </h3>
                <button
                    onClick={onClose}
                    className="p-1 hover:bg-dark-bg-elevated rounded transition text-dark-text-muted hover:text-dark-text-primary"
                    title="Close report"
                >
                    <X className="h-5 w-5" />
                </button>
            </div>

            {/* Summary Stats */}
            <div className="grid grid-cols-3 gap-4 mb-4">
                <StatCard
                    label="Total Chunks"
                    value={validationResults.length}
                    icon={FileText}
                    color="blue"
                />
                <StatCard
                    label="Valid"
                    value={validChunks.length}
                    icon={CheckCircle}
                    color="green"
                />
                <StatCard
                    label="Invalid"
                    value={invalidChunks.length}
                    icon={AlertTriangle}
                    color="red"
                />
            </div>

            {/* Invalid Chunks List */}
            {invalidChunks.length > 0 ? (
                <div className="space-y-2">
                    <h4 className="font-medium text-dark-text-secondary flex items-center gap-2">
                        <AlertTriangle className="h-4 w-4 text-red-400" />
                        Problematic Chunks ({invalidChunks.length})
                    </h4>
                    <div className="max-h-64 overflow-y-auto space-y-2 scrollbar-thin">
                        {invalidChunks.map((chunk) => (
                            <button
                                key={chunk.chunkIndex}
                                onClick={() => setSelectedChunk(chunk)}
                                className="w-full text-left p-3 bg-dark-bg-tertiary rounded-lg hover:bg-dark-bg-elevated transition border border-dark-border-primary hover:border-dark-accent-orange"
                            >
                                <div className="flex items-start justify-between gap-3">
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2 mb-1 flex-wrap">
                                            <span className="text-sm font-medium text-dark-text-primary">
                                                Chunk #{chunk.chunkIndex}
                                            </span>
                                            {chunk.pageNumber && (
                                                <span className="text-xs bg-dark-accent-orange/20 text-dark-accent-orange px-2 py-0.5 rounded">
                                                    Page {chunk.pageNumber}
                                                </span>
                                            )}
                                            <span className={`text-xs px-2 py-0.5 rounded ${chunk.severity === 'error'
                                                    ? 'bg-red-500/20 text-red-400'
                                                    : 'bg-yellow-500/20 text-yellow-400'
                                                }`}>
                                                {chunk.severity}
                                            </span>
                                        </div>
                                        <p className="text-xs text-red-400 mb-1">
                                            {chunk.reason}
                                        </p>
                                        <p className="text-xs text-dark-text-muted truncate">
                                            {chunk.contentPreview}
                                        </p>
                                        <p className="text-xs text-dark-text-muted mt-1">
                                            {chunk.tokenCount} tokens
                                        </p>
                                    </div>
                                    <ExternalLink className="h-4 w-4 text-dark-text-muted flex-shrink-0" />
                                </div>
                            </button>
                        ))}
                    </div>
                </div>
            ) : (
                <div className="text-center py-8">
                    <CheckCircle className="h-12 w-12 text-green-400 mx-auto mb-3" />
                    <p className="text-dark-text-primary font-medium">All chunks passed validation!</p>
                    <p className="text-sm text-dark-text-muted mt-1">
                        {validChunks.length} chunks are ready for embedding
                    </p>
                </div>
            )}

            {/* PDF Preview Modal */}
            {selectedChunk && (
                <div
                    className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-50 p-4"
                    onClick={() => setSelectedChunk(null)}
                >
                    <div
                        className="bg-dark-bg-secondary rounded-lg shadow-2xl max-w-5xl w-full h-[90vh] flex flex-col border border-dark-border-primary relative"
                        onClick={(e) => e.stopPropagation()}
                    >
                        {/* Header */}
                        <div className="p-4 border-b border-dark-border-primary flex-shrink-0">
                            <div className="flex items-start justify-between">
                                <div>
                                    <h3 className="font-semibold text-dark-text-primary flex items-center gap-2">
                                        <FileText className="h-5 w-5" />
                                        Chunk #{selectedChunk.chunkIndex}
                                        {selectedChunk.pageNumber && (
                                            <span className="text-sm bg-dark-accent-orange/20 text-dark-accent-orange px-2 py-0.5 rounded">
                                                Page {selectedChunk.pageNumber}
                                            </span>
                                        )}
                                    </h3>
                                    <p className="text-sm text-red-400 mt-1">{selectedChunk.reason}</p>
                                    <p className="text-xs text-dark-text-muted mt-1">
                                        {selectedChunk.tokenCount} tokens • {selectedChunk.severity}
                                    </p>
                                </div>
                            </div>
                        </div>

                        {/* PDF Viewer */}
                        <div className="flex-1 overflow-hidden">
                            <SimplePDFViewer
                                url={documentUrl}
                                pageNumber={selectedChunk.pageNumber || 1}
                            />
                        </div>

                        {/* Close Button - Rendered Last for Z-Index */}
                        <button
                            onClick={() => setSelectedChunk(null)}
                            className="absolute top-3 right-3 z-[9999] p-2 bg-dark-bg-elevated hover:bg-red-600 rounded-full transition text-dark-text-primary hover:text-white shadow-2xl border-2 border-dark-border-primary hover:border-red-500"
                            title="Close (ESC or click outside)"
                        >
                            <X className="h-6 w-6" />
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}
