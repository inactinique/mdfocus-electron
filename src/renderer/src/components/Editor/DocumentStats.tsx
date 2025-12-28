import React, { useMemo } from 'react';
import { useEditorStore } from '../../stores/editorStore';
import './DocumentStats.css';

export const DocumentStats: React.FC = () => {
  const { content } = useEditorStore();

  const stats = useMemo(() => {
    // Count words (excluding markdown syntax)
    const plainText = content
      .replace(/^#{1,6}\s+/gm, '') // Remove headers
      .replace(/\*\*([^*]+)\*\*/g, '$1') // Remove bold
      .replace(/\*([^*]+)\*/g, '$1') // Remove italic
      .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1') // Remove links, keep text
      .replace(/`([^`]+)`/g, '$1') // Remove inline code
      .replace(/```[\s\S]*?```/g, '') // Remove code blocks
      .replace(/\[@[^\]]+\]/g, '') // Remove citations
      .trim();

    const words = plainText.split(/\s+/).filter(w => w.length > 0);
    const wordCount = words.length;

    // Count characters (without spaces)
    const charCount = plainText.replace(/\s/g, '').length;

    // Count characters (with spaces)
    const charWithSpacesCount = plainText.length;

    // Estimate pages (assuming ~250 words per page)
    const estimatedPages = Math.ceil(wordCount / 250);

    // Count paragraphs (non-empty lines)
    const paragraphs = content.split('\n\n').filter(p => p.trim().length > 0).length;

    // Count citations
    const citations = (content.match(/\[@[^\]]+\]/g) || []).length;

    // Count footnotes
    const footnotes = (content.match(/\[\^\d+\]/g) || []).length / 2; // Divided by 2 because each footnote appears twice

    // Estimate reading time (average 200 words per minute)
    const readingTimeMinutes = Math.ceil(wordCount / 200);

    return {
      wordCount,
      charCount,
      charWithSpacesCount,
      estimatedPages,
      paragraphs,
      citations,
      footnotes,
      readingTimeMinutes,
    };
  }, [content]);

  return (
    <div className="document-stats">
      <div className="stat-item">
        <span className="stat-label">Mots:</span>
        <span className="stat-value">{stats.wordCount.toLocaleString()}</span>
      </div>
      <div className="stat-item">
        <span className="stat-label">Caractères:</span>
        <span className="stat-value">{stats.charCount.toLocaleString()}</span>
      </div>
      <div className="stat-item">
        <span className="stat-label">Avec espaces:</span>
        <span className="stat-value">{stats.charWithSpacesCount.toLocaleString()}</span>
      </div>
      <div className="stat-item">
        <span className="stat-label">Paragraphes:</span>
        <span className="stat-value">{stats.paragraphs}</span>
      </div>
      <div className="stat-item">
        <span className="stat-label">Pages estimées:</span>
        <span className="stat-value">{stats.estimatedPages}</span>
      </div>
      <div className="stat-item">
        <span className="stat-label">Citations:</span>
        <span className="stat-value">{stats.citations}</span>
      </div>
      <div className="stat-item">
        <span className="stat-label">Notes:</span>
        <span className="stat-value">{stats.footnotes}</span>
      </div>
      <div className="stat-item">
        <span className="stat-label">Temps de lecture:</span>
        <span className="stat-value">~{stats.readingTimeMinutes} min</span>
      </div>
    </div>
  );
};
