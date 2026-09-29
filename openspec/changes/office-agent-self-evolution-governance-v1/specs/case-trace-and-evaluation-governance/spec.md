## Purpose

定义从线上 Case 到 Session、Trace、节点、Log、Evidence、产物和两类 Eval 的联合分析、人工复核与治理关联体验。

## ADDED Requirements

### Requirement: Unified Case and Trace filtering
The Case / Trace workspace SHALL support filters for query, Session ID, Trace ID, Skill ID, Skill version, time, result evaluation, process evaluation, Log ID, multiple routing labels, and multi-scenario hit status, and SHALL expose those active values in restorable URL state.

#### Scenario: Apply multiple independent filters
- **WHEN** a user enters a Skill version, process verdict, Log ID, and two routing labels
- **THEN** only Cases satisfying all declared filters remain and the URL contains each filter without collapsing multi-select values

### Requirement: Exact Session and Trace context
The Case detail SHALL show the user task, its Session, ordered real conversation turns, every related Trace, and the exact Trace associated with each query/response turn. A user SHALL be able to switch between a Case's Traces and deep-link to an exact Trace or Observation.

#### Scenario: Inspect a multi-turn Office Session
- **WHEN** a user opens the management-PPT Case and selects Session conversation
- **THEN** the platform displays each turn in order and provides the correct related Trace link for each query

#### Scenario: Open a non-primary Trace
- **WHEN** a URL identifies a Case, a non-primary Trace, and an Observation on that Trace
- **THEN** the detail opens the requested Trace timeline with that Observation selected

### Requirement: Trace node evidence and logs
The Case detail SHALL present ordered execution nodes, their Skill or Tool, latency, status, input, output, error, metadata, Log ID, root-cause or derived-failure meaning, and linked Evidence. A failed node SHALL navigate to its precise Evidence or Log.

#### Scenario: Open a failed execution node
- **WHEN** a user selects a failed Trace node
- **THEN** the platform shows its reason, linked root Evidence, applicable Rubric evidence, and an operable link to the node Log

### Requirement: Artifact-to-process navigation
The Case detail SHALL show related artifacts and their result evaluations and SHALL allow navigation from an artifact evaluation back to the execution Observation that produced or affected it.

#### Scenario: Trace a failed artifact judgment
- **WHEN** a user opens a failed result evaluation for an artifact and requests the related execution process
- **THEN** the platform opens the Case Trace at the relevant Observation

### Requirement: Separate process and outcome evaluation workspaces
Process evaluations and artifact/outcome evaluations SHALL be independently listable and viewable while remaining cross-linked by Case, Trace, Observation, and Artifact IDs. Each evaluation SHALL retain evaluation version, time, verdict or score, judgment reason, Evidence, and complete automatic and human revision history.

#### Scenario: Compare automatic and human conclusions
- **WHEN** an evaluation has an automatic conclusion and a later human confirmation
- **THEN** the detail displays both chronological revisions, their evaluators, reasons, scores/verdicts, times, and Evidence without overwriting the automatic record

### Requirement: Persisted human Case governance actions
The Case workspace SHALL allow a user to confirm a result, adjust an explicitly selected attribution, record a note, and select multiple routing labels; each action SHALL append an audit/revision record and remain after the application is unmounted and remounted.

#### Scenario: Adjust one of multiple attributions
- **WHEN** a Case has multiple attributions and a user selects one to revise
- **THEN** only that attribution receives the new revision while the other attributions and all earlier revisions remain unchanged

#### Scenario: Reload after human confirmation
- **WHEN** a user saves a Case confirmation and restarts the local application
- **THEN** the saved confirmation and audit entry are restored from local persistence

### Requirement: Bidirectional Case lineage
The Case detail SHALL link to every related Issue, Issue Cluster, Variant, Experiment, Gate Decision, and Release Version, and each owning detail SHALL provide a reverse route to its source Case where applicable. All displayed entity IDs in lineage and evidence contexts SHALL be operable links or explicitly marked as unavailable.

#### Scenario: Follow a Case to release and back
- **WHEN** a user follows the management-PPT Case through its Issue, Variant, Experiment, and Release
- **THEN** the release detail can navigate back through the same lineage to the original Case
