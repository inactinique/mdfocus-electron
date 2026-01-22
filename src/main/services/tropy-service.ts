import { BrowserWindow } from 'electron';
import * as path from 'path';
import * as fs from 'fs';
import { TropyReader, TropyItem, PrimarySourceItem } from '../../../backend/integrations/tropy/TropyReader.js';
import { TropySync, TropySyncOptions, TropySyncResult, TropySyncProgress } from '../../../backend/integrations/tropy/TropySync.js';
import { TropyWatcher } from '../../../backend/integrations/tropy/TropyWatcher.js';
import { TropyOCRPipeline, OCRResult, TranscriptionFormat, SUPPORTED_OCR_LANGUAGES } from '../../../backend/integrations/tropy/TropyOCRPipeline.js';
import { PrimarySourcesVectorStore, PrimarySourceDocument, PrimarySourceSearchResult, PrimarySourcesStatistics } from '../../../backend/core/vector-store/PrimarySourcesVectorStore.js';

// MARK: - Types

export interface TropyProjectInfo {
  name: string;
  itemCount: number;
  lastModified: string;
  isWatching: boolean;
}

export interface TropyOpenResult {
  success: boolean;
  projectName?: string;
  itemCount?: number;
  lastModified?: string;
  error?: string;
}

export interface TropySearchResult {
  success: boolean;
  results?: PrimarySourceSearchResult[];
  error?: string;
}

// MARK: - TropyService

class TropyService {
  private vectorStore: PrimarySourcesVectorStore | null = null;
  private tropySync: TropySync | null = null;
  private watcher: TropyWatcher | null = null;
  private ocrPipeline: TropyOCRPipeline | null = null;
  private currentTPYPath: string | null = null;
  private projectPath: string | null = null;

  /**
   * Initialise le service Tropy pour un projet
   */
  async init(projectPath: string): Promise<void> {
    this.projectPath = projectPath;
    this.vectorStore = new PrimarySourcesVectorStore(projectPath);
    this.tropySync = new TropySync();
    this.watcher = new TropyWatcher();
    this.ocrPipeline = new TropyOCRPipeline();

    // Vérifier s'il y a un projet Tropy déjà enregistré
    const existingProject = this.vectorStore.getTropyProject();
    if (existingProject) {
      this.currentTPYPath = existingProject.tpyPath;
      console.log(`📚 Tropy project loaded: ${existingProject.name}`);

      // Démarrer le watcher si auto-sync était activé
      if (existingProject.autoSync && fs.existsSync(existingProject.tpyPath)) {
        this.startWatching(existingProject.tpyPath);
      }
    }
  }

  /**
   * Ferme le service et libère les ressources
   */
  async close(): Promise<void> {
    this.stopWatching();
    await this.ocrPipeline?.dispose();
    this.vectorStore?.close();

    this.vectorStore = null;
    this.tropySync = null;
    this.watcher = null;
    this.ocrPipeline = null;
    this.currentTPYPath = null;
    this.projectPath = null;
  }

  /**
   * Vérifie si le service est initialisé
   */
  isInitialized(): boolean {
    return this.vectorStore !== null;
  }

  // MARK: - Project Management

