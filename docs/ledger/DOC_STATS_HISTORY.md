# Doc stats history

**TL;DR:** Append-only trend log written by `/audit-docs` and `/consolidate-docs`. Source glob: tracked `*.ts *.tsx *.js *.mjs *.mts *.kt`, minus node_modules, build output and `.d.ts`.

| Date | Skill | Non-exempt .md files | Files >600 words | Doc/code growth (90d) | Doc words | Source LOC | Words per 1k LOC | Orphans |
|---|---|---|---|---|---|---|---|---|
| 2026-10-31 | audit-docs | 11 (green) | 6 (yellow) | 5% (green) | 11,549 | 19,257 | 600 | 0 |

Scope from 2026-11-10: headline metrics cover official docs; plans/research have separate counts and ledgers (including the changelog) are exempt. Source globs remain tracked `*.ts *.tsx *.js *.mjs *.mts *.kt`, excluding `.d.ts`, node_modules, dist, build, vendor, .gradle and .expo. Earlier rows predate this classification.

| 2026-11-10 | audit-docs | 11 (green) | 7 (yellow) | 2.7% (green; +623 doc / +22,788 source lines) | 19,417 | 32,899 | 590 | 0 |

Additional metrics: 3 exempt ledger files; 5 plans (0 stale); 1 research file, 2,221 words, 122 lines, +120 lines in 90 days (green). Source counts use the same globs for growth and density.
