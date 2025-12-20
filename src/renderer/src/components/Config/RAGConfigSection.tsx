import React from 'react';
import { CollapsibleSection } from '../common/CollapsibleSection';
import type { RAGConfig } from './ConfigPanel';

interface RAGConfigSectionProps {
  config: RAGConfig;
  onChange: (config: RAGConfig) => void;
}

export const RAGConfigSection: React.FC<RAGConfigSectionProps> = ({ config, onChange }) => {

  const handleTopKChange = (value: number) => {
    onChange({ ...config, topK: value });
  };

  const handleThresholdChange = (value: number) => {
    onChange({ ...config, similarityThreshold: value });
  };

  const handleChunkingChange = (value: 'cpuOptimized' | 'standard' | 'large') => {
    onChange({ ...config, chunkingConfig: value });
  };

  return (
    <CollapsibleSection title="Configuration RAG" defaultExpanded={true}>
      <div className="config-section">
        <div className="config-section-content">
          {/* Top K */}
          <div className="config-field">
            <label className="config-label">
              Nombre de chunks (topK)
              <span className="config-help">
                Nombre maximum de chunks récupérés pour répondre à une question
              </span>
            </label>
            <div className="config-input-group">
              <input
                type="range"
                min="1"
                max="20"
                value={config.topK}
                onChange={(e) => handleTopKChange(parseInt(e.target.value))}
                className="config-slider"
              />
              <input
                type="number"
                min="1"
                max="20"
                value={config.topK}
                onChange={(e) => handleTopKChange(parseInt(e.target.value))}
                className="config-number"
              />
            </div>
            <div className="config-description">
              Valeur actuelle: {config.topK} chunks
              <br />
              <small>
                • 1-5: Réponses rapides, contexte limité
                <br />
                • 6-10: Équilibre vitesse/contexte (recommandé)
                <br />
                • 11-20: Maximum de contexte, plus lent
              </small>
            </div>
          </div>

          {/* Similarity Threshold */}
          <div className="config-field">
            <label className="config-label">
              Seuil de similarité
              <span className="config-help">
                Score minimum de similarité pour inclure un chunk (0.0 - 1.0)
              </span>
            </label>
            <div className="config-input-group">
              <input
                type="range"
                min="0"
                max="1"
                step="0.05"
                value={config.similarityThreshold}
                onChange={(e) => handleThresholdChange(parseFloat(e.target.value))}
                className="config-slider"
              />
              <input
                type="number"
                min="0"
                max="1"
                step="0.05"
                value={config.similarityThreshold}
                onChange={(e) => handleThresholdChange(parseFloat(e.target.value))}
                className="config-number"
              />
            </div>
            <div className="config-description">
              Valeur actuelle: {config.similarityThreshold.toFixed(2)}
              <br />
              <small>
                • 0.0-0.2: Plus de résultats, moins précis
                <br />
                • 0.2-0.4: Équilibre (recommandé)
                <br />
                • 0.4-1.0: Très précis, risque de ne rien trouver
              </small>
            </div>
          </div>

          {/* Chunking Configuration */}
          <div className="config-field">
            <label className="config-label">
              Stratégie de découpage
              <span className="config-help">
                Taille des chunks lors de l'indexation
              </span>
            </label>
            <select
              value={config.chunkingConfig}
              onChange={(e) => handleChunkingChange(e.target.value as any)}
              className="config-select"
            >
              <option value="cpuOptimized">Optimisé CPU (petits chunks, rapide)</option>
              <option value="standard">Standard (équilibré)</option>
              <option value="large">Large (gros chunks, plus de contexte)</option>
            </select>
            <div className="config-description">
              <small>
                ⚠️ Changer cette option nécessite de ré-indexer tous les PDFs
              </small>
            </div>
          </div>
        </div>
      </div>
    </CollapsibleSection>
  );
};
