import React, { useMemo } from 'react';
import { parseMarkdown } from './markdownParse';

/**
 * Palette matches web/src/screens/rules/RulesTable.tsx: #0f172a card bg,
 * #020617 page bg, #1e293b borders, #38bdf8 accent, #94a3b8 muted text.
 */
export const MD_STYLES: Record<string, React.CSSProperties> = {
  p: { margin: '0 0 8px', color: '#cbd5e1', fontSize: 13 },
  h4: { margin: '12px 0 6px', color: '#f8fafc', fontWeight: 700 },
  h5: { margin: '12px 0 6px', color: '#f8fafc', fontWeight: 700 },
  h6: { margin: '12px 0 6px', color: '#f8fafc', fontWeight: 700 },
  ul: { margin: '0 0 8px', paddingLeft: 20 },
  ol: { margin: '0 0 8px', paddingLeft: 20 },
  code: {
    background: '#1e293b',
    color: '#38bdf8',
    padding: '1px 4px',
    borderRadius: 4,
    fontFamily: 'monospace',
  },
  pre: {
    background: '#020617',
    border: '1px solid #1e293b',
    overflowX: 'auto',
    whiteSpace: 'pre',
    padding: 12,
    borderRadius: 8,
  },
  a: { color: '#60a5fa' },
  blockquote: { borderLeft: '3px solid #334155', paddingLeft: 10, margin: 0 },
  table: { borderCollapse: 'collapse', width: '100%' },
  th: { border: '1px solid #1e293b', padding: '6px 10px', textAlign: 'left', fontSize: 12 },
  td: { border: '1px solid #1e293b', padding: '6px 10px', textAlign: 'left', fontSize: 12 },
};

// CSS custom properties don't want a unit suffix even though their JS value is numeric.
const UNITLESS_PROPS = new Set(['fontWeight', 'lineHeight', 'zIndex', 'opacity', 'flexGrow', 'flexShrink', 'order']);

function camelToKebab(prop: string): string {
  return prop.replace(/[A-Z]/g, (m) => `-${m.toLowerCase()}`);
}

function styleToCss(style: React.CSSProperties): string {
  return Object.entries(style)
    .map(([prop, value]) => {
      const cssProp = camelToKebab(prop);
      const cssValue = typeof value === 'number' && !UNITLESS_PROPS.has(prop) ? `${value}px` : value;
      return `${cssProp}: ${cssValue};`;
    })
    .join(' ');
}

let instanceCounter = 0;

/**
 * Renders markdown source as real React elements (parseMarkdown never
 * returns an HTML string — see markdownParse.tsx). Styling is applied via a
 * scoped <style> tag built from MD_STYLES rather than dangerouslySetInnerHTML,
 * since the recursive parser in markdownParse.tsx doesn't thread style props
 * through every nested element it produces.
 */
export const Markdown: React.FC<{ source: string; variant?: 'block' | 'compact' }> = ({
  source,
  variant = 'block',
}) => {
  const content = useMemo(() => parseMarkdown(source), [source]);
  // Stable per-mount, not per-render: className must not change across re-renders
  // triggered by keystrokes in a live preview pane, or the <style> scope would churn.
  const className = useMemo(() => `md-render-${++instanceCounter}`, []);

  const css = useMemo(
    () =>
      Object.entries(MD_STYLES)
        .map(([tag, style]) => `.${className} ${tag} { ${styleToCss(style)} }`)
        .join('\n'),
    [className]
  );

  return (
    <div className={className} style={variant === 'compact' ? { fontSize: 12 } : undefined}>
      <style>{css}</style>
      {content}
    </div>
  );
};
