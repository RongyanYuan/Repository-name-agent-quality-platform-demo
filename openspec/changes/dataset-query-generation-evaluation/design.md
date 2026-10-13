## Context

See proposal.md for scope. The React/Vite workbench already creates custom datasets and enrolls exact Trace members. EvolutionProvider.commit persists atomically; the domain has execution graphs, evaluation batches and immutable review histories. Dataset input membership and experimental gate reports must stay intact.

## Goals / Non-Goals

Goals: use additive local entities and existing Trace review UI to complete both input/run flows; capture immutable run inputs and keep failures and outputs independently inspectable.

Non-goals: deploying a real Office Agent, defining business gate thresholds, changing page count, rewriting frozen dataset membership, or pretending Mock HTML artifacts are actual Office files.

## Decisions

1. Add optional datasetQueries and datasetExecutionRuns arrays so older snapshots remain valid. Each Query belongs to a dataset/version and records optional asset/version. Pending Query count is distinct from materialized Case and Trace counts.
2. Freeze all runnable Query/Trace inputs and resolved asset versions into a run snapshot at creation. Generate mode uses every concrete input to create independent executions; evaluation-only excludes unexecuted drafts and reports missing output errors on existing Traces. External statistical population is never materialized automatically.
3. Keep run outputs outside input membership, including for frozen datasets. Source dataset/version, Query and Trace IDs remain in each run item. Adding a run must not add output Cases back as new source samples or inflate later run sizes.
4. Model queued/running/completed/partial/failed batches and per-item phases. Persist transitions with atomic commits and idempotent IDs. An interrupted run can explicitly continue pending items; completed result snapshots never change.
5. Append automatic process and outcome records plus a Trace evaluation package and Evidence. Process modules are Reason, 记忆, skill and Act; 上文 is context only. Product dimension labels use existing vertical standards and scores stay 0–2. Business gate conclusions are neither inferred from low scores nor from successful execution.
6. Local mock provider produces deterministic numeric scores and downloadable HTML previews clearly identified as Mock. Configuration supports normal, partial-failure and full-failure demo scenarios to exercise error paths; a replacement adapter implements the same execution/result contract.
7. A standalone dataset execution component owns Query/config dialogs and batch result history, mounted in both general and exact-target dataset drawers. List actions open the same configuration workflow. Case navigation clears incompatible source filters, selects the execution's environment and retains an exact return URL containing dataset and batch context.

## Risks / Trade-offs

- Large local storage snapshots → store compact run outputs with graph IDs and essential scores/evidence snapshots; use current compressed persistence and test reload/quota behavior without clearing user data.
- Refresh or duplicate clicks → persist progress, lock each active batch in the controller and make result application idempotent.
- Runtime graph validation → check every generated relation and preserve source IDs as strings, including long numeric Session and Trace IDs.
- Old pending datasets with no real Query → show runnable count zero and the reason; no artificial external inputs.

## Migration Plan

Load new optional arrays as empty where absent, preserve all existing data and reviews, and validate new relationships. No schema reset is required. Removing the new UI leaves existing dataset inputs and original execution graphs intact.
