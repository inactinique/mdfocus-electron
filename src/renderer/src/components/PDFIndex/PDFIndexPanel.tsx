import React, { useState, useEffect } from 'react';
import { Plus } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { PDFList } from './PDFList';
import { IndexingProgress } from './IndexingProgress';
import { CollapsibleSection } from '../common/CollapsibleSection';
import { useProjectStore } from '../../stores/projectStore';
import { HelperTooltip } from '../Methodology/HelperTooltip';
import { PDFRenameModal } from './PDFRenameModal';
import './PDFIndexPanel.css';

interface PDFDocument {
  id: string;
  title: string;
  author?: string;
  year?: string;
  bibtexKey?: string;
  pageCount: number;
  chunkCount?: number;
  indexedAt: Date;
}

interface IndexingState {
  isIndexing: boolean;
  currentFile?: string;
  progress: number;
  stage: string;
}

export const PDFIndexPanel: React.FC = () => {
  const { t } = useTranslation('common');
  const { currentProject } = useProjectStore();
  const [documents, setDocuments] = useState<PDFDocument[]>([]);
  const [indexingState, setIndexingState] = useState<IndexingState>({
    isIndexing: false,
    progress: 0,
    stage: '',
  });
  const [stats, setStats] = useState({
    totalDocuments: 0,
    totalChunks: 0,
  });
  const [isCleaning, setIsCleaning] = useState(false);
  const [showRenameModal, setShowRenameModal] = useState(false);
  const [pendingFiles, setPendingFiles] = useState<string[]>([]);

  useEffect(() => {
    loadDocuments();
    loadStats();
  }, []);

  const loadDocuments = async () => {
    try {
      const result = await window.electron.pdf.getAll();
      console.log('[PDFIndexPanel] getAll result:', result);
      if (result.success && Array.isArray(result.documents)) {
        setDocuments(result.documents);
      } else {
        console.error('[PDFIndexPanel] Invalid response from pdf.getAll:', result);
        setDocuments([]);
      }
    } catch (error) {
      console.error('[PDFIndexPanel] Failed to load documents:', error);
      setDocuments([]);
    }
  };

  const loadStats = async () => {
    try {
      const result = await window.electron.pdf.getStatistics();
      console.log('[PDFIndexPanel] getStatistics result:', result);
      if (result.success && result.statistics) {
        setStats({
          totalDocuments: result.statistics.totalDocuments,
          totalChunks: result.statistics.totalChunks,
        });
      } else {
        console.error('[PDFIndexPanel] Invalid response from pdf.getStatistics:', result);
        setStats({ totalDocuments: 0, totalChunks: 0 });
      }
    } catch (error) {
      console.error('[PDFIndexPanel] Failed to load stats:', error);
      setStats({ totalDocuments: 0, totalChunks: 0 });
    }
  };

  const handleAddPDF = async () => {
    // Check if a project is open BEFORE opening file dialog
    if (!currentProject) {
      alert(t('pdfIndex.noProjectOpen'));
      return;
    }

    try {
      const result = await window.electron.dialog.openFile({
        filters: [{ name: 'PDF', extensions: ['pdf'] }],
        properties: ['openFile', 'multiSelections'],
      });

      if (!result.canceled && result.filePaths && result.filePaths.length > 0) {
        // Show rename modal instead of indexing directly
        setPendingFiles(result.filePaths);
        setShowRenameModal(true);
      }
    } catch (error) {
      console.error('Failed to add PDF:', error);
    }
  };

  const handleConfirmRename = async (renamedFiles: Map<string, string>) => {
    setShowRenameModal(false);

    // Index each PDF with its custom name
    for (const [filePath, customTitle] of renamedFiles.entries()) {
      await indexPDF(filePath, customTitle);
    }

    setPendingFiles([]);
  };

  const indexPDF = async (filePath: string, customTitle?: string) => {
    setIndexingState({
      isIndexing: true,
      currentFile: filePath,
      progress: 0,
      stage: 'Initialisation...',
    });

    try {
      const result = await window.electron.pdf.index(filePath, undefined, (progress) => {
        setIndexingState({
          isIndexing: true,
          currentFile: filePath,
          progress: progress.progress,
          stage: progress.message,
        });
      }, customTitle);

      // Check if indexing failed
      if (result && !result.success) {
        const errorMessage = result.error || t('pdfIndex.indexingError');
        alert(errorMessage);
        setIndexingState({
          isIndexing: false,
          progress: 0,
          stage: t('pdfIndex.indexingError'),
        });
        return;
      }

      await loadDocuments();
      await loadStats();

      setIndexingState({
        isIndexing: false,
        progress: 100,
        stage: 'Terminé',
      });
    } catch (error) {
      console.error('Indexing failed:', error);
      const errorMessage = error instanceof Error ? error.message : t('pdfIndex.indexingError');
      alert(`${t('pdfIndex.indexingError')}: ${errorMessage}`);
      setIndexingState({
        isIndexing: false,
        progress: 0,
        stage: t('pdfIndex.indexingError'),
      });
    }
  };

  const handleDeletePDF = async (documentId: string) => {
    if (!window.confirm(t('pdfIndex.deleteConfirm'))) {
      return;
    }

    try {
      await window.electron.pdf.delete(documentId);
      await loadDocuments();
      await loadStats();
    } catch (error) {
      console.error('Failed to delete document:', error);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();

    // Check if a project is open BEFORE processing dropped files
    if (!currentProject) {
      alert(t('pdfIndex.noProjectOpen'));
      return;
    }

    const files = Array.from(e.dataTransfer.files).filter((file) =>
      file.name.toLowerCase().endsWith('.pdf')
    );

    for (const file of files) {
      await indexPDF(file.path);
    }
  };

  const handleLearnMore = () => {
    window.dispatchEvent(new CustomEvent('show-methodology-modal', { detail: { feature: 'pdfIndex' } }));
  };

  const handleCleanOrphanedChunks = async () => {
    if (!window.confirm(t('pdfIndex.cleanOrphanedConfirm'))) {
      return;
    }

    setIsCleaning(true);
    try {
      const result = await window.electron.pdf.cleanOrphanedChunks();

      if (result.success) {
        console.log('✅ Orphaned chunks cleaned successfully');
        alert(`✅ ${t('pdfIndex.cleanSuccess')}`);
      } else {
        console.error('❌ Failed to clean orphaned chunks:', result.error);
        alert(`❌ ${t('pdfIndex.cleanError')}:\n${result.error}`);
      }

      // Reload statistics
      await loadStats();
    } catch (error) {
      console.error('Failed to clean orphaned chunks:', error);
      alert(t('pdfIndex.cleanError'));
    } finally {
      setIsCleaning(false);
    }
  };

  return (
    <div className="pdf-index-panel">
      {/* Header */}
      <div className="pdf-header">
        <div className="header-title">
          <h3>{t('pdfIndex.title')}</h3>
          <HelperTooltip
            content={t('pdfIndex.dropzone')}
            onLearnMore={handleLearnMore}
          />
        </div>
        <button className="toolbar-btn" onClick={handleAddPDF} title={t('pdfIndex.addPDF')}>
          <Plus size={20} strokeWidth={1} />
        </button>
      </div>

      {/* Stats */}
      <CollapsibleSection title={t('pdfIndex.statistics')} defaultExpanded={false}>
        <div className="pdf-stats">
          <div className="stat-item">
            <span className="stat-value">{stats.totalDocuments}</span>
            <span className="stat-label">{t('pdfIndex.documents')}</span>
          </div>
          <div className="stat-divider">|</div>
          <div className="stat-item">
            <span className="stat-value">{stats.totalChunks}</span>
            <span className="stat-label">{t('pdfIndex.chunks')}</span>
          </div>
        </div>
        <div style={{ marginTop: '12px', paddingTop: '12px', borderTop: '1px solid #444' }}>
          <button
            className="config-btn-small"
            onClick={handleCleanOrphanedChunks}
            disabled={isCleaning}
            style={{
              width: '100%',
              background: '#3c3c3c',
              color: '#ffffff',
              border: '1px solid #555',
              padding: '8px 12px',
              borderRadius: '4px',
              cursor: isCleaning ? 'not-allowed' : 'pointer',
              fontSize: '13px',
            }}
          >
            {isCleaning ? `⏳ ${t('pdfIndex.cleaning')}` : `🧹 ${t('pdfIndex.cleanOrphanedChunks')}`}
          </button>
        </div>
      </CollapsibleSection>

      {/* Indexing Progress */}
      {indexingState.isIndexing && (
        <IndexingProgress
          fileName={indexingState.currentFile || ''}
          progress={indexingState.progress}
          stage={indexingState.stage}
        />
      )}

      {/* Document List */}
      <CollapsibleSection title={t('pdfIndex.documents')} defaultExpanded={true}>
        <div
          className="pdf-content"
          onDragOver={handleDragOver}
          onDrop={handleDrop}
        >
          {documents.length === 0 ? (
            <div className="pdf-empty">
              <div className="empty-icon">📂</div>
              <h4>{t('pdfIndex.noDocuments')}</h4>
              <p>{t('pdfIndex.dropzone')}</p>
            </div>
          ) : (
            <PDFList documents={documents} onDelete={handleDeletePDF} />
          )}
        </div>
      </CollapsibleSection>

      {/* PDF Rename Modal */}
      <PDFRenameModal
        isOpen={showRenameModal}
        onClose={() => {
          setShowRenameModal(false);
          setPendingFiles([]);
        }}
        files={pendingFiles}
        onConfirm={handleConfirmRename}
      />
    </div>
  );
};
