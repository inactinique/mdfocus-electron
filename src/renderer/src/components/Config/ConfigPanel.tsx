import React, { useState, useEffect } from 'react';
import { RAGConfigSection } from './RAGConfigSection';
import { LLMConfigSection } from './LLMConfigSection';
import { EditorConfigSection, type EditorConfig } from './EditorConfigSection';
import { UIConfigSection } from './UIConfigSection';
import { ActionsSection } from './ActionsSection';
import './ConfigPanel.css';

export interface RAGConfig {
  topK: number;
  similarityThreshold: number;
  chunkingConfig: 'cpuOptimized' | 'standard' | 'large';
}

export interface LLMConfig {
  backend: 'ollama' | 'claude' | 'openai';
  ollamaURL: string;
  ollamaEmbeddingModel: string;
  ollamaChatModel: string;
}

export const ConfigPanel: React.FC = () => {
  const [ragConfig, setRagConfig] = useState<RAGConfig>({
    topK: 10,
    similarityThreshold: 0.2,
    chunkingConfig: 'cpuOptimized',
  });

  const [llmConfig, setLLMConfig] = useState<LLMConfig>({
    backend: 'ollama',
    ollamaURL: 'http://localhost:11434',
    ollamaEmbeddingModel: 'nomic-embed-text',
    ollamaChatModel: 'gemma2:2b',
  });

  const [editorConfig, setEditorConfig] = useState<EditorConfig>({
    fontSize: 14,
    wordWrap: true,
    showMinimap: true,
  });

  const [availableModels, setAvailableModels] = useState<string[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState('');

  // Load configuration on mount
  useEffect(() => {
    loadConfig();
  }, []);

  const loadConfig = async () => {
    try {
      const rag = await window.electron.config.get('rag');
      const llm = await window.electron.config.get('llm');
      const editor = await window.electron.config.get('editor');

      if (rag) setRagConfig(rag);
      if (llm) setLLMConfig(llm);
      if (editor) setEditorConfig(editor);
    } catch (error) {
      console.error('Failed to load config:', error);
    }
  };

  const handleSaveConfig = async () => {
    setIsSaving(true);
    setSaveMessage('');

    try {
      await window.electron.config.set('rag', ragConfig);
      await window.electron.config.set('llm', llmConfig);
      await window.electron.config.set('editor', editorConfig);

      setSaveMessage('✅ Configuration sauvegardée');
      setTimeout(() => setSaveMessage(''), 3000);
    } catch (error) {
      console.error('Failed to save config:', error);
      setSaveMessage('❌ Erreur lors de la sauvegarde');
    } finally {
      setIsSaving(false);
    }
  };

  const handleResetConfig = async () => {
    if (!window.confirm('Réinitialiser la configuration aux valeurs par défaut ?')) {
      return;
    }

    try {
      // Reset to defaults
      setRagConfig({
        topK: 10,
        similarityThreshold: 0.2,
        chunkingConfig: 'cpuOptimized',
      });
      setLLMConfig({
        backend: 'ollama',
        ollamaURL: 'http://localhost:11434',
        ollamaEmbeddingModel: 'nomic-embed-text',
        ollamaChatModel: 'gemma2:2b',
      });
      setEditorConfig({
        fontSize: 14,
        wordWrap: true,
        showMinimap: true,
      });

      await handleSaveConfig();
    } catch (error) {
      console.error('Failed to reset config:', error);
    }
  };

  return (
    <div className="config-panel">
      <div className="config-header">
        <h2>Configuration</h2>
        <div className="config-actions">
          {saveMessage && <span className="save-message">{saveMessage}</span>}
          <button
            className="config-btn secondary"
            onClick={handleResetConfig}
          >
            🔄 Réinitialiser
          </button>
          <button
            className="config-btn primary"
            onClick={handleSaveConfig}
            disabled={isSaving}
          >
            💾 {isSaving ? 'Sauvegarde...' : 'Sauvegarder'}
          </button>
        </div>
      </div>

      <div className="config-content">
        <UIConfigSection />

        <RAGConfigSection
          config={ragConfig}
          onChange={setRagConfig}
        />

        <LLMConfigSection
          config={llmConfig}
          onChange={setLLMConfig}
          availableModels={availableModels}
          onRefreshModels={() => {/* TODO */}}
        />

        <EditorConfigSection
          config={editorConfig}
          onChange={setEditorConfig}
        />

        <ActionsSection />
      </div>
    </div>
  );
};
