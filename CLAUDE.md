<!-- gitnexus:start -->
# GitNexus — Code Intelligence

This project is indexed by GitNexus as **vydra-swiss-survey** (153 symbols, 418 relationships, 12 execution flows). Use the GitNexus MCP tools to understand code, assess impact, and navigate safely.

> Index stale? Run `node .gitnexus/run.cjs analyze` from the project root — it auto-selects an available runner. No `.gitnexus/run.cjs` yet? `npx gitnexus analyze` (npm 11 crash → `npm i -g gitnexus`; #1939).

## Always Do

- **MUST run impact analysis before editing any symbol.** Before modifying a function, class, or method, run `impact({target: "symbolName", direction: "upstream"})` and report the blast radius (direct callers, affected processes, risk level) to the user.
- **MUST run `detect_changes()` before committing** to verify your changes only affect expected symbols and execution flows. For regression review, compare against the default branch: `detect_changes({scope: "compare", base_ref: "main"})`.
- **MUST warn the user** if impact analysis returns HIGH or CRITICAL risk before proceeding with edits.
- When exploring unfamiliar code, use `query({query: "concept"})` to find execution flows instead of grepping. It returns process-grouped results ranked by relevance.
- When you need full context on a specific symbol — callers, callees, which execution flows it participates in — use `context({name: "symbolName"})`.
- **MUST treat a thin/suspicious `detect_changes()` result as stale index, not "low risk."** If real code files were edited but the result only shows doc/markdown symbols (or 0 affected despite substantive changes), reindex first — `node .gitnexus/run.cjs analyze` — then re-run `detect_changes()` before committing.

## Never Do

- NEVER edit a function, class, or method without first running `impact` on it.
- NEVER ignore HIGH or CRITICAL risk warnings from impact analysis.
- NEVER rename symbols with find-and-replace — use `rename` which understands the call graph.
- NEVER commit changes without running `detect_changes()` to check affected scope.

## Resources

| Resource | Use for |
|----------|---------|
| `gitnexus://repo/vydra-swiss-survey/context` | Codebase overview, check index freshness |
| `gitnexus://repo/vydra-swiss-survey/clusters` | All functional areas |
| `gitnexus://repo/vydra-swiss-survey/processes` | All execution flows |
| `gitnexus://repo/vydra-swiss-survey/process/{name}` | Step-by-step execution trace |

## CLI

| Task | Read this skill file |
|------|---------------------|
| Understand architecture / "How does X work?" | `.claude/skills/gitnexus/gitnexus-exploring/SKILL.md` |
| Blast radius / "What breaks if I change X?" | `.claude/skills/gitnexus/gitnexus-impact-analysis/SKILL.md` |
| Trace bugs / "Why is X failing?" | `.claude/skills/gitnexus/gitnexus-debugging/SKILL.md` |
| Rename / extract / split / refactor | `.claude/skills/gitnexus/gitnexus-refactoring/SKILL.md` |
| Tools, resources, schema reference | `.claude/skills/gitnexus/gitnexus-guide/SKILL.md` |
| Index, status, clean, wiki CLI commands | `.claude/skills/gitnexus/gitnexus-cli/SKILL.md` |

<!-- gitnexus:end -->

## Caveman Skill — Mandatory, First Priority

**MUST** invoke skill `caveman:caveman` (mode `full`) at the very start of any session/task in this repo, before any other skill or exploration step. This is the token-conservation directive for this project — every session working on `vydra-swiss-survey` runs under caveman brevity rules until told `stop caveman`/`normal mode`.

- Load `caveman:caveman` first, ahead of `gitnexus`, `Explore`, or any other skill in the listing.
- All response text (not code/commits/docs) stays terse per caveman rules — see global `~/.claude/CLAUDE.md` for the full ruleset.
- Marketplace source: `JuliusBrussee/caveman` (GitHub). If the plugin isn't enabled for the current agent/host, enable it (`enabledPlugins: {"caveman@caveman": true}`) before proceeding — do not skip this step to save a permission prompt.
- This directive does not relax the gitnexus MUST-rules above (impact analysis, detect_changes) — caveman controls response *style*, gitnexus controls edit *safety*. Both apply simultaneously.