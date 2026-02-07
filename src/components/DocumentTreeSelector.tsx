import { useState, useEffect } from 'react';
import { DocumentSelectionService, MasterNode } from '@/services/documentSelectionService';
import { ChevronDown, ChevronRight, BookOpen, CheckSquare, Square, CheckCheck } from 'lucide-react';

interface DocumentTreeSelectorProps {
  onSelectionChange: (selectedDocIds: string[], selectedMasters: string[]) => void;
  className?: string;
}

export default function DocumentTreeSelector({ onSelectionChange, className = '' }: DocumentTreeSelectorProps) {
  const [masters, setMasters] = useState<MasterNode[]>([]);
  const [expandedMasters, setExpandedMasters] = useState<Set<string>>(new Set());
  const [selectedDocuments, setSelectedDocuments] = useState<Set<string>>(new Set());
  const [selectedMasters, setSelectedMasters] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);

  const docService = new DocumentSelectionService();

  useEffect(() => {
    loadDocumentTree();
  }, []);

  const loadDocumentTree = async () => {
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

      // SELECT ALL BY DEFAULT
      const allMasterNames = new Set(result.data.masters.map(m => m.name));
      const allDocumentIds = new Set(
        result.data.masters.flatMap(m => m.documents.map(d => d.id))
      );

      setSelectedMasters(allMasterNames);
      setSelectedDocuments(allDocumentIds);

      // Notify parent component of default selection
      onSelectionChange(Array.from(allDocumentIds), Array.from(allMasterNames));
    }
    setLoading(false);
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

  const toggleMasterSelection = (master: MasterNode) => {
    const newSelectedMasters = new Set(selectedMasters);
    const newSelectedDocs = new Set(selectedDocuments);

    if (newSelectedMasters.has(master.name)) {
      // Deselect master and all its documents
      newSelectedMasters.delete(master.name);
      master.documents.forEach(doc => newSelectedDocs.delete(doc.id));
    } else {
      // Select master and all its documents
      newSelectedMasters.add(master.name);
      master.documents.forEach(doc => newSelectedDocs.add(doc.id));
    }

    setSelectedMasters(newSelectedMasters);
    setSelectedDocuments(newSelectedDocs);
    onSelectionChange(Array.from(newSelectedDocs), Array.from(newSelectedMasters));
  };

  const toggleDocumentSelection = (master: MasterNode, docId: string) => {
    const newSelectedDocs = new Set(selectedDocuments);
    const newSelectedMasters = new Set(selectedMasters);

    if (newSelectedDocs.has(docId)) {
      newSelectedDocs.delete(docId);
      // If no documents from this master are selected, deselect the master
      const masterDocsSelected = master.documents.filter(d => newSelectedDocs.has(d.id));
      if (masterDocsSelected.length === 0) {
        newSelectedMasters.delete(master.name);
      }
    } else {
      newSelectedDocs.add(docId);
      // If all documents from this master are now selected, select the master
      const allSelected = master.documents.every(d => newSelectedDocs.has(d.id) || d.id === docId);
      if (allSelected) {
        newSelectedMasters.add(master.name);
      }
    }

    setSelectedDocuments(newSelectedDocs);
    setSelectedMasters(newSelectedMasters);
    onSelectionChange(Array.from(newSelectedDocs), Array.from(newSelectedMasters));
  };

  const selectAll = () => {
    const allDocs = new Set<string>();
    const allMasters = new Set<string>();
    masters.forEach(master => {
      if (master.documentCount > 0) {
        allMasters.add(master.name);
        master.documents.forEach(doc => allDocs.add(doc.id));
      }
    });
    setSelectedDocuments(allDocs);
    setSelectedMasters(allMasters);
    onSelectionChange(Array.from(allDocs), Array.from(allMasters));
  };

  const clearAll = () => {
    setSelectedDocuments(new Set());
    setSelectedMasters(new Set());
    onSelectionChange([], []);
  };

  const isMasterPartiallySelected = (master: MasterNode): boolean => {
    const selectedCount = master.documents.filter(d => selectedDocuments.has(d.id)).length;
    return selectedCount > 0 && selectedCount < master.documents.length;
  };

  if (loading) {
    return (
      <div className={`${className} p-4`}>
        <div className="animate-pulse space-y-2">
          <div className="h-4 bg-dark-bg-elevated rounded w-3/4"></div>
          <div className="h-4 bg-dark-bg-elevated rounded w-1/2"></div>
          <div className="h-4 bg-dark-bg-elevated rounded w-2/3"></div>
        </div>
      </div>
    );
  }

  return (
    <div className={`${className} flex flex-col h-full bg-dark-bg-secondary border-r border-dark-border-primary`}>
      {/* Header */}
      <div className="p-4 border-b border-dark-border-primary bg-dark-bg-secondary">
        <h3 className="font-semibold text-dark-text-primary mb-3 flex items-center gap-2">
          <BookOpen className="h-5 w-5 text-dark-accent-orange" />
          Select Literature
        </h3>
        <div className="flex gap-2">
          <button
            onClick={selectAll}
            className="flex-1 px-3 py-1.5 text-xs bg-dark-accent-orange text-white rounded-md hover:bg-dark-accent-orangeHover transition flex items-center justify-center gap-1"
          >
            <CheckCheck className="h-3 w-3" />
            Select All
          </button>
          <button
            onClick={clearAll}
            className="flex-1 px-3 py-1.5 text-xs bg-dark-bg-elevated text-dark-text-primary rounded-md hover:bg-dark-bg-tertiary transition"
          >
            Clear All
          </button>
        </div>
        <div className="mt-2 text-xs text-dark-text-secondary">
          {selectedDocuments.size} of {masters.reduce((sum, m) => sum + m.documentCount, 0)} documents selected
        </div>
      </div>

      {/* Tree */}
      <div className="flex-1 overflow-y-auto p-4 space-y-2 scrollbar-thin">
        {masters.map(master => (
          <div key={master.id} className="border border-dark-border-primary rounded-lg overflow-hidden">
            {/* Master Header */}
            <div
              className="flex items-center gap-2 p-3 bg-dark-bg-tertiary hover:bg-dark-bg-elevated cursor-pointer transition"
              onClick={() => toggleMasterExpanded(master.id)}
            >
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  toggleMasterSelection(master);
                }}
                className="flex-shrink-0"
              >
                {selectedMasters.has(master.name) ? (
                  <CheckSquare className="h-4 w-4 text-dark-accent-orange" />
                ) : isMasterPartiallySelected(master) ? (
                  <Square className="h-4 w-4 text-dark-accent-orange fill-dark-bg-elevated" />
                ) : (
                  <Square className="h-4 w-4 text-dark-text-muted" />
                )}
              </button>

              {expandedMasters.has(master.id) ? (
                <ChevronDown className="h-4 w-4 text-dark-accent-orange" />
              ) : (
                <ChevronRight className="h-4 w-4 text-dark-accent-orange" />
              )}

              <div className="flex-1">
                <div className="font-medium text-sm text-dark-text-primary">{master.name}</div>
                <div className="text-xs text-dark-text-muted">{master.documentCount} documents</div>
              </div>
            </div>

            {/* Documents List */}
            {expandedMasters.has(master.id) && (
              <div className="bg-dark-bg-primary">
                {master.documents.length === 0 ? (
                  <div className="p-3 text-xs text-dark-text-muted italic">No documents available</div>
                ) : (
                  master.documents.map(doc => (
                    <div
                      key={doc.id}
                      className="flex items-center gap-2 p-3 pl-10 hover:bg-dark-bg-elevated cursor-pointer transition border-t border-dark-border-primary"
                      onClick={() => toggleDocumentSelection(master, doc.id)}
                    >
                      {selectedDocuments.has(doc.id) ? (
                        <CheckSquare className="h-3.5 w-3.5 text-dark-accent-orange flex-shrink-0" />
                      ) : (
                        <Square className="h-3.5 w-3.5 text-dark-text-muted flex-shrink-0" />
                      )}
                      <div className="flex-1 min-w-0">
                        <div className="text-sm text-dark-text-primary truncate">{doc.title}</div>
                        <div className="text-xs text-dark-text-muted">
                          {doc.file_type.toUpperCase()}
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}
          </div>
        ))}

        {masters.length === 0 && (
          <div className="text-center py-8 text-dark-text-muted">
            <BookOpen className="h-12 w-12 mx-auto mb-3 text-dark-bg-elevated" />
            <p className="text-sm">No documents available yet.</p>
            <p className="text-xs mt-1">Upload documents in the Admin section.</p>
          </div>
        )}
      </div>
    </div>
  );
}
