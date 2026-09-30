export type MarkdownEmphasis = 'none' | 'em' | 'strong';

export type MarkdownSpan = {
  text: string;
  emphasis: MarkdownEmphasis;
};

export type MarkdownBlock =
  | { kind: 'heading'; level: number; spans: MarkdownSpan[] }
  | { kind: 'paragraph'; spans: MarkdownSpan[] }
  | { kind: 'list'; items: MarkdownSpan[][] };

const emphasisPattern = /(\*\*|__|\*|_)(?=\S)(.+?)(?<=\S)\1/g;

const headingPattern = /^(#{1,6})\s+(.+)$/;

const bulletPattern = /^[-*+]\s+(.+)$/;

const emphasisOf = (marker: string): MarkdownEmphasis =>
  marker.length === 2 ? 'strong' : 'em';

export const parseSpans = (text: string): MarkdownSpan[] => {
  const spans: MarkdownSpan[] = [];
  let plainFrom = 0;
  for (const match of text.matchAll(emphasisPattern)) {
    const [marked, marker = '', emphasised = ''] = match;
    const plain = text.slice(plainFrom, match.index);
    if (plain !== '') {
      spans.push({ text: plain, emphasis: 'none' });
    }
    spans.push({ text: emphasised, emphasis: emphasisOf(marker) });
    plainFrom = match.index + marked.length;
  }
  const rest = text.slice(plainFrom);
  if (rest !== '') {
    spans.push({ text: rest, emphasis: 'none' });
  }
  return spans;
};

export const parseMarkdown = (markdown: string): MarkdownBlock[] => {
  const blocks: MarkdownBlock[] = [];
  let paragraph: string[] = [];
  let items: string[] = [];

  const closeOpenBlocks = () => {
    if (paragraph.length > 0) {
      blocks.push({
        kind: 'paragraph',
        spans: parseSpans(paragraph.join(' ')),
      });
      paragraph = [];
    }
    if (items.length > 0) {
      blocks.push({ kind: 'list', items: items.map(parseSpans) });
      items = [];
    }
  };

  for (const line of markdown.split('\n')) {
    const text = line.trim();
    const heading = headingPattern.exec(text);
    const bullet = bulletPattern.exec(text);
    if (text === '') {
      closeOpenBlocks();
    } else if (heading) {
      closeOpenBlocks();
      blocks.push({
        kind: 'heading',
        level: (heading[1] ?? '').length,
        spans: parseSpans(heading[2] ?? ''),
      });
    } else if (bullet) {
      if (paragraph.length > 0) {
        closeOpenBlocks();
      }
      items.push(bullet[1] ?? '');
    } else {
      if (items.length > 0) {
        closeOpenBlocks();
      }
      paragraph.push(text);
    }
  }
  closeOpenBlocks();

  return blocks;
};
