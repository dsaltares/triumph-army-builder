import { describe, expect, it } from 'vitest';
import { sampleSnapshotBattleCards } from '@/test/sample.ts';
import { type MarkdownBlock, parseMarkdown, parseSpans } from './markdown.ts';

const plainText = (blocks: readonly MarkdownBlock[]): string[] =>
  blocks.flatMap((block) =>
    block.kind === 'list'
      ? block.items.map((item) => item.map(({ text }) => text).join(''))
      : [block.spans.map(({ text }) => text).join('')],
  );

const withoutMarkers = (line: string) =>
  line
    .replace(/^#{1,6}\s+/, '')
    .replace(/^[-*+]\s+/, '')
    .replaceAll(/(\*\*|__|\*|_)(?=\S)(.+?)(?<=\S)\1/g, '$2');

describe('parseSpans', () => {
  it('reads a run of plain text as one span', () => {
    expect(parseSpans('1 point')).toEqual([
      { text: '1 point', emphasis: 'none' },
    ]);
  });

  it('lifts asterisk and underscore emphasis out of the text around it', () => {
    expect(parseSpans('a *flag* and a _banner_ fly')).toEqual([
      { text: 'a ', emphasis: 'none' },
      { text: 'flag', emphasis: 'em' },
      { text: ' and a ', emphasis: 'none' },
      { text: 'banner', emphasis: 'em' },
      { text: ' fly', emphasis: 'none' },
    ]);
  });

  it('reads a doubled marker as strong rather than as two emphases', () => {
    expect(parseSpans('**Option 1** only')).toEqual([
      { text: 'Option 1', emphasis: 'strong' },
      { text: ' only', emphasis: 'none' },
    ]);
  });

  it('leaves a marker that opens nothing as text', () => {
    expect(parseSpans('3 * 4 stands')).toEqual([
      { text: '3 * 4 stands', emphasis: 'none' },
    ]);
  });

  it('reads nothing out of an empty line', () => {
    expect(parseSpans('')).toEqual([]);
  });
});

describe('parseMarkdown', () => {
  it('reads a heading at the level its hashes give it', () => {
    expect(parseMarkdown('#### Cost')).toEqual([
      {
        kind: 'heading',
        level: 4,
        spans: [{ text: 'Cost', emphasis: 'none' }],
      },
    ]);
  });

  it('keeps a heading and the paragraph under it apart without a blank line', () => {
    const blocks = parseMarkdown('#### Cost\n1 point');

    expect(blocks.map(({ kind }) => kind)).toEqual(['heading', 'paragraph']);
  });

  it('joins the soft-wrapped lines of one paragraph', () => {
    expect(parseMarkdown('one line\nand another')).toEqual([
      {
        kind: 'paragraph',
        spans: [{ text: 'one line and another', emphasis: 'none' }],
      },
    ]);
  });

  it('splits paragraphs on a blank line', () => {
    const blocks = parseMarkdown('first\n\nsecond');

    expect(blocks.map(({ kind }) => kind)).toEqual(['paragraph', 'paragraph']);
  });

  it('gathers consecutive bullets into one list', () => {
    expect(parseMarkdown('- one\n- two')).toEqual([
      {
        kind: 'list',
        items: [
          [{ text: 'one', emphasis: 'none' }],
          [{ text: 'two', emphasis: 'none' }],
        ],
      },
    ]);
  });

  it('closes a paragraph when a list starts, and the other way round', () => {
    const blocks = parseMarkdown('intro\n- one\nafter');

    expect(blocks.map(({ kind }) => kind)).toEqual([
      'paragraph',
      'list',
      'paragraph',
    ]);
  });

  it('reads nothing out of an empty document', () => {
    expect(parseMarkdown('')).toEqual([]);
  });
});

describe('every battle card in the sample snapshot', () => {
  const cards = sampleSnapshotBattleCards;

  it('carries every line into a block, dropping nothing', () => {
    const dropped = cards.flatMap(({ permanentCode, mdText }) => {
      const rendered = plainText(parseMarkdown(mdText));
      return mdText
        .split('\n')
        .map((line) => line.trim())
        .filter(
          (line) =>
            line !== '' &&
            !rendered.some((text) => text.includes(withoutMarkers(line))),
        )
        .map((line) => `${permanentCode}: ${line}`);
    });

    expect(dropped).toEqual([]);
  });

  it('uses only the constructs the renderer knows', () => {
    const kinds = new Set(
      cards.flatMap(({ mdText }) =>
        parseMarkdown(mdText).map(({ kind }) => kind),
      ),
    );

    expect([...kinds].sort()).toEqual(['heading', 'list', 'paragraph']);
  });

  it('never goes deeper than one heading level', () => {
    const levels = new Set(
      cards.flatMap(({ mdText }) =>
        parseMarkdown(mdText).flatMap((block) =>
          block.kind === 'heading' ? [block.level] : [],
        ),
      ),
    );

    expect([...levels]).toEqual([4]);
  });
});
