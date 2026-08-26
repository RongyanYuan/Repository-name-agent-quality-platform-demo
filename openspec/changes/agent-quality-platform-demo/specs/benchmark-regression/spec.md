## Purpose

让用户能够用可复现的 Golden Dataset 比较两个 Agent 版本，在结果、过程和性能三个维度识别改进与回归，并从聚合结果回到具体 Case、Task、Trace 和 A/B 证据。

## ADDED Requirements

### Requirement: Users SHALL be able to configure and launch a Benchmark

The system SHALL provide a Benchmark creation flow requiring a Dataset、Agent Version A、Agent Version B、Environment and Eval Rubric Version before Run Benchmark is enabled.

#### Scenario: Launch a valid comparison
- **WHEN** a user selects an enabled dataset, two agent versions, an environment and a rubric version
- **THEN** Run Benchmark SHALL be enabled and launching it SHALL create a visible run with dataset, versions, environment, rubric and run status

#### Scenario: Prevent an incomplete run
- **WHEN** one required selection is missing
- **THEN** the system SHALL keep Run Benchmark disabled and identify the missing selection without creating a run

### Requirement: Benchmark results SHALL separate quality and performance dimensions

The results view SHALL show Version A, Version B and Delta for effective task completion, intent consistency, context efficiency, memory efficiency and P95 latency, and SHALL not collapse result, process and performance metrics into one undifferentiated total score.

#### Scenario: Display a completed run
- **WHEN** a Benchmark run completes
- **THEN** the results table SHALL show both version values, a signed delta with an appropriate unit (percentage points, percentage change or duration), and the source dataset/run metadata

#### Scenario: Open a metric breakdown
- **WHEN** a user selects a metric row
- **THEN** the system SHALL expose the contributing Case count and links to the relevant failed or changed Cases

### Requirement: Benchmark SHALL classify changed Cases for regression analysis

The system SHALL classify comparable Cases into Improved Cases、Regressed Cases、Unchanged Failed Cases and Newly Failed Cases, and SHALL expose counts for each category.

#### Scenario: Open regressed Cases
- **WHEN** a user selects Regressed Cases
- **THEN** the system SHALL show only Cases whose effective result changed from pass in Version A to fail in Version B, with links to both traces when available

#### Scenario: Open newly failed Cases
- **WHEN** a user selects Newly Failed Cases
- **THEN** the system SHALL show Cases that were not successful in Version A and failed in Version B, and SHALL preserve the classification rationale

### Requirement: Users SHALL be able to compare aligned A/B Traces

The Case comparison view SHALL present Version A and Version B Trace columns aligned by Task Understanding、Planning、Context、Memory、Skill、Tool and Final Outcome stages, and SHALL highlight added or removed nodes, Pass-to-Fail, Fail-to-Pass, latency changes and Model/Tool call changes.

#### Scenario: Inspect a regression Trace
- **WHEN** a user opens a Regressed Case from a Benchmark result
- **THEN** the system SHALL show both traces, the changed stage(s), each stage's status and latency, and a link to the underlying observation evidence

#### Scenario: One version lacks a stage
- **WHEN** a stage exists in only one version's trace
- **THEN** the comparison SHALL render an explicit Added or Removed marker rather than silently aligning unrelated nodes

### Requirement: Benchmark history SHALL be reviewable and reusable

The system SHALL list at least the available Benchmark runs with status, dataset version, compared versions, environment, rubric version, created time and summary deltas, and SHALL allow opening a prior completed run without rerunning it.

#### Scenario: Reopen a historical run
- **WHEN** a user selects a completed historical Benchmark
- **THEN** the system SHALL restore its result table, case classifications and links without changing the run's recorded inputs

### Requirement: Benchmark navigation SHALL retain filters and trace context

The system SHALL preserve selected dataset, version and Case category filters when navigating from Benchmark results to Case, Task/Trace and back through Breadcrumb or Back controls.

#### Scenario: Return from an A/B Trace
- **WHEN** a user returns from an A/B Trace comparison
- **THEN** the system SHALL return to the same Benchmark run and Case category with its prior filters intact
