import { Fragment, type ReactNode } from 'react';
import type { MarkdownBlock, MarkdownSpan } from '@/lib/markdown';
import { cn } from '@/lib/utils';

const headingTags = ['h1', 'h2', 'h3', 'h4', 'h5', 'h6'] as const;

const headingTag = (level: number, floor: number) =>
  headingTags[Math.min(6, Math.max(level, floor)) - 1] ?? 'h6';

const textOf = (spans: readonly MarkdownSpan[]) =>
  spans.map(({ text }) => text).join('');

const keyAt = (position: number, text: string) => `${position}:${text}`;

function Spans({ spans }: { spans: readonly MarkdownSpan[] }) {
  return spans.map((span, position) => {
    const key = keyAt(position, span.text);
    if (span.emphasis === 'strong') {
      return (
        <strong key={key} className="font-semibold text-foreground">
          {span.text}
        </strong>
      );
    }
    if (span.emphasis === 'em') {
      return <em key={key}>{span.text}</em>;
    }
    return <Fragment key={key}>{span.text}</Fragment>;
  });
}

function Block({
  block,
  headingLevel,
}: {
  block: MarkdownBlock;
  headingLevel: number;
}): ReactNode {
  if (block.kind === 'heading') {
    const Heading = headingTag(block.level, headingLevel);
    return (
      <Heading className="font-heading text-sm font-semibold tracking-tight text-foreground">
        <Spans spans={block.spans} />
      </Heading>
    );
  }
  if (block.kind === 'list') {
    return (
      <ul className="flex list-disc flex-col gap-1 pl-5">
        {block.items.map((item, position) => (
          <li key={keyAt(position, textOf(item))}>
            <Spans spans={item} />
          </li>
        ))}
      </ul>
    );
  }
  return (
    <p className="text-pretty">
      <Spans spans={block.spans} />
    </p>
  );
}

export function MarkdownProse({
  blocks,
  headingLevel,
  className,
}: {
  blocks: readonly MarkdownBlock[];
  headingLevel: number;
  className?: string;
}) {
  return (
    <div
      className={cn(
        'flex max-w-reading flex-col gap-3 text-sm text-muted-foreground',
        className,
      )}
    >
      {blocks.map((block, position) => (
        <Block
          key={keyAt(position, block.kind)}
          block={block}
          headingLevel={headingLevel}
        />
      ))}
    </div>
  );
}
