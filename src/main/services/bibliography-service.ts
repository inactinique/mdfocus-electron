// @ts-nocheck
import { BibTeXParser } from '../../../backend/core/bibliography/BibTeXParser.js';
import type { Citation } from '../../../backend/types/citation.js';
import { BibliographyStatsEngine, BibliographyStatistics } from '../../../backend/services/BibliographyStats.js';

class BibliographyService {
  private parser: BibTeXParser;
  private statsEngine: BibliographyStatsEngine;
  private citations: Citation[] = [];

  constructor() {
    this.parser = new BibTeXParser();
    this.statsEngine = new BibliographyStatsEngine();
  }

  async loadFromFile(filePath: string): Promise<Citation[]> {
    try {
      this.citations = this.parser.parseFile(filePath);
      console.log(`✅ Bibliography loaded: ${this.citations.length} citations`);
      return this.citations;
    } catch (error) {
      console.error('❌ Failed to load bibliography:', error);
      throw error;
    }
  }

  async parseContent(content: string): Promise<Citation[]> {
    try {
      this.citations = this.parser.parse(content);
      console.log(`✅ Bibliography parsed: ${this.citations.length} citations`);
      return this.citations;
    } catch (error) {
      console.error('❌ Failed to parse bibliography:', error);
      throw error;
    }
  }

  searchCitations(query: string): Citation[] {
    if (!query) return this.citations;

    const lowerQuery = query.toLowerCase();
    return this.citations.filter(
      (citation) =>
        citation.title?.toLowerCase().includes(lowerQuery) ||
        citation.author?.toLowerCase().includes(lowerQuery) ||
        citation.key?.toLowerCase().includes(lowerQuery) ||
        citation.year?.toString().includes(query)
    );
  }

  getCitations(): Citation[] {
    return this.citations;
  }

  getCitationByKey(key: string): Citation | undefined {
    return this.citations.find((c) => c.key === key);
  }

  /**
   * Generate statistics for the current bibliography
   */
  generateStatistics(citations?: Citation[]): BibliographyStatistics {
    const citationsToAnalyze = citations || this.citations;
    return this.statsEngine.generateStatistics(citationsToAnalyze);
  }
}

export const bibliographyService = new BibliographyService();
