## Purpose

定义能力变体从单变体验证、窗口组合验证到准出、发布、观察与回滚的可复查实验和发布契约。

## ADDED Requirements

### Requirement: Two-level experiment lifecycle
The platform SHALL support SINGLE_VARIANT and WINDOW_COMBINATION experiments with distinct lists, details, and lifecycle states including unrun, queued, running, completed, failed where applicable, and decided. A Window SHALL expose its exact candidate Variant membership, source single experiments, and combination experiment.

#### Scenario: Inspect exact Window membership
- **WHEN** a user opens a Window or its combination experiment
- **THEN** the platform displays exactly the Variants declared as members and the passing single experiment report for each included Variant

### Requirement: Configurable frozen experiment setup
Experiment creation SHALL allow the user to select the eligible Variant or Window membership, dataset versions, model, Tool permissions, timeout, run environment, and repeat count. The default demo repeat count SHALL be three per Case but SHALL come from configurable rules. Creation SHALL freeze the configuration and the same snapshot SHALL be used by Baseline and Candidate.

#### Scenario: Create a three-repeat experiment
- **WHEN** a user creates an experiment without overriding the configured repeat rule
- **THEN** the snapshot records three runs per Case for each arm and preserves the selected dataset versions and runtime conditions

#### Scenario: Review a previously created experiment
- **WHEN** later rule or dataset values change
- **THEN** the experiment detail and report still display the original frozen configuration

### Requirement: Required single-variant and window datasets
A single-variant experiment SHALL support the source attribution set, same-class generalization set, adjacent and unrelated regression set. A window combination experiment SHALL support the Window online-data population and generalization set. Dataset sample count, version, source range, and time range SHALL be visible.

#### Scenario: Inspect single-variant test coverage
- **WHEN** a user opens a single-variant experiment
- **THEN** the detail identifies attribution, generalization, and regression dataset versions and reconciles each displayed sample count

### Requirement: Experiment runs and comparative results
The platform SHALL retain Experiment Runs for each Case, repetition, and Baseline/Candidate arm under one configuration hash. Results SHALL distinguish local target-module metrics, other-module/regression effects, end-to-end Case outcome, and generalization metrics and SHALL show means and variability. Failed Cases, rollback items, and known risks SHALL be separately inspectable and Case IDs SHALL be operable links.

#### Scenario: Compare Baseline and Candidate
- **WHEN** an experiment completes
- **THEN** the report shows paired Baseline/Candidate means and variability for local, end-to-end, and generalization categories plus any failed Case, rollback item, and known risk

### Requirement: Single-pass prerequisite for Window experiments
A Variant SHALL enter a Window combination experiment only after its corresponding single-variant experiment has a PASS Gate Decision. The system SHALL reject or disable an invalid combination configuration.

#### Scenario: Candidate has not passed individually
- **WHEN** a user attempts to include a Variant without a passing single experiment
- **THEN** the platform prevents creation or execution and explains the missing prerequisite

### Requirement: Reproducible Gate report and pending thresholds
A Gate Decision SHALL be PASS, REJECT, or MANUAL_REVIEW and SHALL preserve decision reason, risk notes, actor, time, source Variant IDs, dataset versions, complete run/config snapshots, metric values, failed Cases, rollback items, known risks, and Evidence IDs. When metric thresholds are not configured, metric gate status SHALL remain pending and a PASS SHALL be explicitly identified as a human-review decision.

#### Scenario: Decide while metric gates are pending
- **WHEN** business thresholds are unconfigured and a reviewer approves an experiment
- **THEN** the report retains PENDING metric gates and records HUMAN_REVIEW as the decision basis with a reason

### Requirement: Release lifecycle separated from experiment decision
Release status SHALL be stored separately from Gate Decision and SHALL support PENDING, CANARY, RELEASED, OBSERVING, and ROLLED_BACK. Each release SHALL show its Window, exact Variant membership, combination report, Gate Decision, approver, release time, rollback target version, and rollback reason.

#### Scenario: Roll back an observing release
- **WHEN** a user changes an observing release to rolled back
- **THEN** the platform requires and retains a valid rollback Release ID and a rollback reason without changing the historical Gate Decision

### Requirement: Complete release reverse lineage
Any release SHALL be able to resolve and navigate to every included Variant, source Issue and Issue Cluster, original Case, combination experiment, source single reports, and Gate Decision. Release records with no included Variants SHALL NOT claim provenance from unrelated later experiments.

#### Scenario: Reverse an Office release to its source
- **WHEN** a user opens the management-PPT release
- **THEN** the user can navigate to the PPT routing Variant, source Skill Issue, evidence-bearing Case, single experiment, and combination experiment
