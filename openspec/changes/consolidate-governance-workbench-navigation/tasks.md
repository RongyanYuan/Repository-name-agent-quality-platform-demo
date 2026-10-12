## 1. Unified workbench

- [x] 1.1 Extend the unified Dataset and Evaluation page with `traces`, `datasets`, and `history` views, shared Skill/evolution filters, and URL-persisted view state; verify view switching preserves filters.
- [x] 1.2 Project Trace evaluations, dataset metadata, experiment summaries, gate decisions, variants, and releases into the unified workbench; verify object IDs and empty governance states.
- [x] 1.3 Add experiment result, 是否准出, and release status as independent fields; verify completed-without-decision and manual-review cases.
- [x] 1.4 Add history timeline and source Trace/Case reverse links; verify deep-link navigation returns to the selected workbench view.

## 2. Navigation consolidation

- [x] 2.1 Reduce primary navigation to Governance Overview, Case / Trace, 数据集与评测, and Rule Configuration; verify redundant links are absent.
- [x] 2.2 Add legacy redirects for evaluations, datasets, assets-skills, issues, variants, experiments, and releases; verify query parameters and object IDs are retained.
- [x] 2.3 Update breadcrumbs, page titles, route labels, and return paths for the consolidated workbench; verify existing legacy integration tests.

## 3. Skill detail pruning

- [x] 3.1 Reduce Skill detail to identity, version, ownership, update time, and unified workbench entry; verify no duplicate governance sections are rendered.
- [x] 3.2 Preserve internal asset access and Skill-to-asset links where needed without exposing asset/variant/experiment/release sections in Skill detail; verify asset governance tests.

## 4. Verification and delivery

- [x] 4.1 Add unit and page integration tests for the three workbench views, legacy route mapping, gate/release separation, and Skill detail pruning.
- [x] 4.2 Add Playwright coverage for navigation consolidation, old URL redirects, unified filtering, and reverse lineage links.
- [x] 4.3 Run `pnpm lint`, `pnpm test`, `pnpm build`, `pnpm exec playwright test`, and `openspec validate --changes --strict`; verify all checks pass.
