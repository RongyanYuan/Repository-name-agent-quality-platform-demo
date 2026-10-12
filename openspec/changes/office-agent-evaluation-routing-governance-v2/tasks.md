## 1. Domain, migration and fixtures

- [x] 1.1 Extend `src/evolution/domain.ts` with `SkillCategory`, `EvaluationBatch`, `EvaluationJob`, `TraceEvaluationPackage`, `EvaluationFinding`, `RoutingPolicy`, `RoutingDecision`, `RoutingDelivery`, `AlgorithmBadcaseItem`, `BadcaseQueue`, module score/evidence and batch/routing status unions; preserve V1 types and exact attribution labels.
- [x] 1.2 Add schema migration in `src/evolution/store.ts`/repository bootstrap that reads V1 LocalStorage without overwrite, creates compatibility packages/findings/deliveries, and records migration audit/version.
- [x] 1.3 Expand `src/evolution/data.ts` to 30–50 Trace/Case fixtures covering PRODUCTION_SKILL, GENERAL, PERSONAL_SKILL, TASTE_SKILL, UNCLASSIFIED, all batch states, missing evidence, multi-module failures and multi-route deliveries; include the management PPT, deterministic Tool/Skill fix and multi-attribution examples.
- [x] 1.4 Add selectors for batch statistics, ledger filters, five-state module summaries, first non-derived failure, evidence completeness and routing/badcase queues; add unit tests first and verify V1 aliases/URL IDs.

## 2. Store and routing workflow

- [x] 2.1 Extend the evolution reducer/actions for create/queue/retry EvaluationJob, module human override, finding confirmation, routing decision/delivery updates, Badcase confirmation/rejection, owner/note assignment and audit entries.
- [x] 2.2 Add repository-shaped adapters (`listBatches`, `listTracePackages`, `createEvaluationJob`, `listRoutingDeliveries`) backed by local Mock data, with explicit Mock boundary text and unknown/error states.
- [x] 2.3 Implement default RoutingPolicy rules for exact Skill Categories, `策略迭代`/`Agent迭代`, direct Tool/Runtime fix, algorithm Badcase Candidate, Taste queue and Personal Skill planning; allow multiple deliveries per finding and preserve taxonomy snapshots.

## 3. Evaluation center and evidence UX

- [x] 3.1 Refactor `EvaluationCenterPage` into Batch History, All Evaluated Traces, Process Eval and Outcome Eval tabs while preserving existing deep links and filters.
- [x] 3.2 Add batch creation/run/retry UI with status, counts, Eval Agent/Rubric versions, input Trace IDs, run history and frozen configuration snapshot.
- [x] 3.3 Add full Trace Ledger table with Batch/Case/Session/Trace/query/version/category/coverage/failure/evidence/routing/badcase/owner columns and URL-serializable filters.
- [x] 3.4 Add shared `ModuleEvaluationMatrix`/`EvidenceBundleDrawer` showing Reason、记忆、上文、skill、Act、Tool、Outcome/产物, five-state status, score, Judge Reason, Root Evidence, Rubric Rule, Observation/Log, First/Derived Failure and Eval Disagreement.
- [x] 3.5 Wire Trace ledger and Evidence clicks into existing Case/Session/Trace/Artifact/Log links; ensure Context Assembly is evidence-only and absent from module KPI lists.

## 4. Routing, Badcase and governance bridge

- [x] 4.1 Add Routing Delivery and Algorithm Badcase Queue tabs to Issues (or shared governance view), with multi-delivery cards, Candidate → Confirmed/Rejected state, owner/note, algorithm handoff and source Trace/evidence links.
- [x] 4.2 Update Case workbench to show all package module scores, findings, delivery paths, exact attribution wording, manual confirmation and links to Issue/Cluster/Variant.
- [x] 4.3 Update Overview with evaluation-batch/coverage/routing funnel and Skill Category distribution while retaining the four homepage sections, original metric definitions, mock labels and first-failure counting.
- [x] 4.4 Connect findings → Issue/Cluster → Variant → single/window Experiment → Gate/Release reverse lineage; freeze Eval/Rubric/Artifact/Evidence Bundle and window cutoff/frozen state in experiment runs.
- [x] 4.5 Add Personal Skill planning source fields (Query, Asset/File, existing Skill, Conversation + Artifact), Taste 100-item count, and Rule configuration views with unknown thresholds marked 待配置.

## 5. Verification and delivery

- [x] 5.1 Add unit/Testing Library tests for migration, batch selectors, five-state evidence, exact attribution dictionary, multi-route routing and reducer persistence.
- [x] 5.2 Add Playwright smoke flow: Overview → batch → Trace ledger → module Evidence → routing delivery → Badcase confirm → Issue/Cluster → Variant → Experiment/Gate/Release; assert visible state changes and preserved query filters.
- [x] 5.3 Run `CI=1 pnpm test`, `CI=1 pnpm run lint`, `CI=1 pnpm run build`, `CI=1 pnpm test:e2e`; check 1440/1024/390 layouts for overflow and text misalignment.
- [x] 5.4 Update README with V2 workflow, batch/routing entities, Mock/real boundary, migration behavior and launch command; report remaining PRD fields as 待配置.
