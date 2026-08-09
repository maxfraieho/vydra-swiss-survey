/**
 * Pure parser for the exact `graph LR` grammar emitted by the Python backend's
 * render_mermaid() (see rules_report.py ~line 329). No React, no DOM.
 *
 * Fixed shape: strict 3-level tree per host — H (root) -> P* (pattern·persona)
 * -> B* (source·status), plus an optional flat MORE leaf hung off H.
 *
 * This is NOT a general mermaid parser. Anything outside the grammar below
 * (subgraphs, cycles, edge labels, click handlers, directives, multiple
 * roots) returns null — the caller falls back to rendering raw text. That
 * null-fallback is the safety net for backend format drift.
 */

export interface GraphNode {
  id: string;
  label: string[];
  statusClass?: 'active' | 'shadow' | 'retired';
}

export interface GraphLR {
  direction: string;
  nodes: GraphNode[];
  edges: [string, string][];
  root: string;
}

// Line-based grammar:
//   ^graph\s+(LR|TD|TB|RL)$                                   header
//   ^(\w+)\["(.*)"\]$                                          node declaration
//   ^(\w+)\s*-->\s*(\w+)(?:\["(.*)"\])?$                       edge, optional inline target decl
//   ^classDef\s+\w+\s+.*;$                                     ignored (we use our own palette)
//   ^class\s+([\w,]+)\s+(\w+);$                                status class assignment
//   blank line                                                  skip
//   anything else                                               parse failure -> null
const HEADER_RE = /^graph\s+(LR|TD|TB|RL)$/;
const NODE_DECL_RE = /^(\w+)\["(.*)"\]$/;
const EDGE_RE = /^(\w+)\s*-->\s*(\w+)(?:\["(.*)"\])?$/;
const CLASSDEF_RE = /^classDef\s+\w+\s+.*;$/;
const CLASS_ASSIGN_RE = /^class\s+([\w,]+)\s+(\w+);$/;

const STATUS_VALUES = new Set(['active', 'shadow', 'retired']);

export function parseGraphLR(src: string): GraphLR | null {
  const lines = src.replace(/\r\n/g, '\n').split('\n');

  let direction: string | null = null;
  const nodes = new Map<string, GraphNode>();
  const edges: [string, string][] = [];

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (line === '') continue;

    const headerMatch = HEADER_RE.exec(line);
    if (headerMatch) {
      if (direction !== null) return null; // duplicate header -> not this grammar
      direction = headerMatch[1];
      continue;
    }

    const edgeMatch = EDGE_RE.exec(line);
    if (edgeMatch) {
      const [, from, to, inlineLabel] = edgeMatch;
      if (!nodes.has(from)) return null; // source must already be declared
      if (inlineLabel !== undefined) {
        if (!nodes.has(to)) {
          nodes.set(to, { id: to, label: inlineLabel.split('<br/>') });
        }
      } else if (!nodes.has(to)) {
        return null; // reference to a node that was never declared
      }
      edges.push([from, to]);
      continue;
    }

    const nodeMatch = NODE_DECL_RE.exec(line);
    if (nodeMatch) {
      const [, id, label] = nodeMatch;
      nodes.set(id, { id, label: label.split('<br/>') });
      continue;
    }

    if (CLASSDEF_RE.test(line)) continue;

    const classAssignMatch = CLASS_ASSIGN_RE.exec(line);
    if (classAssignMatch) {
      const [, idList, statusName] = classAssignMatch;
      if (!STATUS_VALUES.has(statusName)) return null;
      for (const id of idList.split(',')) {
        const node = nodes.get(id);
        if (!node) return null;
        node.statusClass = statusName as 'active' | 'shadow' | 'retired';
      }
      continue;
    }

    return null; // unrecognized line -> parse failure
  }

  if (direction === null) return null;
  if (nodes.size === 0) return null;

  // Root: exactly one node with zero in-edges.
  const hasIncoming = new Set<string>();
  for (const [, to] of edges) hasIncoming.add(to);
  const roots: string[] = [];
  for (const id of nodes.keys()) {
    if (!hasIncoming.has(id)) roots.push(id);
  }
  if (roots.length !== 1) return null;
  const root = roots[0];

  // Must be a tree: no node has more than one parent.
  const inDegree = new Map<string, number>();
  for (const [, to] of edges) inDegree.set(to, (inDegree.get(to) || 0) + 1);
  for (const count of inDegree.values()) {
    if (count > 1) return null;
  }

  const children = new Map<string, string[]>();
  for (const [from, to] of edges) {
    if (!children.has(from)) children.set(from, []);
    children.get(from)!.push(to);
  }

  // BFS from root: detects cycles (revisit) and enforces max depth 3.
  const visited = new Set<string>([root]);
  const queue: Array<[string, number]> = [[root, 1]];
  let head = 0;
  while (head < queue.length) {
    const [id, level] = queue[head++];
    if (level > 3) return null;
    for (const childId of children.get(id) || []) {
      if (visited.has(childId)) return null; // cycle
      visited.add(childId);
      queue.push([childId, level + 1]);
    }
  }

  if (visited.size !== nodes.size) return null; // disconnected node(s)

  return {
    direction,
    nodes: Array.from(nodes.values()),
    edges,
    root,
  };
}
