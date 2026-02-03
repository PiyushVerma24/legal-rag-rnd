import { supabase } from '@/lib/supabase';

export interface DocumentNode {
  id: string;
  title: string;
  file_type: string;
  processed: boolean;
  upload_date: string;
}

export interface MasterNode {
  id: string;
  name: string;
  description?: string;
  documents: DocumentNode[];
  documentCount: number;
}

export interface DocumentTreeData {
  masters: MasterNode[];
  totalDocuments: number;
}

export class DocumentSelectionService {
  /**
   * Get all documents organized by Master in a tree structure
   */
  async getDocumentTree(): Promise<{ success: boolean; data?: DocumentTreeData; error?: string }> {
    try {
      // Fetch all masters
      const { data: mastersData, error: mastersError } = await supabase
        .from('hfnai_masters')
        .select('id, name, description')
        .order('name', { ascending: true });

      if (mastersError) throw mastersError;

      // Fetch all documents with their master info
      const { data: documentsData, error: documentsError } = await supabase
        .from('hfnai_documents')
        .select(`
          id,
          title,
          file_type,
          processed,
          upload_date,
          author_master_id,
          hfnai_masters(id, name)
        `)
        .eq('processed', true)
        .order('upload_date', { ascending: false });

      if (documentsError) throw documentsError;

      // Organize documents by master
      const masterMap = new Map<string, MasterNode>();

      // Initialize masters
      mastersData.forEach(master => {
        masterMap.set(master.id, {
          id: master.id,
          name: master.name,
          description: master.description,
          documents: [],
          documentCount: 0
        });
      });

      // Add documents to their respective masters
      documentsData.forEach((doc: any) => {
        const masterId = doc.author_master_id;
        if (masterId && masterMap.has(masterId)) {
          const master = masterMap.get(masterId)!;
          master.documents.push({
            id: doc.id,
            title: doc.title,
            file_type: doc.file_type,
            processed: doc.processed,
            upload_date: doc.upload_date
          });
          master.documentCount++;
        }
      });

      // Convert map to array and filter out masters with no documents (except General)
      const masters = Array.from(masterMap.values())
        .filter(master => master.documentCount > 0 || master.name === 'General')
        .sort((a, b) => {
          // General always at the end
          if (a.name === 'General') return 1;
          if (b.name === 'General') return -1;
          return a.name.localeCompare(b.name);
        });

      return {
        success: true,
        data: {
          masters,
          totalDocuments: documentsData.length
        }
      };
    } catch (error) {
      console.error('Error getting document tree:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Get documents for specific masters
   */
  async getDocumentsByMasters(masterIds: string[]): Promise<{ success: boolean; documents?: DocumentNode[]; error?: string }> {
    try {
      const { data, error } = await supabase
        .from('hfnai_documents')
        .select('id, title, file_type, processed, upload_date')
        .in('author_master_id', masterIds)
        .eq('processed', true)
        .order('upload_date', { ascending: false });

      if (error) throw error;

      return {
        success: true,
        documents: data as DocumentNode[]
      };
    } catch (error) {
      console.error('Error getting documents by masters:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Get document IDs for specific masters
   */
  async getDocumentIdsByMasters(masterNames: string[]): Promise<{ success: boolean; documentIds?: string[]; error?: string }> {
    try {
      // First, get master IDs from names
      const { data: masters, error: mastersError } = await supabase
        .from('hfnai_masters')
        .select('id')
        .in('name', masterNames);

      if (mastersError) throw mastersError;

      const masterIds = masters.map(m => m.id);

      if (masterIds.length === 0) {
        return { success: true, documentIds: [] };
      }

      // Get document IDs
      const { data: documents, error: docsError } = await supabase
        .from('hfnai_documents')
        .select('id')
        .in('author_master_id', masterIds)
        .eq('processed', true);

      if (docsError) throw docsError;

      return {
        success: true,
        documentIds: documents.map(d => d.id)
      };
    } catch (error) {
      console.error('Error getting document IDs by masters:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Get all masters
   */
  async getAllMasters(): Promise<{ success: boolean; masters?: { id: string; name: string; description?: string }[]; error?: string }> {
    try {
      const { data, error } = await supabase
        .from('hfnai_masters')
        .select('id, name, description')
        .order('name', { ascending: true });

      if (error) throw error;

      return {
        success: true,
        masters: data
      };
    } catch (error) {
      console.error('Error getting all masters:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }
}
