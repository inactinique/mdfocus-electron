/**
 * PDFConverter - Convert PDF pages to images using pdf.js
 *
 * Uses Mozilla's pdf.js library to render PDF pages to canvas,
 * then converts them to image buffers for OCR processing.
 * No external dependencies required (pure JavaScript).
 */

import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';
import { createRequire } from 'module';
import * as os from 'os';
import { createCanvas, Canvas } from 'canvas';

// Custom canvas factory for pdf.js that bypasses process.getBuiltinModule
class NodeCanvasFactory {
  create(width: number, height: number): { canvas: Canvas; context: any } {
    const canvas = createCanvas(width, height);
    const context = canvas.getContext('2d');
    return { canvas, context };
  }

  reset(canvasAndContext: { canvas: Canvas; context: any }, width: number, height: number): void {
    canvasAndContext.canvas.width = width;
    canvasAndContext.canvas.height = height;
  }

  destroy(canvasAndContext: { canvas: Canvas; context: any }): void {
    // Nothing to do - canvas will be garbage collected
  }
}

// MARK: - Types

export interface PDFPageImage {
  pageNumber: number;
  width: number;
  height: number;
  data: Buffer; // PNG image data
}

export interface PDFConversionOptions {
  /** Scale factor for rendering (default: 2.0 for good OCR quality) */
  scale?: number;
  /** Specific pages to convert (1-indexed), or undefined for all pages */
  pages?: number[];
  /** Output format (default: 'png') */
  format?: 'png';
}

export interface PDFConversionResult {
  pageCount: number;
  pages: PDFPageImage[];
  tempDir?: string; // Directory where temp files were saved
}

// MARK: - PDFConverter

export class PDFConverter {
  private pdfjs: any = null;
  private isInitialized: boolean = false;
  private canvasFactory: NodeCanvasFactory;
  private standardFontDataUrl: string = '';

  constructor() {
    this.canvasFactory = new NodeCanvasFactory();
  }

  /**
   * Initialize pdf.js library
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) return;

    try {
      // Dynamic import of pdfjs-dist
      // Use the legacy build for Node.js compatibility
      const pdfjsLib = await import('pdfjs-dist/legacy/build/pdf.mjs');

      // Create require function for ESM compatibility
      const require = createRequire(import.meta.url);

      // Disable the worker to avoid process.getBuiltinModule issues in Electron
      // This runs PDF parsing in the main thread but is more compatible
      pdfjsLib.GlobalWorkerOptions.workerSrc = '';

      // Set up standard font data URL for proper font rendering
      const pdfjsPath = path.dirname(require.resolve('pdfjs-dist/package.json'));
      this.standardFontDataUrl = `file://${path.join(pdfjsPath, 'standard_fonts')}/`;

      this.pdfjs = pdfjsLib;
      this.isInitialized = true;
      console.log(`📄 PDF converter initialized (pdf.js, no worker mode for Electron compatibility)`);
    } catch (error) {
      console.error('Failed to initialize pdf.js:', error);
      throw new Error(
        'pdf.js not available. Please install with: npm install pdfjs-dist'
      );
    }
  }

  /**
   * Check if a file is a PDF
   */
  isPDF(filePath: string): boolean {
    const ext = path.extname(filePath).toLowerCase();
    return ext === '.pdf';
  }

  /**
   * Get the number of pages in a PDF
   */
  async getPageCount(pdfPath: string): Promise<number> {
    await this.initialize();

    const data = new Uint8Array(fs.readFileSync(pdfPath));
    const pdf = await this.pdfjs.getDocument({
      data,
      standardFontDataUrl: this.standardFontDataUrl,
      disableFontFace: true,
      useSystemFonts: false,
    }).promise;
    const pageCount = pdf.numPages;
    pdf.destroy();

    return pageCount;
  }

