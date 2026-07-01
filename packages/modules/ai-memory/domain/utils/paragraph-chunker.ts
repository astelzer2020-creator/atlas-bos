/**
 * Splits document text into paragraph-based chunks for knowledge base ingestion.
 */
export function splitByParagraphs(text: string, minChunkLength = 1): string[] {
  const paragraphs = text
    .split(/\n\s*\n+/)
    .map((paragraph) => paragraph.trim())
    .filter((paragraph) => paragraph.length >= minChunkLength);

  return paragraphs.length > 0 ? paragraphs : text.trim().length > 0 ? [text.trim()] : [];
}