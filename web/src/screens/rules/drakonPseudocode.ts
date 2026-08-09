// Pure parser: turns DRAKON-diagram pseudocode (exported by the sibling project
// ai-drakon-scaffolder's "Export Pseudocode" button) into structured rule drafts
// for the rule-creation form. No React, no side effects, no network calls.
//
// Caller responsibilities (not this file's job):
//   - fetch `knownPatterns` from GET /api/rules/vocabulary (Object.keys(topic_keywords))
//     and pass it in — never hardcode a pattern list here, it must never drift from
//     the backend's reflection.py::TOPIC_KEYWORDS.
//   - apply defaults for fields a diagram can never derive: persona = '*', confidence = 0.9
//   - leave `host` and `note` for the human to fill in
//   - truncate/validate suggestedBehavior to <= 2000 chars before submit

export interface UnparsedLine {
  line: number;
  text: string;
  reason: string;
}

export interface ParsedRule {
  name: string | null;
  conditions: string[];
  actions: string[];
  suggestedPattern: string;
  patternIsKnown: boolean;
  suggestedBehavior: string;
  unparsed: UnparsedLine[];
  warnings: string[];
  sourceLines: { from: number; to: number };
}

export interface ParseResult {
  rules: ParsedRule[];
  globalUnparsed: UnparsedLine[];
  inputKind: 'pseudocode' | 'json' | 'empty';
}

const HEADER_RE = /^#\s*(.+)$/;
const IF_RE = /^IF\s+(.+)$/i;
const THEN_RE = /^THEN$/i;
const ELSE_RE = /^ELSE$/i;
const END_RE = /^END$/i;

export function slugify(name: string): string {
  const slug = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_+|_+$/g, '');
  return slug || 'rule';
}

export function isKnownPattern(pattern: string, knownPatterns: string[]): boolean {
  return knownPatterns.includes(pattern);
}

function newRule(name: string | null, line: number): ParsedRule {
  return {
    name,
    conditions: [],
    actions: [],
    suggestedPattern: '',
    patternIsKnown: false,
    suggestedBehavior: '',
    unparsed: [],
    warnings: [],
    sourceLines: { from: line, to: line },
  };
}

function finalizeRule(rule: ParsedRule, knownPatterns: string[], endLine: number): ParsedRule {
  rule.sourceLines.to = endLine;

  if (rule.conditions.length === 0) {
    rule.warnings.push('немає умов (IF) — перевір, чи це справді умовне правило');
  }
  if (rule.actions.length === 0) {
    rule.warnings.push('немає дій — behavior треба написати вручну');
  }

  const slug = slugify(rule.name ?? '');
  let pattern = slug;
  let patternIsKnown = isKnownPattern(slug, knownPatterns);

  if (!patternIsKnown) {
    const substringMatch = knownPatterns.find((p) => slug.includes(p));
    if (substringMatch) {
      pattern = substringMatch;
      patternIsKnown = true;
      rule.warnings.push('патерн виведено з назви діаграми — перевір');
    } else {
      rule.warnings.push('патерн відсутній у відомому словнику — перевір або додай новий');
    }
  }

  rule.suggestedPattern = pattern;
  rule.patternIsKnown = patternIsKnown;

  const conds = rule.conditions.join(' та ');
  const acts = rule.actions.join('; ');
  let behavior = conds ? `Якщо ${conds} — ${acts}.` : `${acts}.`;

  if (rule.unparsed.length > 0) {
    const lines = rule.unparsed.map((u) => `L${u.line}: ${u.text}`).join('\n');
    behavior += `\n\n#### нерозпізнані рядки псевдокоду — перевір і прибери\n\n\`\`\`\n${lines}\n\`\`\`\n`;
  }

  rule.suggestedBehavior = behavior;
  return rule;
}

export function parseDrakonPseudocode(text: string, knownPatterns: string[]): ParseResult {
  const trimmed = text.trim();

  if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
    try {
      JSON.parse(trimmed);
      return { rules: [], globalUnparsed: [], inputKind: 'json' };
    } catch {
      // not valid JSON — fall through to pseudocode parsing
    }
  }

  if (trimmed === '') {
    return { rules: [], globalUnparsed: [], inputKind: 'empty' };
  }

  const lines = text.split('\n');
  const rules: ParsedRule[] = [];
  const globalUnparsed: UnparsedLine[] = [];

  let current: ParsedRule | null = null;
  let inThen = false;
  let branch: 'then' | 'else' = 'then';
  let lastLineNo = 1;

  for (let i = 0; i < lines.length; i++) {
    const lineNo = i + 1;
    const line = lines[i].trim();

    if (line === '') continue;

    const headerMatch = line.match(HEADER_RE);
    if (headerMatch) {
      if (current) {
        if (inThen) {
          current.warnings.push('немає END — блок дій закрито автоматично');
        }
        rules.push(finalizeRule(current, knownPatterns, lineNo - 1));
      }
      current = newRule(headerMatch[1], lineNo);
      inThen = false;
      branch = 'then';
      lastLineNo = lineNo;
      continue;
    }

    const ifMatch = line.match(IF_RE);
    if (ifMatch) {
      if (!current) {
        current = newRule(null, lineNo);
        current.warnings.push('IF без імені діаграми (# рядка)');
      }
      current.conditions.push(ifMatch[1]);
      lastLineNo = lineNo;
      continue;
    }

    if (THEN_RE.test(line)) {
      inThen = true;
      branch = 'then';
      lastLineNo = lineNo;
      continue;
    }

    if (ELSE_RE.test(line)) {
      branch = 'else';
      lastLineNo = lineNo;
      continue;
    }

    if (END_RE.test(line)) {
      inThen = false;
      lastLineNo = lineNo;
      continue;
    }

    if (inThen && current) {
      current.actions.push(branch === 'else' ? `інакше: ${line}` : line);
      lastLineNo = lineNo;
      continue;
    }

    if (current) {
      current.unparsed.push({ line: lineNo, text: line, reason: 'рядок поза блоком THEN..END' });
    } else {
      globalUnparsed.push({ line: lineNo, text: line, reason: 'текст до першого "# назва"' });
    }
    lastLineNo = lineNo;
  }

  if (current) {
    if (inThen) {
      current.warnings.push('немає END — блок дій закрито автоматично');
    }
    rules.push(finalizeRule(current, knownPatterns, lastLineNo));
  }

  return { rules, globalUnparsed, inputKind: 'pseudocode' };
}
