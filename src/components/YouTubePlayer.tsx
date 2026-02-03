import { useState } from 'react';
import { Maximize2, Minimize2, ExternalLink } from 'lucide-react';

interface YouTubePlayerProps {
  videoId: string;
  startTime?: number; // seconds
  title?: string;
  className?: string;
}

export function YouTubePlayer({ videoId, startTime = 0, title, className = '' }: YouTubePlayerProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  // Build YouTube embed URL with autoplay and start time
  const embedUrl = `https://www.youtube.com/embed/${videoId}?start=${Math.floor(startTime)}&autoplay=0&rel=0`;

  // Build YouTube watch URL for opening in new tab
  const watchUrl = `https://www.youtube.com/watch?v=${videoId}&t=${Math.floor(startTime)}s`;

  // Format timestamp for display
  const formatTimestamp = (seconds: number): string => {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = Math.floor(seconds % 60);

    if (h > 0) {
      return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
    }
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  return (
    <div className={`bg-white rounded-lg shadow-sm border border-purple-200 overflow-hidden ${className}`}>
      {/* Header */}
      {title && (
        <div className="bg-gradient-to-r from-purple-50 to-white px-4 py-2 border-b border-purple-100">
          <div className="flex items-center justify-between">
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-purple-900 truncate">{title}</p>
              <p className="text-xs text-purple-600">
                📹 Starting at {formatTimestamp(startTime)}
              </p>
            </div>
            <div className="flex items-center gap-2 ml-2">
              <a
                href={watchUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="p-1.5 hover:bg-purple-100 rounded transition"
                title="Open in YouTube"
              >
                <ExternalLink className="h-4 w-4 text-purple-700" />
              </a>
              <button
                onClick={() => setIsExpanded(!isExpanded)}
                className="p-1.5 hover:bg-purple-100 rounded transition"
                title={isExpanded ? 'Collapse' : 'Expand'}
              >
                {isExpanded ? (
                  <Minimize2 className="h-4 w-4 text-purple-700" />
                ) : (
                  <Maximize2 className="h-4 w-4 text-purple-700" />
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Video Player */}
      <div className={`relative bg-black ${isExpanded ? 'aspect-video' : 'aspect-video max-h-64'}`}>
        <iframe
          className="w-full h-full"
          src={embedUrl}
          title={title || `YouTube video ${videoId}`}
          frameBorder="0"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
          allowFullScreen
        />
      </div>

      {/* Footer with link */}
      <div className="px-4 py-2 bg-purple-50 border-t border-purple-100">
        <a
          href={watchUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="text-xs text-purple-600 hover:text-purple-800 hover:underline flex items-center gap-1"
        >
          <span>Watch on YouTube at {formatTimestamp(startTime)}</span>
          <ExternalLink className="h-3 w-3" />
        </a>
      </div>
    </div>
  );
}

/**
 * Compact version for multiple citations
 */
export function YouTubePlayerCompact({ videoId, startTime = 0, title }: YouTubePlayerProps) {
  const watchUrl = `https://www.youtube.com/watch?v=${videoId}&t=${Math.floor(startTime)}s`;
  const thumbnailUrl = `https://img.youtube.com/vi/${videoId}/mqdefault.jpg`;

  const formatTimestamp = (seconds: number): string => {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = Math.floor(seconds % 60);

    if (h > 0) {
      return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
    }
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  return (
    <a
      href={watchUrl}
      target="_blank"
      rel="noopener noreferrer"
      className="flex items-center gap-3 p-3 bg-white border border-purple-200 rounded-lg hover:bg-purple-50 hover:border-purple-300 transition group"
    >
      {/* Thumbnail */}
      <div className="relative flex-shrink-0">
        <img
          src={thumbnailUrl}
          alt={title || 'Video thumbnail'}
          className="w-24 h-16 object-cover rounded"
        />
        <div className="absolute bottom-1 right-1 bg-black/80 text-white text-xs px-1 rounded">
          {formatTimestamp(startTime)}
        </div>
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-gray-900 truncate group-hover:text-purple-700">
          {title || 'YouTube Video'}
        </p>
        <p className="text-xs text-purple-600 flex items-center gap-1">
          <span>Watch on YouTube</span>
          <ExternalLink className="h-3 w-3" />
        </p>
      </div>
    </a>
  );
}
