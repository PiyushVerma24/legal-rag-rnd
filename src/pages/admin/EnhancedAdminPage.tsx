import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { DocumentUploadService, UploadProgress } from '@/services/documentUploadService';
import { DocumentSelectionService, MasterNode } from '@/services/documentSelectionService';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';
import { Trash2, CheckCircle, Clock, AlertCircle, ChevronDown, ChevronRight, RefreshCw, LogOut } from 'lucide-react';

export default function EnhancedAdminPage() {
  const navigate = useNavigate();
  const [file, setFile] = useState<File | null>(null);
  const [title, setTitle] = useState('');
  const [master, setMaster] = useState('');
  const [youtubeUrl, setYoutubeUrl] = useState('');

  // Legal metadata fields
  const [caseNumber, setCaseNumber] = useState('');
  const [citation, setCitation] = useState('');
  const [courtName, setCourtName] = useState('');
  const [judgmentDate, setJudgmentDate] = useState('');

  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState<UploadProgress | null>(null);

  // Document library state
  const [masters, setMasters] = useState<MasterNode[]>([]);
  const [expandedMasters, setExpandedMasters] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState<string | null>(null);

  const uploadService = new DocumentUploadService();
  const docService = new DocumentSelectionService();

  useEffect(() => {
    loadDocuments();
  }, []);

  const loadDocuments = async () => {
    setLoading(true);
    const result = await docService.getDocumentTree();
    if (result.success && result.data) {
      setMasters(result.data.masters);
      // Auto-expand masters with documents
      const autoExpand = new Set(
        result.data.masters
          .filter(m => m.documentCount > 0)
          .map(m => m.id)
      );
      setExpandedMasters(autoExpand);
    }
    setLoading(false);
  };

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
      youtubeUrl: youtubeUrl || undefined,
      onProgress: (progressUpdate) => {
        setProgress(progressUpdate);
      }
    });

    setUploading(false);

    if (result.success) {
      toast.success('Document uploaded successfully!');
      setFile(null);
      setTitle('');
      setMaster('');
      setYoutubeUrl('');
      setCaseNumber('');
      setCitation('');
      setCourtName('');
      setJudgmentDate('');
      // Reload document list
      setTimeout(() => {
        setProgress(null);
        loadDocuments();
      }, 3000);
    } else {
      toast.error(`Upload failed: ${result.error}`);
      setProgress(null);
    }
  };

  const handleDelete = async (documentId: string, documentTitle: string) => {
    if (!window.confirm(`Are you sure you want to delete "${documentTitle}"?\n\nThis will permanently remove:\n- The document file\n- All text chunks\n- All embeddings\n\nThis action cannot be undone.`)) {
      return;
    }

    setDeleting(documentId);
    const result = await uploadService.deleteDocument(documentId);

    if (result.success) {
      toast.success('Document deleted successfully');
      loadDocuments(); // Reload the list
    } else {
      toast.error(`Delete failed: ${result.error}`);
    }
    setDeleting(null);
  };

  const handleLogout = async () => {
    try {
      await supabase.auth.signOut();
      toast.success('Logged out successfully');
      navigate('/auth');
    } catch (error) {
      console.error('Logout error:', error);
      toast.error('Failed to logout');
    }
  };

  const toggleMasterExpanded = (masterId: string) => {
    const newExpanded = new Set(expandedMasters);
    if (newExpanded.has(masterId)) {
      newExpanded.delete(masterId);
    } else {
      newExpanded.add(masterId);
    }
    setExpandedMasters(newExpanded);
  };

  const getStatusIcon = (doc: any) => {
    if (doc.processed) {
      return <CheckCircle className="h-4 w-4 text-green-600" />;
    } else if (doc.processing_status === 'processing') {
      return <Clock className="h-4 w-4 text-blue-600 animate-spin" />;
    } else if (doc.processing_status === 'failed') {
      return <AlertCircle className="h-4 w-4 text-red-600" />;
    }
    return <Clock className="h-4 w-4 text-gray-400" />;
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 via-white to-purple-50 p-6">
      <div className="max-w-7xl mx-auto">
        <div className="mb-8 flex items-start justify-between">
          <div>
            <h1 className="text-3xl font-bold text-purple-900 mb-2 flex items-center gap-3">
              ⚖️ Admin Portal
            </h1>
            <p className="text-gray-600">Upload and manage legal documents</p>
          </div>
          <button
            onClick={handleLogout}
            className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition"
            title="Logout"
          >
            <LogOut className="h-5 w-5 text-gray-700" />
            <span className="text-gray-700">Logout</span>
          </button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Left: Document Library */}
          <div>
            <div className="bg-white rounded-lg shadow-md border border-purple-200 overflow-hidden">
              <div className="p-6 border-b border-purple-200 bg-gradient-to-r from-purple-50 to-white">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-xl font-semibold text-purple-900">Document Library</h2>
                    <p className="text-sm text-gray-600 mt-1">
                      {masters.reduce((sum, m) => sum + m.documentCount, 0)} documents uploaded
                    </p>
                  </div>
                  <button
                    onClick={loadDocuments}
                    className="p-2 hover:bg-purple-100 rounded-lg transition"
                    title="Refresh"
                  >
                    <RefreshCw className={`h-5 w-5 text-purple-700 ${loading ? 'animate-spin' : ''}`} />
                  </button>
                </div>
              </div>

              <div className="p-4 max-h-[600px] overflow-y-auto">
                {loading ? (
                  <div className="py-8 text-center text-gray-500">
                    <RefreshCw className="h-8 w-8 animate-spin mx-auto mb-2" />
                    <p className="text-sm">Loading documents...</p>
                  </div>
                ) : masters.length === 0 ? (
                  <div className="py-8 text-center text-gray-500">
                    <p className="text-sm">No documents uploaded yet</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {masters.map(master => (
                      <div key={master.id} className="border border-purple-100 rounded-lg overflow-hidden">
                        {/* Master Header */}
                        <div
                          onClick={() => toggleMasterExpanded(master.id)}
                          className="flex items-center gap-2 p-3 bg-purple-50 hover:bg-purple-100 cursor-pointer transition"
                        >
                          {expandedMasters.has(master.id) ? (
                            <ChevronDown className="h-4 w-4 text-purple-600" />
                          ) : (
                            <ChevronRight className="h-4 w-4 text-purple-600" />
                          )}
                          <div className="flex-1">
                            <div className="font-medium text-sm text-purple-900">{master.name}</div>
                            <div className="text-xs text-purple-600">{master.documentCount} documents</div>
                          </div>
                        </div>

                        {/* Documents List */}
                        {expandedMasters.has(master.id) && (
                          <div className="bg-white">
                            {master.documents.length === 0 ? (
                              <div className="p-3 text-xs text-gray-500 italic">No documents</div>
                            ) : (
                              master.documents.map(doc => (
                                <div
                                  key={doc.id}
                                  className="flex items-center gap-3 p-3 border-t border-purple-100 hover:bg-purple-50 transition"
                                >
                                  {getStatusIcon(doc)}

                                  <div className="flex-1 min-w-0">
                                    <div className="text-sm font-medium text-gray-900 truncate">
                                      {doc.title}
                                    </div>
                                    <div className="text-xs text-gray-500">
                                      {doc.file_type.toUpperCase()} • {new Date(doc.upload_date).toLocaleDateString()} at {new Date(doc.upload_date).toLocaleTimeString()}
                                    </div>
                                  </div>

                                  <button
                                    onClick={() => handleDelete(doc.id, doc.title)}
                                    disabled={deleting === doc.id}
                                    className="p-2 hover:bg-red-100 rounded-lg transition group"
                                    title="Delete document"
                                  >
                                    <Trash2 className={`h-4 w-4 text-gray-400 group-hover:text-red-600 ${deleting === doc.id ? 'animate-pulse' : ''}`} />
                                  </button>
                                </div>
                              ))
                            )}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div className="mt-4 p-3 bg-yellow-50 rounded-lg border border-yellow-200">
              <p className="text-xs text-yellow-800">
                <strong>⚠️ Status Icons:</strong>
                <CheckCircle className="inline h-3 w-3 mx-1 text-green-600" /> Processed |
                <Clock className="inline h-3 w-3 mx-1 text-blue-600" /> Processing |
                <AlertCircle className="inline h-3 w-3 mx-1 text-red-600" /> Failed
              </p>
            </div>
          </div>

          {/* Right: Upload Form */}
          <div>
            <div className="bg-white rounded-lg shadow-md border border-purple-200 p-6">
              <h2 className="text-xl font-semibold text-purple-900 mb-6">Upload New Document</h2>

              <form onSubmit={handleUpload} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Document Title *
                  </label>
                  <input
                    type="text"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="e.g., Kesavananda Bharati v. State of Kerala"
                    className="w-full px-4 py-2 border border-purple-200 rounded-lg focus:outline-none focus:border-purple-500"
                    disabled={uploading}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Legal Category *
                  </label>
                  <select
                    value={master}
                    onChange={(e) => setMaster(e.target.value)}
                    className="w-full px-4 py-2 border border-purple-200 rounded-lg focus:outline-none focus:border-purple-500"
                    disabled={uploading}
                  >
                    <option value="">Select Legal Category</option>
                    <optgroup label="Jurisdictions">
                      <option value="Supreme Court of India">Supreme Court of India</option>
                      <option value="Delhi High Court">Delhi High Court</option>
                      <option value="Bombay High Court">Bombay High Court</option>
                      <option value="Calcutta High Court">Calcutta High Court</option>
                      <option value="Madras High Court">Madras High Court</option>
                    </optgroup>
                    <optgroup label="Practice Areas">
                      <option value="Constitutional Law">Constitutional Law</option>
                      <option value="Criminal Law">Criminal Law</option>
                      <option value="Civil Law">Civil Law</option>
                      <option value="Corporate Law">Corporate Law</option>
                      <option value="Tax Law">Tax Law</option>
                    </optgroup>
                    <optgroup label="Case Types">
                      <option value="Writ Petition">Writ Petition</option>
                      <option value="Civil Appeal">Civil Appeal</option>
                      <option value="Criminal Appeal">Criminal Appeal</option>
                      <option value="Public Interest Litigation (PIL)">Public Interest Litigation (PIL)</option>
                    </optgroup>
                  </select>
                </div>

                {/* Legal Metadata Fields */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Case Number
                    </label>
                    <input
                      type="text"
                      value={caseNumber}
                      onChange={(e) => setCaseNumber(e.target.value)}
                      placeholder="e.g., Writ Petition (C) No. 135 of 1970"
                      className="w-full px-4 py-2 border border-purple-200 rounded-lg focus:outline-none focus:border-purple-500"
                      disabled={uploading}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Citation
                    </label>
                    <input
                      type="text"
                      value={citation}
                      onChange={(e) => setCitation(e.target.value)}
                      placeholder="e.g., (1973) 4 SCC 225"
                      className="w-full px-4 py-2 border border-purple-200 rounded-lg focus:outline-none focus:border-purple-500"
                      disabled={uploading}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Court Name
                    </label>
                    <input
                      type="text"
                      value={courtName}
                      onChange={(e) => setCourtName(e.target.value)}
                      placeholder="e.g., Supreme Court of India"
                      className="w-full px-4 py-2 border border-purple-200 rounded-lg focus:outline-none focus:border-purple-500"
                      disabled={uploading}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Judgment Date
                    </label>
                    <input
                      type="date"
                      value={judgmentDate}
                      onChange={(e) => setJudgmentDate(e.target.value)}
                      className="w-full px-4 py-2 border border-purple-200 rounded-lg focus:outline-none focus:border-purple-500"
                      disabled={uploading}
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    YouTube URL (Optional)
                  </label>
                  <input
                    type="url"
                    value={youtubeUrl}
                    onChange={(e) => setYoutubeUrl(e.target.value)}
                    placeholder="https://youtu.be/khoHUl12lQQ"
                    className="w-full px-4 py-2 border border-purple-200 rounded-lg focus:outline-none focus:border-purple-500"
                    disabled={uploading}
                  />
                  <p className="mt-1 text-xs text-gray-500">
                    📹 For YouTube transcripts: link answers to specific video moments
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    File (PDF, EPUB, TXT) *
                  </label>
                  <input
                    type="file"
                    accept=".pdf,.epub,.txt"
                    onChange={(e) => setFile(e.target.files?.[0] || null)}
                    className="w-full px-4 py-2 border border-purple-200 rounded-lg focus:outline-none focus:border-purple-500"
                    disabled={uploading}
                  />
                  {file && (
                    <p className="mt-2 text-sm text-gray-600">
                      📄 {file.name} ({(file.size / 1024 / 1024).toFixed(2)} MB)
                    </p>
                  )}
                </div>

                <button
                  type="submit"
                  disabled={uploading || !file || !title || !master}
                  className="w-full bg-purple-600 text-white py-3 rounded-lg hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed font-medium transition"
                >
                  {uploading ? 'Uploading & Processing...' : 'Upload Document'}
                </button>
              </form>

              {/* Progress Indicator */}
              {progress && (
                <div className="mt-6 p-4 bg-purple-50 rounded-lg border border-purple-200">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium text-purple-800">
                      {progress.message}
                    </span>
                    <span className="text-sm text-purple-600 font-semibold">
                      {progress.progress}%
                    </span>
                  </div>

                  <div className="w-full h-2 bg-gray-200 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-purple-500 to-purple-600 transition-all duration-300"
                      style={{ width: `${progress.progress}%` }}
                    />
                  </div>

                  <div className="mt-2 flex items-center gap-2">
                    <div className={`w-2 h-2 rounded-full ${progress.stage === 'error' ? 'bg-red-500' : 'bg-green-500 animate-pulse'}`} />
                    <span className="text-xs text-gray-600 capitalize">
                      {progress.stage.replace(/_/g, ' ')}
                    </span>
                  </div>

                  {progress.error && (
                    <div className="mt-2 text-sm text-red-600">
                      ❌ Error: {progress.error}
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="mt-4 p-4 bg-blue-50 rounded-lg border border-blue-200">
              <p className="text-sm text-blue-800 font-medium mb-2">📖 Auto-Processing Pipeline:</p>
              <ul className="text-xs text-blue-700 space-y-1">
                <li>• Text extraction from PDF/EPUB</li>
                <li>• Intelligent semantic chunking</li>
                <li>• Vector embedding generation</li>
                <li>• Ready for RAG queries</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
