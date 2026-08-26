## Purpose

让质量人员能够把自动评测和用户反馈转化为可追踪、可复核、可复用的 Case 治理资产，并把确认后的 Badcase 稳定地沉淀为带版本的 Golden Dataset。

## ADDED Requirements

### Requirement: Case workbench SHALL expose governance states and filters

The system SHALL provide All Cases、Badcase Candidate、Confirmed Badcase and Resolved views, and SHALL allow filtering by query、Task status、failure dimension、first failure node、root cause、severity、owner、Agent Version and Case Source.

#### Scenario: Filter confirmed memory badcases
- **WHEN** a user selects the Confirmed Badcase view and applies `Root Cause = Memory`
- **THEN** the list SHALL show only confirmed cases whose first root cause is Memory, and the active filters SHALL remain visible

#### Scenario: Case source is visible
- **WHEN** a case is shown in any list view
- **THEN** the row SHALL identify whether it came from Auto Eval、User Feedback、System Error or Manual Review

### Requirement: Human review SHALL override automatic labels with an auditable state

The system SHALL allow a reviewer to change Pass/Fail, Failure Dimension, First Failure Node, Root Cause, Derived Failure, Severity (P0-P3), Owner and Note, while showing the corresponding Auto Eval values beside the human values.

#### Scenario: Reviewer overrides a disagreement
- **WHEN** the human label differs from the automatic Eval result and the reviewer saves a new label
- **THEN** the case SHALL show an explicit Eval Disagreement state, the human label SHALL become the effective label, and the automatic label SHALL remain visible for comparison

#### Scenario: Reviewer edits an incomplete case
- **WHEN** the reviewer saves a case without selecting a first failure node or root cause
- **THEN** the system SHALL reject the save and identify the missing required fields without losing other unsaved form values

### Requirement: Reviewers SHALL be able to confirm and resolve Badcases

The system SHALL support marking a case as Confirmed Badcase or Resolved, and SHALL display severity, owner, note and the latest review state in both the detail view and list row.

#### Scenario: Confirm a candidate
- **WHEN** a reviewer selects Confirmed Badcase and assigns severity and owner
- **THEN** the case SHALL move to the Confirmed Badcase view and remain linked to its source Task and Trace

#### Scenario: Resolve a badcase
- **WHEN** a reviewer marks a confirmed case Resolved and records a note
- **THEN** the case SHALL appear in the Resolved view with the resolution note and its prior root-cause history intact

### Requirement: Golden Dataset SHALL define explicit expected behavior

The system SHALL allow users to create and edit datasets containing Golden Case、Historical Badcase or Challenge Case entries, and each enabled entry SHALL expose Query、Outcome Type、Complexity、Capability Tags、Expected Result、Constraints、optional Expected Process、Golden Label、Root Cause、Source Trace and Dataset Version.

#### Scenario: Add a confirmed Badcase to a dataset
- **WHEN** a user chooses Add to Dataset from a Case detail view and selects a dataset
- **THEN** the system SHALL create a dataset entry carrying the source Trace, effective human label, expected outcome fields and current dataset version

#### Scenario: Create an explicit Golden Case
- **WHEN** a user creates a Golden Case without an Expected Outcome, Expected Constraint or Golden Label
- **THEN** the system SHALL block enablement and indicate which expected fields are missing

### Requirement: Dataset management SHALL support versioning, bulk actions and history

The system SHALL support creating datasets, selecting multiple cases, editing capability tags, setting a Dataset Version, enabling or disabling entries, and viewing entry history without deleting the source Case or Trace.

#### Scenario: Disable a case before a benchmark
- **WHEN** a user disables a dataset entry
- **THEN** the entry SHALL remain visible in history but SHALL be excluded from newly launched Benchmarks

#### Scenario: Inspect a dataset entry history
- **WHEN** a user opens the history of a dataset entry
- **THEN** the system SHALL show prior labels, expected fields, source Trace and version transitions in chronological order

### Requirement: Governance navigation SHALL preserve the originating context

The system SHALL preserve active filters and the originating Case, Task or Trace context when a user navigates between Case lists, Case detail, Dataset detail and the previous page through Breadcrumb or Back controls.

#### Scenario: Return from dataset to a filtered case list
- **WHEN** a user opens a dataset entry from a filtered Confirmed Badcase list and activates Back
- **THEN** the system SHALL return to that list with the same filters and selected page position when possible
