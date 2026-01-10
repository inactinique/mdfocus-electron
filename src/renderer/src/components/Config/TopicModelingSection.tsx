/**
 * TopicModelingSection - Gestion de l'environnement Python pour le topic modeling
 */
import React, { useState, useEffect } from 'react';
import './ConfigPanel.css';

interface TopicModelingStatus {
  installed: boolean;
  venvPath?: string;
  pythonVersion?: string;
  error?: string;
}

export const TopicModelingSection: React.FC = () => {
  const [status, setStatus] = useState<TopicModelingStatus | null>(null);
  const [loading, setLoading] = useState(false);
  const [installing, setInstalling] = useState(false);
  const [installProgress, setInstallProgress] = useState<string[]>([]);

  // Charger le statut au montage
  useEffect(() => {
    checkStatus();
  }, []);

  const checkStatus = async () => {
    setLoading(true);
    try {
      const result = await window.electron.topicModeling.checkStatus();
      console.log('Topic modeling status result:', result);
      if (result.success) {
        setStatus(result.data);
      } else {
        setStatus({ installed: false, error: result.error });
      }
    } catch (error: any) {
      console.error('Failed to check topic modeling status:', error);
      setStatus({ installed: false, error: error.message || 'Erreur inconnue' });
    } finally {
      setLoading(false);
    }
  };

  const setupEnvironment = async () => {
    setInstalling(true);
    setInstallProgress([]);

    // Écouter les messages de progression
    const removeListener = window.electron.topicModeling.onSetupProgress((message) => {
      setInstallProgress((prev) => [...prev, message]);
    });

    try {
      const result = await window.electron.topicModeling.setupEnvironment();

      if (result.success && result.data.success) {
        setInstallProgress((prev) => [...prev, '✅ Installation terminée avec succès']);
        // Recharger le statut
        await checkStatus();
      } else {
        setInstallProgress((prev) => [
          ...prev,
          `❌ Erreur: ${result.data?.error || result.error || 'Installation échouée'}`,
        ]);
      }
    } catch (error: any) {
      console.error('Failed to setup environment:', error);
      setInstallProgress((prev) => [...prev, `❌ Erreur: ${error.message}`]);
    } finally {
      setInstalling(false);
      removeListener();
    }
  };

  if (loading) {
    return (
      <div className="config-section">
        <div className="config-group">
          <label className="config-label">Topic Modeling (Optionnel)</label>
          <p className="config-help">Chargement...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="config-section">
      <div className="config-group">
        <label className="config-label">Topic Modeling (Optionnel)</label>
        <p className="config-help">
          Le topic modeling utilise BERTopic (Python) pour identifier les thèmes principaux dans votre corpus.
          Cette fonctionnalité est optionnelle et nécessite l'installation d'un environnement Python.
        </p>

        {status ? (
          <div className="topic-modeling-status">
            <div className={`status-indicator ${status.installed ? 'status-success' : 'status-warning'}`}>
              <span className="status-dot"></span>
              <span className="status-text">
                {status.installed ? 'Environnement installé' : 'Non installé'}
              </span>
            </div>

            {status.installed && status.pythonVersion && (
              <div className="status-details">
                <p>Version Python: {status.pythonVersion}</p>
                <p className="status-path">Venv: {status.venvPath}</p>
              </div>
            )}

            {status.error && !status.installed && (
              <div className="status-error">
                <p>⚠️ {status.error}</p>
              </div>
            )}
          </div>
        ) : (
          <div className="topic-modeling-status">
            <div className="status-indicator status-warning">
              <span className="status-dot"></span>
              <span className="status-text">Statut inconnu</span>
            </div>
          </div>
        )}

        <div className="config-actions">
          {(!status || !status.installed) && (
            <button onClick={setupEnvironment} disabled={installing} className="btn-primary">
              {installing ? 'Installation en cours...' : 'Installer l\'environnement Python'}
            </button>
          )}

          {status && status.installed && (
            <>
              <button onClick={setupEnvironment} disabled={installing} className="btn-secondary">
                {installing ? 'Réinstallation en cours...' : 'Réinstaller'}
              </button>
              <button onClick={checkStatus} disabled={loading || installing} className="btn-secondary">
                Vérifier
              </button>
            </>
          )}
        </div>

        {installing && installProgress.length > 0 && (
          <div className="install-progress">
            <div className="progress-log">
              {installProgress.map((msg, idx) => (
                <div key={idx} className="progress-message">
                  {msg}
                </div>
              ))}
            </div>
          </div>
        )}

        {!installing && installProgress.length > 0 && (
          <button onClick={() => setInstallProgress([])} className="btn-text">
            Effacer le log
          </button>
        )}
      </div>
    </div>
  );
};
