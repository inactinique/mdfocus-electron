// @ts-nocheck
import { pdfService } from './pdf-service.js';
import { BrowserWindow } from 'electron';

class ChatService {
  private currentStream: any = null;

  async sendMessage(
    message: string,
    options: { context?: boolean; window?: BrowserWindow } = {}
  ): Promise<string> {
    try {
      // Obtenir le client Ollama
      const ollamaClient = pdfService.getOllamaClient();
      if (!ollamaClient) {
        throw new Error('Ollama client not initialized');
      }

      let fullResponse = '';
      let searchResults: any[] = [];

      // Si contexte activé, rechercher dans les documents
      if (options.context) {
        // Use topK from options or let pdfService.search use the config default
        searchResults = await pdfService.search(message, { topK: options.topK });

        if (searchResults.length > 0) {
          console.log(`📚 Using ${searchResults.length} context chunks for RAG`);
        }
      }

      // Stream la réponse avec contexte RAG si disponible
      if (searchResults.length > 0) {
        // Utiliser generateResponseStreamWithSources pour RAG
        const generator = ollamaClient.generateResponseStreamWithSources(message, searchResults);
        this.currentStream = generator;

        for await (const chunk of generator) {
          fullResponse += chunk;
          // Envoyer le chunk au renderer si une fenêtre est fournie
          if (options.window) {
            options.window.webContents.send('chat:stream', chunk);
          }
        }
      } else {
        // Utiliser generateResponseStream sans contexte
        const generator = ollamaClient.generateResponseStream(message, []);
        this.currentStream = generator;

        for await (const chunk of generator) {
          fullResponse += chunk;
          // Envoyer le chunk au renderer si une fenêtre est fournie
          if (options.window) {
            options.window.webContents.send('chat:stream', chunk);
          }
        }
      }

      console.log(`✅ Chat response generated (${fullResponse.length} chars)`);
      return fullResponse;
    } catch (error) {
      console.error('❌ Chat error:', error);
      throw error;
    }
  }

  cancelCurrentStream() {
    if (this.currentStream) {
      // TODO: Implémenter cancel dans OllamaClient si nécessaire
      this.currentStream = null;
      console.log('⚠️  Chat stream cancelled');
    }
  }
}

export const chatService = new ChatService();
