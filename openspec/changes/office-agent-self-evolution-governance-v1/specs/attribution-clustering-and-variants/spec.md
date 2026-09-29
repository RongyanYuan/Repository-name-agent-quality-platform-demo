## Purpose

定义多问题归因、多路处理、直接修复或问题聚类，以及将可审计问题与证据转化为能力变体的治理契约。

## ADDED Requirements

### Requirement: Multiple independent issues per Case
The platform SHALL allow one Case to produce multiple independent Issues. Each Issue SHALL store its source attribution, module, attribution dimension, routing labels, optimization mode, Evidence IDs, description, owner, responsibility status, lifecycle status, and independent processing chains.

#### Scenario: Create two issues from one Case
- **WHEN** a Case contains a Memory failure and a Reason planning failure
- **THEN** a user can create and maintain two separately addressable Issues with different Evidence, owners, optimization modes, and destinations

### Requirement: Required attribution taxonomy
The module and dimension controls SHALL cover Memory production error, management error, low recall, and low accuracy; Skill capability absence, unusable file, SOP error, name/description error, taste-library recall error, asset quality, and asset shortage; Reason unmet request, insufficient use of prior context, wrong or inefficient choice, and wrong Tool parameters; Act Tool execution failure and retry/timeout stability-rule violation. The prior-context module SHALL remain explicitly 「需求待补充」 until specified.

#### Scenario: Choose an Act stability attribution
- **WHEN** a user attributes a failure to a retry or timeout rule violation
- **THEN** the Issue stores module Act and the matching stability dimension rather than a generic free-text category

### Requirement: Non-exclusive routing and phase-two destination
Routing labels SHALL be non-exclusive and SHALL include 策略迭代 and Agent 迭代. 个人能力转 Skill SHALL be represented as a visible phase-two processing chain, not as an implemented generation service.

#### Scenario: Route one Issue to two chains
- **WHEN** a user selects both 策略迭代 and Agent 迭代
- **THEN** the Issue displays two independent destinations and statuses without forcing one label to replace the other

### Requirement: Direct and cluster optimization
The platform SHALL distinguish deterministic direct fixes from cluster optimization. A direct fix SHALL remain connected to subsequent Variant and validation evidence, while cluster optimization SHALL allow multiple related Case/Issue members and explicit membership updates.

#### Scenario: Directly fix a deterministic Tool error
- **WHEN** a confirmed Case exposes a deterministic unsupported Tool parameter
- **THEN** the user can create a direct-fix Issue and trace its resulting Variant and single-variant validation back to that one Case

### Requirement: Taste-library threshold and pending thresholds
A taste-library Issue Cluster SHALL expose the relevant Skill-scoped confirmed-data count, counting rule, and threshold of 100, and SHALL prevent Variant creation before that threshold is met. Other unspecified thresholds SHALL display 「待配置」 and SHALL NOT be silently defaulted to 100.

#### Scenario: Taste cluster is below threshold
- **WHEN** a taste-library cluster has 37 of 100 qualifying records
- **THEN** the platform shows 37/100 with its counting rule and disables creation of a taste-library Variant

#### Scenario: Other cluster has no threshold
- **WHEN** a non-taste cluster has no configured trigger rule
- **THEN** the platform shows 「待配置」 rather than using 100 as an implicit denominator

### Requirement: Immutable Variant provenance
Each Variant SHALL show its ID, target module, change type, change summary and content, current and candidate versions, source Case/Issue/Cluster IDs, Evidence IDs, creation time, status, and associated Experiment IDs. Changes to lifecycle status SHALL NOT erase its version or provenance snapshot.

#### Scenario: Inspect a released Variant
- **WHEN** a user opens a released Variant
- **THEN** all original source Issues, Cases, Evidence, versions, creation time, and Experiment links remain visible and operable

### Requirement: Variant creation from an eligible cluster
The platform SHALL allow a user to create a Variant from an eligible Issue Cluster and SHALL update the Variant, source Issues, and source Cluster relationships atomically in local state.

#### Scenario: Create a Variant from a ready cluster
- **WHEN** a user supplies the change type, content, current version, and candidate version for an eligible cluster
- **THEN** the platform creates the Variant with copied source Evidence and exposes it from both the cluster and Variant workspaces
