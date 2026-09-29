## Purpose

定义前端演示所需的完整治理实体图、不可丢失的关联快照、本地持久化和可替换外部服务边界，支撑端到端双向溯源。

## ADDED Requirements

### Requirement: Complete governance entity graph
The local data model SHALL represent Session, Case, Trace, Observation/Log, Artifact, Process Eval, Outcome Eval, Attribution, Issue, Issue Cluster, Skill, Asset, Variant, Dataset, Experiment, Experiment Run, Window, Gate Decision, Release Version, Rule, and Audit Event with stable IDs and declared forward references.

#### Scenario: Validate a seed snapshot
- **WHEN** the application loads the bundled governance Mock seed
- **THEN** every declared reference resolves to an entity of the correct type and every reverse-lineage selector returns only connected entities

### Requirement: Relationship invariants
The system SHALL enforce that a Session has ordered turns linked to Traces in that Session and Case; a Case may have multiple Traces, attributions, and Issues; a Cluster may contain multiple related Cases and Issues; a Variant retains source Cases, Issues, Clusters, and Evidence; an Experiment uses valid Variant and Dataset versions; a Window combination includes only individually passed Variants; and a Release references a valid combination experiment and its matching Gate Decision.

#### Scenario: Reject a mismatched Gate Decision
- **WHEN** a Release points to a Gate Decision for a different Experiment
- **THEN** structural validation reports the exact invalid reference path and persistence does not accept the snapshot as healthy

### Requirement: Local persistence and audit
All supported human changes SHALL persist in versioned browser storage with an Audit Event containing actor, action, entity ID, reason, time, and changed fields where applicable. A fresh provider mount SHALL load the last valid state, while reset SHALL restore a fresh Mock seed and append a reset audit event.

#### Scenario: Remount after governance edits
- **WHEN** the user creates an Issue, revises an Eval, and unmounts then remounts the application
- **THEN** the new provider instance restores both changes and their audit/revision history

### Requirement: Corruption and schema recovery
The repository SHALL validate stored schema version and entity relationships before use. An incompatible or invalid snapshot SHALL be replaced with a current Mock seed and SHALL receive an explicit recovery audit event.

#### Scenario: Load corrupted local data
- **WHEN** persisted JSON is malformed or contains a broken required reference
- **THEN** the repository recovers to a valid seed and records why recovery occurred

### Requirement: Service adapter boundary
Data access SHALL be exposed through replaceable contracts for Trace/Langfuse retrieval, Eval execution, experiment running, Asset/Skill generation planning where applicable, and release publishing. Mock implementations SHALL be clearly distinguished from real providers.

#### Scenario: Use the local demo without backend services
- **WHEN** no external providers are configured
- **THEN** the application remains fully demonstrable through local Mock adapters and never labels generated results as real production data

### Requirement: Required connected Mock journeys
The seed SHALL include (1) a management-PPT journey with Skill recall process failure and style-mismatch outcome failure that proceeds through Cluster, Variant, single experiment, Window combination, Gate Decision, and Release; (2) a deterministic Tool/Skill direct-fix Case with later validation; and (3) a multi-attribution, multi-routing Case.

#### Scenario: Traverse the management-PPT journey
- **WHEN** a reviewer starts from the management-PPT Case
- **THEN** every forward and reverse object in its Issue-to-Release chain resolves and presents matching Evidence and IDs

### Requirement: Legacy route compatibility
Legacy Task, Trace, performance, anomaly-monitoring, Benchmark, and evaluation-configuration URLs SHALL redirect to their new owning governance pages while retaining compatible filter and object context.

#### Scenario: Open a legacy Benchmark Case link
- **WHEN** a user visits a legacy Benchmark Case comparison URL
- **THEN** the application redirects to experiment context with experiment, Case, comparison, and supported filter parameters preserved
