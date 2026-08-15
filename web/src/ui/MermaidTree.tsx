import React from 'react';
import { parseGraphLR, type GraphNode } from './mermaidParse';
import { useIsNarrow } from '../shell/useIsNarrow';

const STATUS_STYLE: Record<'active' | 'shadow' | 'retired', { bg: string; color: string }> = {
  active: { bg: 'rgba(16, 185, 129, 0.15)', color: 'var(--color-text-green)' },
  shadow: { bg: 'rgba(245, 158, 11, 0.15)', color: 'var(--color-text-yellow)' },
  retired: { bg: 'rgba(107, 114, 128, 0.15)', color: 'var(--color-text-tertiary)' },
};

export const MermaidTree: React.FC<{ src: string }> = ({ src }) => {
  const isNarrow = useIsNarrow();
  const graph = parseGraphLR(src);

  if (!graph) {
    return (
      <div>
        <pre className="p-md bg-page border-emphasized rounded-lg text-xs text-secondary overflow-auto m-0">
          {src}
        </pre>
        <div className="text-xs text-tertiary mt-xs">
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

  return (
    <div className={`p-md bg-subtle rounded-lg border-default overflow-auto ${isNarrow ? 'flex-col' : 'flex-row'} gap-lg items-start`}>
      <div className="p-sm rounded-md bg-subtle border-default text-bold text-primary">
        {rootNode.label.join(' ')}
      </div>

      <div className="flex-col gap-sm">
        {level2Ids.map((pid) => {
          const pNode = nodeById.get(pid)!;
          const bIds = childrenOf.get(pid) || [];
          return (
            <div key={pid} className="p-sm bg-page border-emphasized rounded-lg">
              <div className="text-mono text-accent text-sm">
                {pNode.label[0]}
              </div>
              {pNode.label[1] && (
                <div className="text-xs text-tertiary mb-xs">
                  {pNode.label[1]}
                </div>
              )}
              <div className="flex-row flex-wrap gap-xs">
                {bIds.map((bid) => {
                  const bNode = nodeById.get(bid)!;
                  const palette = bNode.statusClass
                    ? STATUS_STYLE[bNode.statusClass]
                    : { bg: 'var(--color-background-muted)', color: 'var(--color-text-disabled)' };
                  return (
                    <span
                      key={bid}
                      className="text-xs text-semibold p-xs rounded-sm"
                      style={{ background: palette.bg, color: palette.color }}
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
