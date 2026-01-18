/**
 * Bibliography IPC handlers
 */
import { ipcMain } from 'electron';
import { bibliographyService } from '../../services/bibliography-service.js';
import { successResponse, errorResponse } from '../utils/error-handler.js';
import { OrphanPDFDetector } from '../../../../backend/services/OrphanPDFDetector.js';

export function setupBibliographyHandlers() {
  ipcMain.handle('bibliography:load', async (_event, filePath: string) => {
    try {
      const citations = await bibliographyService.loadFromFile(filePath);
      return successResponse({ citations });
    } catch (error: any) {
      console.error('❌ bibliography:load error:', error);
      return { ...errorResponse(error), citations: [] };
    }
  });

  ipcMain.handle('bibliography:parse', async (_event, content: string) => {
    try {
      const citations = await bibliographyService.parseContent(content);
      return successResponse({ citations });
    } catch (error: any) {
      console.error('❌ bibliography:parse error:', error);
      return { ...errorResponse(error), citations: [] };
    }
  });

  ipcMain.handle('bibliography:search', async (_event, query: string) => {
    try {
      const citations = bibliographyService.searchCitations(query);
      return successResponse({ citations });
    } catch (error: any) {
      console.error('❌ bibliography:search error:', error);
      return { ...errorResponse(error), citations: [] };
    }
  });

  ipcMain.handle('bibliography:get-statistics', async (_event, citations?: any[]) => {
    console.log('📞 IPC Call: bibliography:get-statistics', {
      citationCount: citations?.length || 'using stored citations'
    });
    try {
      const statistics = bibliographyService.generateStatistics(citations);
      console.log('📤 IPC Response: bibliography:get-statistics', {
        totalCitations: statistics.totalCitations,
        totalAuthors: statistics.totalAuthors,
        yearRange: statistics.yearRange
      });
      return successResponse({ statistics });
    } catch (error: any) {
      console.error('❌ bibliography:get-statistics error:', error);
      return errorResponse(error);
    }
  });

  ipcMain.handle('bibliography:export', async (_event, options: {
    citations: any[];
    filePath: string;
    format?: 'modern' | 'legacy';
  }) => {
    console.log('📞 IPC Call: bibliography:export', {
      citationCount: options.citations.length,
      filePath: options.filePath,
      format: options.format || 'modern'
    });
    try {
      await bibliographyService.exportToFile(options.citations, options.filePath);
      console.log('📤 IPC Response: bibliography:export - Success');
      return successResponse({ success: true });
    } catch (error: any) {
      console.error('❌ bibliography:export error:', error);
      return errorResponse(error);
    }
  });

  ipcMain.handle('bibliography:export-string', async (_event, options: {
    citations: any[];
    format?: 'modern' | 'legacy';
  }) => {
    console.log('📞 IPC Call: bibliography:export-string', {
      citationCount: options.citations.length,
      format: options.format || 'modern'
    });
    try {
      const content = options.format === 'legacy'
        ? bibliographyService.exportToStringLegacy(options.citations)
        : bibliographyService.exportToString(options.citations);
      console.log('📤 IPC Response: bibliography:export-string - Success');
      return successResponse({ content });
    } catch (error: any) {
      console.error('❌ bibliography:export-string error:', error);
      return errorResponse(error);
    }
  });

  ipcMain.handle('bibliography:detect-orphan-pdfs', async (_event, options: {
    projectPath: string;
    citations: any[];
    includeSubdirectories?: boolean;
    pdfSubdirectory?: string;
  }) => {
    console.log('📞 IPC Call: bibliography:detect-orphan-pdfs', {
      projectPath: options.projectPath,
      citationCount: options.citations.length,
      includeSubdirectories: options.includeSubdirectories,
      pdfSubdirectory: options.pdfSubdirectory
    });
    try {
      const detector = new OrphanPDFDetector();
      const result = await detector.detectOrphans(options);
      console.log('📤 IPC Response: bibliography:detect-orphan-pdfs', {
        totalOrphans: result.totalOrphans,
        totalSize: OrphanPDFDetector.formatFileSize(result.totalSize),
        scannedFiles: result.scannedFiles
      });
      return successResponse(result);
    } catch (error: any) {
      console.error('❌ bibliography:detect-orphan-pdfs error:', error);
      return errorResponse(error);
    }
  });

  ipcMain.handle('bibliography:delete-orphan-pdfs', async (_event, filePaths: string[]) => {
    console.log('📞 IPC Call: bibliography:delete-orphan-pdfs', {
      fileCount: filePaths.length
    });
    try {
      const detector = new OrphanPDFDetector();
      const result = await detector.deleteOrphans(filePaths);
      console.log('📤 IPC Response: bibliography:delete-orphan-pdfs', {
        deleted: result.deleted,
        failed: result.failed.length
      });
      return successResponse(result);
    } catch (error: any) {
      console.error('❌ bibliography:delete-orphan-pdfs error:', error);
      return errorResponse(error);
    }
  });

  ipcMain.handle('bibliography:archive-orphan-pdfs', async (_event, options: {
    filePaths: string[];
    projectPath: string;
    archiveSubdir?: string;
  }) => {
    console.log('📞 IPC Call: bibliography:archive-orphan-pdfs', {
      fileCount: options.filePaths.length,
      projectPath: options.projectPath,
      archiveSubdir: options.archiveSubdir
    });
    try {
      const detector = new OrphanPDFDetector();
      const result = await detector.archiveOrphans(
        options.filePaths,
        options.projectPath,
        options.archiveSubdir
      );
      console.log('📤 IPC Response: bibliography:archive-orphan-pdfs', {
        archived: result.archived,
        failed: result.failed.length,
        archivePath: result.archivePath
      });
      return successResponse(result);
    } catch (error: any) {
      console.error('❌ bibliography:archive-orphan-pdfs error:', error);
      return errorResponse(error);
    }
  });

  console.log('✅ Bibliography handlers registered');
}
