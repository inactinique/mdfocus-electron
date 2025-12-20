import React, { useState, useEffect } from 'react';
import { CollapsibleSection } from '../common/CollapsibleSection';

export const ActionsSection: React.FC = () => {
  const [stats, setStats] = useState({ totalDocuments: 0, totalChunks: 0, databasePath: '' });
  const [isPurging, setIsPurging] = useState(false);

  useEffect(() => {
    loadStats();
  }, []);

  const loadStats = async () => {
    try {
      const result = await window.electron.pdf.getStatistics();
      if (result.success && result.statistics) {
        setStats({
          totalDocuments: result.statistics.totalDocuments || 0,
          totalChunks: result.statistics.totalChunks || 0,
          databasePath: result.statistics.databasePath || '',
        });
      }
    } catch (error) {
      console.error('Failed to load stats:', error);
    }
  };

  const handlePurgeDatabase = async () => {
    const confirmMessage = `⚠️ ATTENTION ⚠️

Cette action va supprimer DÉFINITIVEMENT:
• ${stats.totalDocuments} document(s)
• ${stats.totalChunks} chunk(s)
• Tous les embeddings associés

Vous devrez ré-indexer tous vos PDFs.

Êtes-vous absolument sûr de vouloir continuer ?`;

    if (!window.confirm(confirmMessage)) {
      return;
    }

    // Double confirmation
    if (!window.confirm('Dernière confirmation: Cette action est IRRÉVERSIBLE. Continuer ?')) {
      return;
    }

    setIsPurging(true);
    try {
      // TODO: Implement purge endpoint
      console.log('Purging database...');
      alert('Fonction de purge à implémenter');
      await loadStats();
    } catch (error) {
      console.error('Failed to purge database:', error);
      alert('Erreur lors de la purge de la base de données');
    } finally {
      setIsPurging(false);
    }
  };

  const handleOpenDatabaseFolder = () => {
    if (stats.databasePath) {
      // Extract directory from full path
      const directory = stats.databasePath.split('/').slice(0, -1).join('/');
      window.electron.shell?.openPath(directory);
    }
  };

  const handleCopyDatabasePath = () => {
    if (stats.databasePath) {
      navigator.clipboard.writeText(stats.databasePath);
      alert('Chemin copié dans le presse-papier');
    }
  };

  return (
    <CollapsibleSection title="Actions & Maintenance" defaultExpanded={false}>
      <div className="config-section">
        <div className="config-section-content">
          {/* Database Info */}
          <div className="config-field">
            <label className="config-label">
              Base de données vectorielle
            </label>
            <div className="config-description" style={{ marginTop: '8px' }}>
              <strong>Documents indexés:</strong> {stats.totalDocuments}
              <br />
              <strong>Chunks stockés:</strong> {stats.totalChunks}
              <br />
              <strong>Chemin:</strong>
              <div style={{
                marginTop: '4px',
                padding: '8px',
                background: '#3c3c3c',
                borderRadius: '4px',
                fontSize: '12px',
                fontFamily: 'monospace',
                wordBreak: 'break-all',
              }}>
                {stats.databasePath || 'Chargement...'}
              </div>
              <div style={{ marginTop: '8px', display: 'flex', gap: '8px' }}>
                <button
                  className="config-btn-small"
                  onClick={handleCopyDatabasePath}
                  disabled={!stats.databasePath}
                >
                  📋 Copier le chemin
                </button>
                <button
                  className="config-btn-small"
                  onClick={handleOpenDatabaseFolder}
                  disabled={!stats.databasePath}
                >
                  📂 Ouvrir le dossier
                </button>
              </div>
            </div>
          </div>

          {/* Purge Database */}
          <div className="config-field" style={{ marginTop: '24px' }}>
            <label className="config-label" style={{ color: '#f48771' }}>
              ⚠️ Zone dangereuse
            </label>
            <div className="config-description">
              <strong>Purger la base vectorielle</strong>
              <br />
              <small>
                Supprime tous les documents, chunks et embeddings.
                <br />
                Cette action est irréversible!
              </small>
            </div>
            <button
              className="config-btn-small"
              onClick={handlePurgeDatabase}
              disabled={isPurging || stats.totalDocuments === 0}
              style={{
                marginTop: '8px',
                background: '#c72e0f',
                color: '#ffffff',
                border: 'none',
              }}
            >
              {isPurging ? '⏳ Purge en cours...' : '🗑️ Purger la base de données'}
            </button>
          </div>
        </div>
      </div>
    </CollapsibleSection>
  );
};
