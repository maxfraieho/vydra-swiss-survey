import React from 'react';
import { Markdown, type MarkdownProps } from '@astryxdesign/core/Markdown';
import { Collapsible } from '@astryxdesign/core/Collapsible';

export interface DetailsMarkdownProps extends Omit<MarkdownProps, 'children'> {
  source?: string;
  children?: string;
}

interface MarkdownSegment {
  type: 'markdown';
  content: string;
}

interface DetailsSegment {
  type: 'details';
  title: string;
  body: string;
}

type Segment = MarkdownSegment | DetailsSegment;

function parseDetailsSegments(source: string): Segment[] {
  const segments: Segment[] = [];
  const regex = /<details(?:\s+[^>]*)?>[\s\S]*?(?:<summary(?:\s+[^>]*)?>([\s\S]*?)<\/summary>)?([\s\S]*?)<\/details>/gi;

  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = regex.exec(source)) !== null) {
    const matchIndex = match.index;
    const matchLength = match[0].length;

    if (matchIndex > lastIndex) {
      const beforeText = source.slice(lastIndex, matchIndex);
      if (beforeText.trim().length > 0) {
        segments.push({
          type: 'markdown',
          content: beforeText,
        });
      }
    }

    const rawSummary = match[1] ?? '';
    const title = rawSummary.replace(/<[^>]+>/g, '').trim() || 'Деталі';
    const body = match[2] ?? '';

    segments.push({
      type: 'details',
      title,
      body,
    });

    lastIndex = matchIndex + matchLength;
  }

  if (lastIndex < source.length) {
    const afterText = source.slice(lastIndex);
    if (afterText.trim().length > 0) {
      segments.push({
        type: 'markdown',
        content: afterText,
      });
    }
  }

  return segments;
}

export const DetailsMarkdown: React.FC<DetailsMarkdownProps> = ({
  source,
  children,
  ...markdownProps
}) => {
  const content = source ?? children ?? '';

  if (!content || !content.trim()) {
    return null;
  }

  const segments = parseDetailsSegments(content);

  if (segments.length === 1 && segments[0].type === 'markdown') {
    return <Markdown {...markdownProps}>{segments[0].content}</Markdown>;
  }

  return (
    <>
      {segments.map((segment, index) => {
        if (segment.type === 'markdown') {
          return (
            <Markdown key={index} {...markdownProps}>
              {segment.content}
            </Markdown>
          );
        }

        return (
          <Collapsible
            key={index}
            trigger={segment.title}
            defaultIsOpen={false}
            style={{ marginBlock: '12px' }}
          >
            <DetailsMarkdown {...markdownProps} source={segment.body} />
          </Collapsible>
        );
      })}
    </>
  );
};