  /**
   * Convert PDF pages to images
   * Returns image buffers that can be used for OCR
   */
  async convertToImages(
    pdfPath: string,
    options: PDFConversionOptions = {}
  ): Promise<PDFConversionResult> {
    await this.initialize();

    const scale = options.scale || 2.0; // Higher scale = better OCR quality
    const format = options.format || 'png';

    if (!fs.existsSync(pdfPath)) {
      throw new Error(`PDF not found: ${pdfPath}`);
    }

    console.log(`📄 Converting PDF: ${path.basename(pdfPath)} (scale: ${scale})`);

    // Load the PDF document with custom options for Electron compatibility
    const data = new Uint8Array(fs.readFileSync(pdfPath));
    const pdf = await this.pdfjs.getDocument({
      data,
      standardFontDataUrl: this.standardFontDataUrl,
      disableFontFace: true,
      useSystemFonts: false,
    }).promise;
    const totalPages = pdf.numPages;

    // Determine which pages to convert
    const pagesToConvert = options.pages || Array.from({ length: totalPages }, (_, i) => i + 1);

    const pages: PDFPageImage[] = [];

    for (const pageNum of pagesToConvert) {
      if (pageNum < 1 || pageNum > totalPages) {
        console.warn(`⚠️ Skipping invalid page number: ${pageNum}`);
        continue;
      }

      try {
        const pageImage = await this.renderPage(pdf, pageNum, scale);
        pages.push(pageImage);
        console.log(`  📃 Page ${pageNum}/${totalPages} rendered (${pageImage.width}x${pageImage.height})`);
      } catch (error) {
        console.error(`❌ Failed to render page ${pageNum}:`, error);
      }
    }

    pdf.destroy();

    return {
      pageCount: totalPages,
      pages,
    };
  }

  /**
   * Convert PDF to temporary image files
   * Useful when OCR library needs file paths instead of buffers
   */
  async convertToTempFiles(
    pdfPath: string,
    options: PDFConversionOptions = {}
  ): Promise<{ tempDir: string; files: string[]; pageCount: number }> {
    const result = await this.convertToImages(pdfPath, options);

    // Create temp directory
    const tempDir = path.join(
      os.tmpdir(),
      `cliodeck-pdf-${Date.now()}`
    );
    fs.mkdirSync(tempDir, { recursive: true });

    const files: string[] = [];

    for (const page of result.pages) {
      const fileName = `page-${page.pageNumber.toString().padStart(4, '0')}.png`;
      const filePath = path.join(tempDir, fileName);
      fs.writeFileSync(filePath, page.data);
      files.push(filePath);
    }

    console.log(`📁 Saved ${files.length} page images to: ${tempDir}`);

    return {
      tempDir,
      files,
      pageCount: result.pageCount,
    };
  }

  /**
   * Clean up temporary files
   */
  cleanupTempFiles(tempDir: string): void {
    if (fs.existsSync(tempDir)) {
      const files = fs.readdirSync(tempDir);
      for (const file of files) {
        fs.unlinkSync(path.join(tempDir, file));
      }
      fs.rmdirSync(tempDir);
      console.log(`🧹 Cleaned up temp directory: ${tempDir}`);
    }
  }

  /**
   * Render a single PDF page to an image buffer
   */
  private async renderPage(
    pdf: any,
    pageNumber: number,
    scale: number
  ): Promise<PDFPageImage> {
    const page = await pdf.getPage(pageNumber);
    const viewport = page.getViewport({ scale });

    // Use our custom canvas factory to avoid process.getBuiltinModule issues
    const canvasAndContext = this.canvasFactory.create(
      Math.floor(viewport.width),
      Math.floor(viewport.height)
    );

    // Render PDF page to canvas using custom canvas factory
    await page.render({
      canvasContext: canvasAndContext.context,
      viewport: viewport,
      canvasFactory: this.canvasFactory,
    }).promise;

    // Convert canvas to PNG buffer
    const pngBuffer = canvasAndContext.canvas.toBuffer('image/png');

    page.cleanup();

    return {
      pageNumber,
      width: Math.floor(viewport.width),
      height: Math.floor(viewport.height),
      data: pngBuffer,
    };
  }
}

// MARK: - Factory

export function createPDFConverter(): PDFConverter {
  return new PDFConverter();
}
