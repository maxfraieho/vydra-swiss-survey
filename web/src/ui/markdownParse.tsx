import React from 'react';
import { MermaidTree } from './MermaidTree';

/**
 * Block + inline markdown parser that returns real React elements — never
 * an HTML string, never dangerouslySetInnerHTML. `/report` renders LLM
 * (`self_reflection`) and DRAKON-imported text, which is untrusted; text
 * nodes go through React's normal escaping, so XSS is structurally
 * impossible here rather than sanitizer-dependent.
 *
 * Loose "prompt prose" markdown, not strict CommonMark: single newlines
 * inside a paragraph become <br>, not new paragraphs.
 */

const ALLOWED_LINK_SCHEMES = new Set(['http:', 'https:', 'mailto:']);

// ---------------------------------------------------------------------------
// Block pass
// ---------------------------------------------------------------------------

const FENCE_OPEN_RE = /^```(\S*)\s*$/;
const FENCE_CLOSE_RE = /^```\s*$/;
const HEADING_RE = /^(#{1,4})\s+(.+)$/;
const HR_RE = /^(---|\*\*\*|___)$/;
const DETAILS_OPEN_RE = /^<details><summary>(.*)<\/summary>$/;
const DETAILS_CLOSE_RE = /^<\/details>$/;
const BULLET_RE = /^\s*[-*+]\s+/;
const ORDERED_RE = /^\s*\d+\.\s+/;
const BLOCKQUOTE_RE = /^>\s?/;
const TABLE_ROW_RE = /^\|.*\|$/;
const TABLE_SEP_RE = /^\|[\s:|-]+\|$/;

function isBlockStart(line: string): boolean {
  return (
    FENCE_OPEN_RE.test(line) ||
    HEADING_RE.test(line) ||
    HR_RE.test(line.trim()) ||
    DETAILS_OPEN_RE.test(line) ||
    TABLE_ROW_RE.test(line.trim()) ||
    BULLET_RE.test(line) ||
    ORDERED_RE.test(line) ||
    BLOCKQUOTE_RE.test(line)
  );
}

/** Split a pipe-table row into cells; `\|` inside a cell is a literal pipe. */
function splitTableRow(line: string): string[] {
  const trimmed = line.trim();
  const inner = trimmed.slice(1, -1);
  const cells: string[] = [];
  let current = '';
  let i = 0;
  while (i < inner.length) {
    const ch = inner[i];
    if (ch === '\\' && inner[i + 1] === '|') {
      current += '|';
      i += 2;
      continue;
    }
    if (ch === '|') {
      cells.push(current.trim());
      current = '';
      i++;
      continue;
    }
    current += ch;
    i++;
  }
  cells.push(current.trim());
  return cells;
}

function renderTable(header: string[], rows: string[][], key: number): React.ReactNode {
  return (
    <div key={key} style={{ overflowX: 'auto' }}>
      <table>
        <thead>
          <tr>
            {header.map((h, idx) => (
              <th key={idx}>{parseInline(h)}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, ridx) => (
            <tr key={ridx}>
              {row.map((cell, cidx) => (
                <td key={cidx}>{parseInline(cell)}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function parseBlocks(lines: string[]): React.ReactNode[] {
  const nodes: React.ReactNode[] = [];
  let i = 0;
  let key = 0;
  const nk = () => key++;

  while (i < lines.length) {
    const line = lines[i];

    if (line.trim() === '') {
      i++;
      continue;
    }

    // fenced code block (mermaid delegates to MermaidTree, others verbatim <pre><code>)
    const fenceMatch = FENCE_OPEN_RE.exec(line);
    if (fenceMatch) {
      const lang = fenceMatch[1];
      const codeLines: string[] = [];
      i++;
      while (i < lines.length && !FENCE_CLOSE_RE.test(lines[i])) {
        codeLines.push(lines[i]);
        i++;
      }
      if (i < lines.length) i++; // consume closing fence; EOF closes implicitly
      const code = codeLines.join('\n');
      if (lang === 'mermaid') {
        nodes.push(<MermaidTree key={nk()} src={code} />);
      } else {
        nodes.push(
          <pre key={nk()} style={{ overflowX: 'auto' }}>
            <code>{code}</code>
          </pre>
        );
      }
      continue;
    }

    // heading (page owns h2/h3, so #..#### map into h4/h5/h6-equivalent)
    const headingMatch = HEADING_RE.exec(line);
    if (headingMatch) {
      const level = Math.min(headingMatch[1].length + 3, 6);
      const Tag = `h${level}` as 'h4' | 'h5' | 'h6';
      nodes.push(<Tag key={nk()}>{parseInline(headingMatch[2])}</Tag>);
      i++;
      continue;
    }

    // hr
    if (HR_RE.test(line.trim())) {
      nodes.push(<hr key={nk()} />);
      i++;
      continue;
    }

    // <details><summary>...</summary> block — narrow allowlist of exactly this
    // tag pair as a block delimiter; any other HTML renders as literal text.
    const detailsMatch = DETAILS_OPEN_RE.exec(line);
    if (detailsMatch) {
      const summaryText = detailsMatch[1];
      i++;
      const bodyLines: string[] = [];
      while (i < lines.length && !DETAILS_CLOSE_RE.test(lines[i].trim())) {
        bodyLines.push(lines[i]);
        i++;
      }
      if (i < lines.length) i++; // consume </details>; EOF closes implicitly, never drops content
      nodes.push(
        <details key={nk()}>
          <summary>{summaryText}</summary>
          {parseBlocks(bodyLines)}
        </details>
      );
      continue;
    }

    // pipe table: header row + separator row + more rows
    if (TABLE_ROW_RE.test(line.trim())) {
      const sep = lines[i + 1];
      if (sep !== undefined && TABLE_SEP_RE.test(sep.trim())) {
        const headerCells = splitTableRow(line);
        i += 2;
        const rows: string[][] = [];
        while (i < lines.length && TABLE_ROW_RE.test(lines[i].trim())) {
          rows.push(splitTableRow(lines[i]));
          i++;
        }
        nodes.push(renderTable(headerCells, rows, nk()));
        continue;
      }
    }

    // bullet list
    if (BULLET_RE.test(line)) {
      const items: string[] = [];
      while (i < lines.length && BULLET_RE.test(lines[i])) {
        items.push(lines[i].replace(BULLET_RE, ''));
        i++;
      }
      nodes.push(
        <ul key={nk()}>
          {items.map((it, idx) => (
            <li key={idx}>{parseInline(it)}</li>
          ))}
        </ul>
      );
      continue;
    }

    // ordered list
    if (ORDERED_RE.test(line)) {
      const items: string[] = [];
      while (i < lines.length && ORDERED_RE.test(lines[i])) {
        items.push(lines[i].replace(ORDERED_RE, ''));
        i++;
      }
      nodes.push(
        <ol key={nk()}>
          {items.map((it, idx) => (
            <li key={idx}>{parseInline(it)}</li>
          ))}
        </ol>
      );
      continue;
    }

    // blockquote
    if (BLOCKQUOTE_RE.test(line)) {
      const items: string[] = [];
      while (i < lines.length && BLOCKQUOTE_RE.test(lines[i])) {
        items.push(lines[i].replace(BLOCKQUOTE_RE, ''));
        i++;
      }
      nodes.push(<blockquote key={nk()}>{parseInline(items.join(' '))}</blockquote>);
      continue;
    }

    // paragraph: consecutive plain lines, single newlines become <br>
    {
      const paraLines: string[] = [];
      while (i < lines.length && lines[i].trim() !== '' && !isBlockStart(lines[i])) {
        paraLines.push(lines[i]);
        i++;
      }
      if (paraLines.length === 0) {
        // Defensive: never leave `i` stuck (line matched isBlockStart but no
        // handler above claimed it — shouldn't happen, but never drop input).
        paraLines.push(lines[i]);
        i++;
      }
      nodes.push(
        <p key={nk()}>
          {paraLines.map((l, idx) => (
            <React.Fragment key={idx}>
              {idx > 0 && <br />}
              {parseInline(l)}
            </React.Fragment>
          ))}
        </p>
      );
    }
  }

  return nodes;
}

// ---------------------------------------------------------------------------
// Inline pass
// ---------------------------------------------------------------------------

function matchDelim(text: string, i: number, delim: string): { content: string; end: number } | null {
  if (text.slice(i, i + delim.length) !== delim) return null;
  const closeIdx = text.indexOf(delim, i + delim.length);
  if (closeIdx === -1) return null;
  const content = text.slice(i + delim.length, closeIdx);
  if (content.length === 0) return null;
  return { content, end: closeIdx + delim.length };
}

function isAlnum(ch: string | undefined): boolean {
  return !!ch && /[A-Za-z0-9]/.test(ch);
}

/**
 * `_` only opens/closes emphasis when flanked by whitespace, start/end-of-
 * string, or punctuation on the outer side — never when both adjacent chars
 * are alphanumeric. Required so health_status / text_looks_sfx / run_id
 * (real field names in this codebase) don't get partially italicized.
 */
function canBeUnderscoreDelim(text: string, i: number): boolean {
  const before = i > 0 ? text[i - 1] : undefined;
  const after = i + 1 < text.length ? text[i + 1] : undefined;
  return !(isAlnum(before) && isAlnum(after));
}

function matchUnderscoreItalic(text: string, i: number): { content: string; end: number } | null {
  if (text[i] !== '_') return null;
  if (!canBeUnderscoreDelim(text, i)) return null;
  for (let j = i + 1; j < text.length; j++) {
    if (text[j] === '_' && j > i + 1 && canBeUnderscoreDelim(text, j)) {
      const content = text.slice(i + 1, j);
      if (content.length > 0) return { content, end: j + 1 };
    }
  }
  return null;
}

function matchLink(text: string, i: number): { label: string; url: string; end: number } | null {
  if (text[i] !== '[') return null;
  const closeBracket = text.indexOf(']', i + 1);
  if (closeBracket === -1) return null;
  if (text[closeBracket + 1] !== '(') return null;
  const closeParen = text.indexOf(')', closeBracket + 2);
  if (closeParen === -1) return null;
  return {
    label: text.slice(i + 1, closeBracket),
    url: text.slice(closeBracket + 2, closeParen),
    end: closeParen + 1,
  };
}

/**
 * Allowlist ONLY — http(s)/mailto/relative-'/' pass, everything else
 * (javascript:, data:, vbscript:, file:, missing scheme) is rejected.
 * React's javascript: URL warning is not relied on — it only warns.
 */
function sanitizeHref(rawUrl: string): string | null {
  const url = rawUrl.trim();
  if (url.startsWith('/')) return url;
  const schemeMatch = /^([a-zA-Z][a-zA-Z0-9+.-]*:)/.exec(url);
  if (!schemeMatch) return null;
  const scheme = schemeMatch[1].toLowerCase();
  if (ALLOWED_LINK_SCHEMES.has(scheme)) return url;
  return null;
}

function renderLink(label: string, rawUrl: string, key: number, depth: number): React.ReactNode {
  const safeUrl = sanitizeHref(rawUrl);
  if (safeUrl === null) {
    // Reject -> plain escaped text, never an <a> tag.
    return (
      <React.Fragment key={key}>
        [{parseInline(label, depth + 1)}]({rawUrl})
      </React.Fragment>
    );
  }
  return (
    <a key={key} href={safeUrl} target="_blank" rel="noopener noreferrer">
      {parseInline(label, depth + 1)}
    </a>
  );
}

/**
 * Ordered tokenizer: code span first (so `**x**` inside backticks stays
 * literal), then bold, then italic, then links, then plain text. Recurses
 * on captured inner text (depth-capped at 3) so e.g. bold-containing-link
 * still resolves.
 */
function parseInline(text: string, depth = 0): React.ReactNode {
  if (depth > 3) return text;

  const nodes: React.ReactNode[] = [];
  let buffer = '';
  let key = 0;
  let i = 0;

  const flush = () => {
    if (buffer) {
      nodes.push(buffer);
      buffer = '';
    }
  };

  while (i < text.length) {
    const ch = text[i];

    if (ch === '`') {
      const end = text.indexOf('`', i + 1);
      if (end !== -1) {
        flush();
        nodes.push(<code key={key++}>{text.slice(i + 1, end)}</code>);
        i = end + 1;
        continue;
      }
    }

    if (ch === '*' || ch === '_') {
      const bold = matchDelim(text, i, '**') || matchDelim(text, i, '__');
      if (bold) {
        flush();
        nodes.push(<strong key={key++}>{parseInline(bold.content, depth + 1)}</strong>);
        i = bold.end;
        continue;
      }
      if (ch === '*') {
        const italic = matchDelim(text, i, '*');
        if (italic) {
          flush();
          nodes.push(<em key={key++}>{parseInline(italic.content, depth + 1)}</em>);
          i = italic.end;
          continue;
        }
      } else {
        const italic = matchUnderscoreItalic(text, i);
        if (italic) {
          flush();
          nodes.push(<em key={key++}>{parseInline(italic.content, depth + 1)}</em>);
          i = italic.end;
          continue;
        }
      }
    }

    if (ch === '[') {
      const link = matchLink(text, i);
      if (link) {
        flush();
        nodes.push(renderLink(link.label, link.url, key++, depth));
        i = link.end;
        continue;
      }
    }

    buffer += ch;
    i++;
  }

  flush();
  return nodes;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export function parseMarkdown(src: string): React.ReactNode {
  const lines = src.replace(/\r\n/g, '\n').split('\n');
  return <>{parseBlocks(lines)}</>;
}

export function stripMarkdown(src: string): string {
  let text = src;
  text = text.replace(/```(\w*)\n?([\s\S]*?)```/g, (_m, _lang, body) => body);
  text = text.replace(/`([^`]*)`/g, '$1');
  text = text.replace(/\[([^\]]*)\]\([^)]*\)/g, '$1');
  text = text.replace(/^#{1,6}\s+/gm, '');
  text = text.replace(/^>\s?/gm, '');
  text = text.replace(/^\s*[-*+]\s+/gm, '');
  text = text.replace(/^\s*\d+\.\s+/gm, '');
  text = text.replace(/(\*\*|__)(.*?)\1/g, '$2');
  text = text.replace(/(\*|_)(.*?)\1/g, '$2');
  text = text.replace(/\|/g, ' ');
  text = text.replace(/^(---|\*\*\*|___)$/gm, '');
  text = text.replace(/<\/?details>|<summary>|<\/summary>/g, '');
  text = text.replace(/\s+/g, ' ').trim();
  return text;
}
