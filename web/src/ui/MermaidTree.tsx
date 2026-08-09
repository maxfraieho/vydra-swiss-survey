import React from 'react';
import { parseGraphLR, type GraphNode } from './mermaidParse';
import { useIsNarrow } from '../shell/useIsNarrow';

const STATUS_STYLE: Record<'active' | 'shadow' | 'retired', { bg: string; color: string }> = {
  active: { bg: 'rgba(16, 185, 129, 0.15)', color: 'var(--color-text-green)' },
  shadow: { bg: 'rgba(245, 158, 11, 0.15)', color: 'var(--color-text-yellow)' },
  retired: { bg: 'rgba(107, 114, 128, 0.15)', color: '#9ca3af' },
};

const FALLBACK_PRE_STYLE: React.CSSProperties = {
  background: 'var(--color-background-page)',
  border: '1px solid var(--color-border-emphasized)',
  overflowX: 'auto',
  whiteSpace: 'pre',
  padding: 12,
  borderRadius: 8,
  color: 'var(--color-text-secondary)',
  fontSize: 12,
  margin: 0,
};

/**
 * Renders the strict 3-level `graph LR` tree emitted by rules_report.py's
 * render_mermaid(): H (root) -> P* (pattern·persona) -> B* (source·status),
 * plus an optional MORE leaf. Depth is always exactly 3, so plain nested
 * divs are used instead of an SVG/canvas layout engine.
 *
 * Falls back to a plain <pre> block (with a note) when parseGraphLR can't
 * make sense of the input — backend format drift must never render a wrong
 * or partial graph.
 */
export const MermaidTree: React.FC<{ src: string }> = ({ src }) => {
  const isNarrow = useIsNarrow();
  const graph = parseGraphLR(src);

  if (!graph) {
    return (
      <div>
        <pre style={FALLBACK_PRE_STYLE}>{src}</pre>
        <div style={{ fontSize: 11, color: 'var(--color-text-tertiary)', marginTop: 4 }}>
          граф не розпізнано — показано як текст
        </div>
      </div>
    );
  }

  const nodeById = new Map<string, GraphNode>(graph.nodes.map((n) => [n.id, n]));
  const childrenOf = new Map<string, string[]>();
  for (const [from, to] of graph.edges) {
    if (!childrenOf.has(from)) childrenOf.set(from, []);
    childrenOf.get(from)!.push(to);
  }

  const rootNode = nodeById.get(graph.root)!;
  const rootChildren = childrenOf.get(graph.root) || [];
  const level2Ids = rootChildren.filter((id) => id !== 'MORE');
  const moreId = rootChildren.find((id) => id === 'MORE');

  return (
    <div style={{ paddingLeft: isNarrow ? 0 : 4 }}>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: 10,
          background: 'var(--color-background-muted)',
          color: 'var(--color-text-primary)',
          fontWeight: 700,
          padding: '6px 12px',
          borderRadius: 8,
          marginBottom: 10,
          width: 'fit-content',
          maxWidth: '100%',
        }}
      >
        <span>{rootNode.label.join(' ')}</span>
        {moreId && (
          <span style={{ fontSize: 11, color: 'var(--color-text-tertiary)', fontWeight: 400 }}>
            {nodeById.get(moreId)!.label.join(' ')}
          </span>
        )}
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, paddingLeft: 16 }}>
        {level2Ids.map((pid) => {
          const pNode = nodeById.get(pid)!;
          const bIds = childrenOf.get(pid) || [];
          return (
            <div
              key={pid}
              style={{
                background: '#0f172a',
                border: '1px solid var(--color-border-emphasized)',
                borderRadius: 8,
                padding: 10,
              }}
            >
              <div style={{ fontFamily: 'monospace', color: 'var(--color-accent)', fontSize: 13 }}>
                {pNode.label[0]}
              </div>
              {pNode.label[1] && (
                <div style={{ color: 'var(--color-text-disabled)', fontSize: 12, marginBottom: 6 }}>
                  {pNode.label[1]}
                </div>
              )}
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {bIds.map((bid) => {
                  const bNode = nodeById.get(bid)!;
                  const palette = bNode.statusClass
                    ? STATUS_STYLE[bNode.statusClass]
                    : { bg: 'var(--color-background-muted)', color: 'var(--color-text-disabled)' };
                  return (
                    <span
                      key={bid}
                      style={{
                        fontSize: 11,
                        fontWeight: 600,
                        padding: '3px 8px',
                        borderRadius: 6,
                        background: palette.bg,
                        color: palette.color,
                        lineHeight: 1.4,
                      }}
                    >
                      {bNode.label.map((l, i) => (
                        <React.Fragment key={i}>
                          {i > 0 && <br />}
                          {l}
                        </React.Fragment>
                      ))}
                    </span>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