  /**
   * Ouvre un projet Tropy (.tpy) en lecture seule
   */
  async openProject(tpyPath: string): Promise<TropyOpenResult> {
    try {
      if (!fs.existsSync(tpyPath)) {
        return { success: false, error: `File not found: ${tpyPath}` };
      }

      const reader = new TropyReader();
      reader.openProject(tpyPath);

      const projectInfo = reader.getProjectInfo();
      reader.closeProject();

      this.currentTPYPath = tpyPath;

      console.log(`📚 Opened Tropy project: ${projectInfo.name} (${projectInfo.itemCount} items)`);

      return {
        success: true,
        projectName: projectInfo.name,
        itemCount: projectInfo.itemCount,
        lastModified: projectInfo.lastModified.toISOString(),
      };
    } catch (error: any) {
      console.error('Failed to open Tropy project:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Retourne les informations du projet Tropy actuel
   */
  getProjectInfo(): TropyProjectInfo | null {
    if (!this.vectorStore) return null;

    const project = this.vectorStore.getTropyProject();
    if (!project) return null;

    return {
      name: project.name,
      itemCount: this.vectorStore.getStatistics().sourceCount,
      lastModified: project.lastSync,
      isWatching: this.watcher?.isActive() || false,
    };
  }

  // MARK: - Synchronization

  /**
   * Synchronise le projet Tropy avec ClioDeck
   * Inclut la génération des embeddings pour la recherche vectorielle
   */
  async sync(options: TropySyncOptions): Promise<TropySyncResult> {
    if (!this.tropySync || !this.vectorStore || !this.currentTPYPath) {
      return {
        success: false,
        projectName: '',
        totalItems: 0,
        newItems: 0,
        updatedItems: 0,
        skippedItems: 0,
        ocrPerformed: 0,
        transcriptionsImported: 0,
        errors: ['Service not initialized or no project opened'],
      };
    }

    // Notifier la progression via IPC
    const onProgress = (progress: TropySyncProgress) => {
      BrowserWindow.getAllWindows().forEach((win) => {
        win.webContents.send('tropy:sync-progress', progress);
      });
    };

    // Phase 1: Synchroniser les métadonnées
    const result = await this.tropySync.sync(
      this.currentTPYPath,
      this.vectorStore,
      options,
      onProgress
    );

    // Phase 2: Générer les embeddings pour les sources avec du texte
    if (result.success && (result.newItems > 0 || result.updatedItems > 0 || options.forceReindex)) {
      try {
        console.log('📐 [TROPY-SERVICE] Starting embedding generation...');
        const embeddingResult = await this.generateEmbeddingsForSources(onProgress);
        console.log(`📐 [TROPY-SERVICE] Embeddings generated: ${embeddingResult.chunksCreated} chunks for ${embeddingResult.sourcesProcessed} sources`);
      } catch (error: any) {
        console.error('❌ [TROPY-SERVICE] Embedding generation failed:', error);
        result.errors.push(`Embedding generation failed: ${error.message}`);
      }
    }

    return result;
  }

  /**
   * Génère les embeddings pour toutes les sources qui n'en ont pas encore
   */
  private async generateEmbeddingsForSources(
    onProgress?: (progress: TropySyncProgress) => void
  ): Promise<{ sourcesProcessed: number; chunksCreated: number }> {
    if (!this.vectorStore) {
      return { sourcesProcessed: 0, chunksCreated: 0 };
    }

    // Import OllamaClient dynamically to avoid circular dependencies
    const { pdfService } = await import('./pdf-service.js');
    const ollamaClient = pdfService.getOllamaClient();

    if (!ollamaClient) {
      console.warn('⚠️ [TROPY-SERVICE] OllamaClient not available, skipping embedding generation');
      return { sourcesProcessed: 0, chunksCreated: 0 };
    }

    // Récupérer toutes les sources
    const allSources = this.vectorStore.getAllSources();
    let sourcesProcessed = 0;
    let chunksCreated = 0;

    // Filtrer les sources qui ont du texte mais pas encore de chunks
    const sourcesToProcess = allSources.filter(source => {
      // Vérifier si la source a du texte (transcription ou métadonnées)
      const hasText = source.transcription && source.transcription.trim().length > 0;
      if (!hasText) return false;

      // Vérifier si la source a déjà des chunks
      const existingChunks = this.vectorStore!.getChunks(source.id);
      return existingChunks.length === 0;
    });

    if (sourcesToProcess.length === 0) {
      console.log('📐 [TROPY-SERVICE] No sources need embedding generation');
      return { sourcesProcessed: 0, chunksCreated: 0 };
    }

    console.log(`📐 [TROPY-SERVICE] Processing ${sourcesToProcess.length} sources for embeddings...`);

    for (let i = 0; i < sourcesToProcess.length; i++) {
      const source = sourcesToProcess[i];

      onProgress?.({
        phase: 'indexing',
        current: i + 1,
        total: sourcesToProcess.length,
        currentItem: source.title,
      });

      try {
        // Créer le texte complet pour le chunking
        let fullText = '';
        if (source.title) fullText += `Titre: ${source.title}\n\n`;
        if (source.creator) fullText += `Auteur: ${source.creator}\n`;
        if (source.date) fullText += `Date: ${source.date}\n`;
        if (source.archive) fullText += `Archive: ${source.archive}\n`;
        if (source.collection) fullText += `Collection: ${source.collection}\n`;
        fullText += '\n';
        if (source.transcription) fullText += source.transcription;

        // Simple chunking (split by paragraphs or fixed size)
        const chunks = this.chunkText(fullText, source.id, 1000, 100);

        // Générer les embeddings pour chaque chunk
        for (const chunk of chunks) {
          try {
            const embedding = await ollamaClient.generateEmbedding(chunk.content);
            this.vectorStore!.saveChunk(chunk, embedding);
            chunksCreated++;
          } catch (error) {
            console.warn(`⚠️ [TROPY-SERVICE] Failed to generate embedding for chunk in source ${source.id}:`, error);
          }
        }

        sourcesProcessed++;
      } catch (error) {
        console.error(`❌ [TROPY-SERVICE] Failed to process source ${source.id}:`, error);
      }
    }

    return { sourcesProcessed, chunksCreated };
  }

  /**
   * Découpe un texte en chunks pour l'indexation
   */
  private chunkText(
    text: string,
    sourceId: string,
    maxChunkSize: number = 1000,
    overlap: number = 100
  ): Array<{ id: string; sourceId: string; content: string; chunkIndex: number; startPosition: number; endPosition: number }> {
    const chunks: Array<{ id: string; sourceId: string; content: string; chunkIndex: number; startPosition: number; endPosition: number }> = [];

    // Split by paragraphs first
    const paragraphs = text.split(/\n\n+/);
    let currentChunk = '';
    let chunkIndex = 0;
    let startPosition = 0;

    for (const paragraph of paragraphs) {
      const trimmedParagraph = paragraph.trim();
      if (!trimmedParagraph) continue;

      // If adding this paragraph would exceed max size, save current chunk
      if (currentChunk && (currentChunk.length + trimmedParagraph.length + 2) > maxChunkSize) {
        chunks.push({
          id: `${sourceId}-chunk-${chunkIndex}`,
          sourceId,
          content: currentChunk.trim(),
          chunkIndex,
          startPosition,
          endPosition: startPosition + currentChunk.length,
        });

        // Start new chunk with overlap
        const words = currentChunk.split(/\s+/);
        const overlapWords = words.slice(-Math.ceil(overlap / 5)); // Approximate word count for overlap
        currentChunk = overlapWords.join(' ') + '\n\n' + trimmedParagraph;
        startPosition = startPosition + currentChunk.length - overlap;
        chunkIndex++;
      } else {
        currentChunk = currentChunk ? currentChunk + '\n\n' + trimmedParagraph : trimmedParagraph;
      }
    }

    // Don't forget the last chunk
    if (currentChunk.trim()) {
      chunks.push({
        id: `${sourceId}-chunk-${chunkIndex}`,
        sourceId,
        content: currentChunk.trim(),
        chunkIndex,
        startPosition,
        endPosition: text.length,
      });
    }

    return chunks;
  }

  /**
   * Vérifie si une synchronisation est nécessaire
   */
  checkSyncNeeded(): boolean {
    if (!this.tropySync || !this.vectorStore || !this.currentTPYPath) {
      return false;
    }

    return this.tropySync.checkSyncNeeded(this.currentTPYPath, this.vectorStore);
  }

  // MARK: - File Watching

  /**
   * Démarre la surveillance du fichier .tpy
   */
  startWatching(tpyPath?: string): { success: boolean; error?: string } {
    const pathToWatch = tpyPath || this.currentTPYPath;

    if (!pathToWatch) {
      return { success: false, error: 'No project path specified' };
    }

    if (!this.watcher) {
      this.watcher = new TropyWatcher();
    }

    // Configurer le callback de changement
    this.watcher.on('change', async (changedPath: string) => {
      console.log(`📝 Tropy file changed: ${changedPath}`);

      // Notifier le renderer
      BrowserWindow.getAllWindows().forEach((win) => {
        win.webContents.send('tropy:file-changed', changedPath);
      });

      // Auto-sync si configuré
      const project = this.vectorStore?.getTropyProject();
      if (project?.autoSync) {
        await this.sync({
          performOCR: false,
          ocrLanguage: 'fra',
        });
      }
    });

    this.watcher.on('error', (error: Error) => {
      console.error('Tropy watcher error:', error);
      BrowserWindow.getAllWindows().forEach((win) => {
        win.webContents.send('tropy:watcher-error', error.message);
      });
    });

    this.watcher.watch(pathToWatch);
    this.currentTPYPath = pathToWatch;

    return { success: true };
  }

  /**
   * Arrête la surveillance
   */
  stopWatching(): void {
    this.watcher?.unwatch();
  }

  /**
   * Vérifie si le watcher est actif
   */
  isWatching(): boolean {
    return this.watcher?.isActive() || false;
  }

  // MARK: - OCR

  /**
   * Effectue l'OCR sur une image
   */
  async performOCR(
    imagePath: string,
    language: string
  ): Promise<{ success: boolean; text?: string; confidence?: number; error?: string }> {
    try {
      if (!this.ocrPipeline) {
        this.ocrPipeline = new TropyOCRPipeline();
      }

      const result = await this.ocrPipeline.performOCR(imagePath, { language });

      return {
        success: true,
        text: result.text,
        confidence: result.confidence,
      };
    } catch (error: any) {
      console.error('OCR failed:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Effectue l'OCR sur plusieurs images
   */
  async performBatchOCR(
    imagePaths: string[],
    language: string
  ): Promise<{ success: boolean; text?: string; confidence?: number; error?: string }> {
    try {
      if (!this.ocrPipeline) {
        this.ocrPipeline = new TropyOCRPipeline();
      }

      const result = await this.ocrPipeline.performBatchOCR(imagePaths, { language });

      return {
        success: true,
        text: result.text,
        confidence: result.confidence,
      };
    } catch (error: any) {
      console.error('Batch OCR failed:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Retourne les langues OCR supportées
   */
  getSupportedOCRLanguages(): Array<{ code: string; name: string }> {
    return [...SUPPORTED_OCR_LANGUAGES];
  }

  // MARK: - Transcription Import

  /**
   * Importe une transcription externe
   */
  async importTranscription(
    filePath: string,
    type?: TranscriptionFormat
  ): Promise<{ success: boolean; text?: string; format?: TranscriptionFormat; error?: string }> {
    try {
      if (!this.ocrPipeline) {
        this.ocrPipeline = new TropyOCRPipeline();
      }

      // Détecter le format si non spécifié
      const format = type || this.ocrPipeline.detectFormat(filePath);
      if (!format) {
        return { success: false, error: 'Could not detect transcription format' };
      }

      const result = await this.ocrPipeline.importTranscription({ type: format, filePath });

      return {
        success: true,
        text: result.text,
        format: result.format,
      };
    } catch (error: any) {
      console.error('Transcription import failed:', error);
      return { success: false, error: error.message };
    }
  }

  // MARK: - Search

  /**
   * Recherche dans les sources primaires
   * Accepte une query text et des options, génère l'embedding via OllamaClient
   */
  async search(
    query: string,
    options?: { topK?: number; threshold?: number }
  ): Promise<Array<PrimarySourceSearchResult & { source?: any }>> {
    if (!this.vectorStore) {
      console.warn('⚠️ [TROPY-SERVICE] VectorStore not initialized');
      return [];
    }

    const topK = options?.topK || 10;
    const threshold = options?.threshold || 0.3;

    try {
      // Import OllamaClient dynamically to avoid circular dependencies
      const { pdfService } = await import('./pdf-service.js');
      const ollamaClient = pdfService.getOllamaClient();

      if (!ollamaClient) {
        console.warn('⚠️ [TROPY-SERVICE] OllamaClient not available, cannot generate embedding');
        return [];
      }

      // Generate embedding for the query
      const queryEmbedding = await ollamaClient.generateEmbedding(query);

      // Search in primary sources vector store
      const results = this.vectorStore.search(queryEmbedding, topK);

      // Filter by threshold - results already include source data
      const enrichedResults = results.filter((r) => r.similarity >= threshold);

      console.log(`📜 [TROPY-SERVICE] Search found ${enrichedResults.length} results (threshold: ${threshold})`);

      return enrichedResults;
    } catch (error) {
      console.error('❌ [TROPY-SERVICE] Search failed:', error);
      return [];
    }
  }

  /**
   * Recherche avec un embedding pré-calculé
   */
  searchWithEmbedding(
    queryEmbedding: Float32Array,
    topK: number = 10
  ): PrimarySourceSearchResult[] {
    if (!this.vectorStore) {
      return [];
    }

    return this.vectorStore.search(queryEmbedding, topK);
  }

  /**
   * Récupère toutes les sources primaires
   */
  getAllSources(): PrimarySourceDocument[] {
    if (!this.vectorStore) {
      return [];
    }

    return this.vectorStore.getAllSources();
  }

  /**
   * Récupère une source par son ID
   */
  getSource(id: string): PrimarySourceDocument | null {
    if (!this.vectorStore) {
      return null;
    }

    return this.vectorStore.getSource(id);
  }

  // MARK: - Statistics

  /**
   * Retourne les statistiques des sources primaires
   */
  getStatistics(): PrimarySourcesStatistics | null {
    if (!this.vectorStore) {
      return null;
    }

    return this.vectorStore.getStatistics();
  }

  /**
   * Retourne tous les tags
   */
  getAllTags(): string[] {
    if (!this.vectorStore) {
      return [];
    }

    return this.vectorStore.getAllTags();
  }

  // MARK: - Indexing

  /**
   * Met à jour la transcription d'une source
   */
  async updateSourceTranscription(
    sourceId: string,
    transcription: string,
    source: 'tesseract' | 'transkribus' | 'manual'
  ): Promise<{ success: boolean; error?: string }> {
    try {
      if (!this.vectorStore) {
        return { success: false, error: 'Service not initialized' };
      }

      this.vectorStore.updateSource(sourceId, {
        transcription,
        transcriptionSource: source,
        lastModified: new Date(),
      });

      return { success: true };
    } catch (error: any) {
      console.error('Failed to update transcription:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Supprime les chunks existants et réindexe une source
   */
  async reindexSource(sourceId: string): Promise<{ success: boolean; error?: string }> {
    try {
      if (!this.vectorStore) {
        return { success: false, error: 'Service not initialized' };
      }

      // Supprimer les chunks existants
      this.vectorStore.deleteChunks(sourceId);

      // TODO: Regénérer les chunks et embeddings
      // Cela nécessite l'accès à OllamaClient pour les embeddings

      return { success: true };
    } catch (error: any) {
      console.error('Failed to reindex source:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Purge la base de données des sources primaires
   * Supprime toutes les sources, chunks, photos et tags
   */
  async purge(): Promise<{ success: boolean; error?: string }> {
    try {
      if (!this.vectorStore || !this.projectPath) {
        return { success: false, error: 'Service not initialized' };
      }

      // Fermer la base de données actuelle
      this.vectorStore.close();

      // Supprimer le fichier de base de données
      const dbPath = path.join(this.projectPath, '.cliodeck', 'primary-sources.db');
      if (fs.existsSync(dbPath)) {
        fs.unlinkSync(dbPath);
        console.log(`🗑️ Deleted primary sources database: ${dbPath}`);
      }

      // Réinitialiser le vectorStore (crée une nouvelle base vide)
      this.vectorStore = new PrimarySourcesVectorStore(this.projectPath);
      this.currentTPYPath = null;

      return { success: true };
    } catch (error: any) {
      console.error('Failed to purge primary sources database:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Retourne le chemin de la base de données
   */
  getDatabasePath(): string | null {
    if (!this.projectPath) return null;
    return path.join(this.projectPath, '.cliodeck', 'primary-sources.db');
  }
}

// Singleton
export const tropyService = new TropyService();
