import type { StandardDocument } from '../services/standards.service';

export function connectorHeader(mode: string): string {
  return [
    'source: healthcare-standards connector',
    `mode: ${mode}`,
    ''
  ].join('\n');
}

export function summarizeText(text: string, maxLength: number = 700): string {
  const normalized = text.replace(/\s+/g, ' ').trim();
  if (normalized.length <= maxLength) {
    return normalized;
  }

  return `${normalized.slice(0, maxLength).trim()}...`;
}

export function formatEvidence(doc: StandardDocument, includeScore: boolean = false, excerptLength: number = 700): string {
  const lines: string[] = [];
  lines.push(`chapter_id: ${doc.metadata?.chapter ?? 'unknown'}`);
  lines.push(`section_name: ${doc.metadata?.section ?? 'unknown'}`);
  if (doc.metadata?.heading) {
    lines.push(`heading: ${doc.metadata.heading}`);
  }
  if (doc.metadata?.sr_id) {
    lines.push(`sr_id: ${doc.metadata.sr_id}`);
  }
  lines.push(`chunk_id: ${doc.chunk_id}`);
  if (includeScore && typeof doc.score === 'number') {
    lines.push(`relevance_score: ${doc.score.toFixed(4)}`);
  }
  lines.push(`excerpt: ${summarizeText(doc.text, excerptLength)}`);
  return lines.join('\n');
}

export function formatVerbatimStandard(doc: StandardDocument): string {
  return [
    `document: ${doc.metadata?.document ?? 'NIAHO Standards'}`,
    `section: ${doc.metadata?.section ?? 'unknown'}`,
    `chapter: ${doc.metadata?.chapter ?? 'unknown'}`,
    ...(doc.metadata?.heading ? [`heading: ${doc.metadata.heading}`] : []),
    ...(doc.metadata?.sr_id ? [`sr_id: ${doc.metadata.sr_id}`] : []),
    `chunk_id: ${doc.chunk_id}`,
    '',
    doc.text.trim()
  ].join('\n');
}

export function stripRepeatedHeading(text: string, heading?: string): string {
  const trimmed = text.trim();
  if (!heading) {
    return trimmed;
  }

  const normalizedHeading = heading.trim();
  if (!normalizedHeading) {
    return trimmed;
  }

  if (trimmed === normalizedHeading) {
    return '';
  }

  if (trimmed.startsWith(`${normalizedHeading}\n`)) {
    return trimmed.slice(normalizedHeading.length).trimStart();
  }

  return trimmed;
}

function splitParagraphs(text: string): string[] {
  const cleanedText = text
    .split('\n')
    .map((line) => line.trimEnd())
    .filter((line) => !isPdfArtifactLine(line.trim()))
    .join('\n');

  return cleanedText
    .split(/\n\s*\n+/)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean);
}

function isPdfArtifactLine(line: string): boolean {
  if (!line) {
    return false;
  }

  return /^N\s*IAHO$/i.test(line)
    || /^Accreditation Requirements,\s*Interpretive Guidelines and Surveyor Guidance for Hospitals$/i.test(line)
    || /^Page\s+\d+\s+of\s+\d+$/i.test(line);
}

function normalizeParagraph(paragraph: string): string {
  return paragraph.replace(/\s+/g, ' ').trim();
}

function isParagraphContinuation(previousParagraph: string, nextParagraph: string): boolean {
  if (!previousParagraph || !nextParagraph) {
    return false;
  }

  const previousTrimmed = previousParagraph.trim();
  const nextTrimmed = nextParagraph.trim();

  if (!/^[a-z(]/.test(nextTrimmed)) {
    return false;
  }

  return !/[.:;!?]$/.test(previousTrimmed);
}

function appearsInRecentParagraphs(merged: string[], paragraph: string, lookback: number = 8): boolean {
  const normalizedParagraph = normalizeParagraph(paragraph);
  return merged
    .slice(-lookback)
    .some((existingParagraph) => normalizeParagraph(existingParagraph) === normalizedParagraph);
}

function isContainedOverlapFragment(merged: string[], paragraph: string): boolean {
  if (merged.length === 0) {
    return false;
  }

  const normalizedParagraph = normalizeParagraph(paragraph);
  if (normalizedParagraph.length < 40) {
    return false;
  }

  const previousParagraph = normalizeParagraph(merged[merged.length - 1]);
  return previousParagraph.includes(normalizedParagraph);
}

function mergeChapterParagraphs(segments: string[]): string {
  const merged: string[] = [];

  for (const segment of segments) {
    const paragraphs = splitParagraphs(segment);
    if (paragraphs.length === 0) {
      continue;
    }

    let overlapLength = 0;
    const maxOverlap = Math.min(merged.length, paragraphs.length);

    for (let size = maxOverlap; size > 0; size -= 1) {
      let matches = true;

      for (let index = 0; index < size; index += 1) {
        const mergedParagraph = merged[merged.length - size + index];
        const nextParagraph = paragraphs[index];

        if (normalizeParagraph(mergedParagraph) !== normalizeParagraph(nextParagraph)) {
          matches = false;
          break;
        }
      }

      if (matches) {
        overlapLength = size;
        break;
      }
    }

    for (const paragraph of paragraphs.slice(overlapLength)) {
      if (merged.length > 0 && normalizeParagraph(merged[merged.length - 1]) === normalizeParagraph(paragraph)) {
        continue;
      }

      if (appearsInRecentParagraphs(merged, paragraph) || isContainedOverlapFragment(merged, paragraph)) {
        continue;
      }

      if (merged.length > 0 && isParagraphContinuation(merged[merged.length - 1], paragraph)) {
        merged[merged.length - 1] = `${merged[merged.length - 1]}\n${paragraph}`;
        continue;
      }

      merged.push(paragraph);
    }
  }

  return merged.join('\n\n');
}

export function renderVerbatimChapter(results: StandardDocument[]): string {
  if (results.length === 0) {
    return '';
  }

  const heading = results.find((doc) => doc.metadata?.heading)?.metadata?.heading?.trim();
  const chapterSegments = results
    .map((doc) => stripRepeatedHeading(doc.text, heading))
    .filter(Boolean);
  const chapterBody = mergeChapterParagraphs(chapterSegments);

  return [heading, chapterBody].filter(Boolean).join('\n\n');
}
