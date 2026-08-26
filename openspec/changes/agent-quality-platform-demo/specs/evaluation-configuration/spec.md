## Purpose

让质量团队能够清楚配置和审阅结果评测、过程评测与性能指标的规则、证据要求和版本状态，并保证不同类型的质量信号在展示与后续 Benchmark 中保持可区分。

## ADDED Requirements

### Requirement: Evaluation configuration SHALL separate three evaluation families

The system SHALL provide distinct Result Eval、Process Eval and Performance Metric sections, and SHALL identify every configured item by its family rather than presenting a single combined score.

#### Scenario: Review result dimensions
- **WHEN** a user opens Result Eval
- **THEN** the system SHALL show result type consistency、intent consistency、constraint satisfaction、accuracy and result usability as separate configurable dimensions

#### Scenario: Review process dimensions
- **WHEN** a user opens Process Eval
- **THEN** the system SHALL show task understanding、execution path、Skill、Tool、Context、Memory、Loop、Retry and Recovery as separate dimensions

### Requirement: Each evaluation item SHALL expose executable configuration metadata

Each item SHALL display Eval Type (Rule, Script or LLM-as-Judge), Rubric Version, Enabled state and Pass Threshold; Process Eval items SHALL additionally expose Prompt, Evidence Requirement and Judge Version when applicable.

#### Scenario: Inspect an LLM judge
- **WHEN** a user opens an enabled LLM-as-Judge item
- **THEN** the detail view SHALL show its rubric version, threshold, prompt, evidence requirement and judge version

#### Scenario: Disable a rubric
- **WHEN** a user disables an evaluation item
- **THEN** the item SHALL visibly become disabled and SHALL be excluded from the active configuration summary while retaining its prior version and settings

### Requirement: Configuration changes SHALL be reviewable by version

The system SHALL allow users to view the current and previous configuration versions, compare changed thresholds or evidence requirements, and identify which version applies to a Benchmark run.

#### Scenario: Compare rubric versions
- **WHEN** a user selects two rubric versions
- **THEN** the system SHALL highlight changed dimensions, thresholds, prompts or evidence requirements and SHALL not overwrite either historical version

#### Scenario: Link a run to its rubric
- **WHEN** a user opens a Benchmark run's configuration reference
- **THEN** the system SHALL show the exact Rubric Version and the enabled items that were used for that run

### Requirement: Configuration validation SHALL prevent ambiguous active rules

The system SHALL identify missing thresholds, duplicate active dimension definitions or missing evidence requirements for a Process Eval item before an evaluation configuration can be marked active.

#### Scenario: Activate an incomplete configuration
- **WHEN** a user attempts to activate a configuration containing a Process Eval item without an Evidence Requirement
- **THEN** activation SHALL be blocked with an actionable validation message and the prior active configuration SHALL remain unchanged

### Requirement: Configuration navigation SHALL link metrics to their evidence contract

The system SHALL provide a path from each configured dimension to the corresponding metric/Task/Trace view and SHALL preserve the selected configuration version when the user navigates back.

#### Scenario: Drill from a process rule
- **WHEN** a user selects a process dimension's View Exceptions action
- **THEN** the system SHALL open the relevant failed Trace/Task view with that dimension preselected as a filter
