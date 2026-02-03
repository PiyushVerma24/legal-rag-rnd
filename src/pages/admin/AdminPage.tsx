import { useState } from 'react';
import { DocumentUploadService, UploadProgress } from '@/services/documentUploadService';
import { toast } from 'sonner';

export default function AdminPage() {
  const [file, setFile] = useState<File | null>(null);
  const [title, setTitle] = useState('');
  const [master, setMaster] = useState('');
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState<UploadProgress | null>(null);

  const uploadService = new DocumentUploadService();

  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file || !title || !master) {
      toast.error('Please fill all fields');
      return;
    }

    setUploading(true);
    setProgress(null);

    const result = await uploadService.uploadDocument(file, master, title, {
      autoProcess: true,
      onProgress: (progressUpdate) => {
        setProgress(progressUpdate);
        console.log(`[${progressUpdate.stage}] ${progressUpdate.message} - ${progressUpdate.progress}%`);
      }
    });

    setUploading(false);

    if (result.success) {
      toast.success(`Document uploaded! Processing started in background. Document ID: ${result.documentId}`);
      // Keep progress visible for a moment
      setTimeout(() => {
        setProgress(null);
        setFile(null);
        setTitle('');
        setMaster('');
      }, 3000);
    } else {
      toast.error(`Upload failed: ${result.error}`);
      setProgress(null);
    }
  };

  return (
    <div className="min-h-screen p-8">
      <div className="max-w-2xl mx-auto">
        <h1 className="text-3xl font-bold text-purple-800 mb-8">📚 Admin - Upload Documents</h1>

        <div className="spiritual-card p-8">
          <form onSubmit={handleUpload} className="space-y-6">
            <div>
              <label className="block text-sm font-medium mb-2">Document Title</label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g., Reality at Dawn"
                className="w-full px-4 py-2 border border-purple-200 rounded-lg focus:outline-none focus:border-purple-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">Master/Author</label>
              <select
                value={master}
                onChange={(e) => setMaster(e.target.value)}
                className="w-full px-4 py-2 border border-purple-200 rounded-lg focus:outline-none focus:border-purple-500"
              >
                <option value="">Select Master</option>
                <option value="Babu ji Maharaj (Ram Chandra)">Babu ji Maharaj (Ram Chandra)</option>
                <option value="Lalaji Maharaj (Ram Chandra of Fatehgarh)">Lalaji Maharaj (Ram Chandra of Fatehgarh)</option>
                <option value="Chariji Maharaj (Parthasarathi Rajagopalachari)">Chariji Maharaj (Parthasarathi Rajagopalachari)</option>
                <option value="Daaji (Kamlesh Patel)">Daaji (Kamlesh Patel)</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">File (PDF, EPUB, TXT)</label>
              <input
                type="file"
                accept=".pdf,.epub,.txt"
                onChange={(e) => setFile(e.target.files?.[0] || null)}
                className="w-full px-4 py-2 border border-purple-200 rounded-lg focus:outline-none focus:border-purple-500"
              />
              {file && (
                <p className="mt-2 text-sm text-gray-600">
                  Selected: {file.name} ({(file.size / 1024 / 1024).toFixed(2)} MB)
                </p>
              )}
            </div>

            <button
              type="submit"
              disabled={uploading || !file || !title || !master}
              className="w-full spiritual-button disabled:opacity-50"
            >
              {uploading ? 'Processing...' : 'Upload Document'}
            </button>
          </form>

          {/* Progress Indicator */}
          {progress && (
            <div className="mt-6 p-4 bg-purple-50 rounded-lg border border-purple-200">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-purple-800">
                  {progress.message}
                </span>
                <span className="text-sm text-purple-600">
                  {progress.progress}%
                </span>
              </div>

              {/* Progress Bar */}
              <div className="w-full h-2 bg-gray-200 rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-purple-500 to-purple-600 transition-all duration-300"
                  style={{ width: `${progress.progress}%` }}
                />
              </div>

              {/* Stage Indicator */}
              <div className="mt-2 flex items-center gap-2">
                <div className={`w-2 h-2 rounded-full ${progress.stage === 'error' ? 'bg-red-500' : 'bg-green-500 animate-pulse'}`} />
                <span className="text-xs text-gray-600 capitalize">
                  {progress.stage.replace(/_/g, ' ')}
                </span>
              </div>

              {/* Error Message */}
              {progress.error && (
                <div className="mt-2 text-sm text-red-600">
                  Error: {progress.error}
                </div>
              )}
            </div>
          )}
        </div>

        <div className="mt-8 text-sm text-gray-600 space-y-2">
          <p>📖 <strong>Note:</strong> After upload, documents will be automatically processed:</p>
          <ul className="list-disc list-inside ml-4 space-y-1">
            <li>Text extraction from PDF/EPUB</li>
            <li>Intelligent chunking preserving context</li>
            <li>Vector embedding generation</li>
            <li>Storage in database for RAG queries</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
