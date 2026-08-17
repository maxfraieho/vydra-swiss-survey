<!-- gitnexus:start -->
# GitNexus — Code Intelligence

This project is indexed by GitNexus as **vydra-swiss-survey** (153 symbols, 418 relationships, 12 execution flows). Use the GitNexus MCP tools to understand code, assess impact, and navigate safely.

> Index stale? Run `node .gitnexus/run.cjs analyze` from the project root — it auto-selects an available runner. No `.gitnexus/run.cjs` yet? `npx gitnexus analyze` (npm 11 crash → `npm i -g gitnexus`; #1939).

## Always Do

- **MUST use Termux Local Build & Deploy (`termux-build-deploy`).** ALL deployments and builds MUST run 100% locally on Termux via `bash bin/build-deploy.sh`. Server process health is monitored locally by `bin/watchdog_astryx.sh`.
- **MUST follow SDD Workflow (Spec First, Code Second).** For EVERY new feature, UI component, or API endpoint, the agent MUST first read `.agents/skills/sdd-workflow/SKILL.md` using `view_file` and create `specs/<feature>/spec.md`, `plan.md`, and `tasks.md` BEFORE modifying implementation code.
- **MUST preserve all open Chrome tabs.** NEVER close active browser tabs on script completion or loop exit. `CDPClient.close()` tab auto-pruning is permanently disabled.
- **MUST explicitly click submit button on pre-filled login forms.** When Chrome's password manager pre-fills login/password fields, the agent MUST immediately locate and click the submit button ("S'identifier" / "Connexion" / "Anmelden") and verify page transition via screenshot.
- **MUST run impact analysis before editing any symbol.** Before modifying a function, class, or method, run `impact({target: "symbolName", direction: "upstream"})` and report the blast radius (direct callers, affected processes, risk level) to the user.
- **MUST run `detect_changes()` before committing** to verify your changes only affect expected symbols and execution flows. For regression review, compare against the default branch: `detect_changes({scope: "compare", base_ref: "main"})`.
- **MUST warn the user** if impact analysis returns HIGH or CRITICAL risk before proceeding with edits.
- **MUST read `.specify/feature.json` + `git log -n 1 --stat` before starting SDD work.** This is the Handoff Protocol (`specs/021-multiagent-sdd-extension/plan.md` §4) that keeps multiple agents (Claude Code, Codex CLI, AGY) from drifting on the same feature. If `.specify/feature.json`'s `branch` field does not match the currently checked-out branch, STOP and tell the operator — do not guess which feature is active from memory.
- **MUST update `.specify/feature.json`'s `phase`/`phases_done`/`updated_at` on every SDD phase transition** (specify → clarify → plan → tasks → implement → verify), committing that update as its own atomic commit (`spec:`, `plan:`, `tasks:`, `impl:` prefix) — not bundled silently into an unrelated commit.
- **MUST run `bash bin/sdd_verify.sh --gate` before being allowed to modify implementation code for the active feature.** It validates the artifacts required for the current `phase` exist. This is the L3 Validator Gate.
- When exploring unfamiliar code, use `query({query: "concept"})` to find execution flows instead of grepping. It returns process-grouped results ranked by relevance.
- When you need full context on a specific symbol — callers, callees, which execution flows it participates in — use `context({name: "symbolName"})`.

## Never Do

- NEVER execute SSH commands, rsync, or remote deployments to dev-184 or external IPs.
- NEVER write or edit feature code without an active specification document in `specs/<feature>/spec.md`.
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