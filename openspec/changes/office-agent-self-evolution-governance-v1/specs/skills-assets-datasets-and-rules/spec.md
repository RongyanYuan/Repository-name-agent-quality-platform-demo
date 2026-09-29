## Purpose

定义 Skill、个人/公共资产、实验数据集和治理规则的可管理资产边界，并防止未建设能力或私有数据被误表达为已发布。

## ADDED Requirements

### Requirement: Skill inventory and evolution records
The platform SHALL list and detail Skill ID, name, type, version, private/public ownership, related Asset IDs, generation status, and operable Variant/evolution record IDs.

#### Scenario: Inspect a Skill evolution record
- **WHEN** a user opens a Skill with a released evolution Variant
- **THEN** the Skill detail shows the Variant as an operable link and preserves the Skill version and ownership

### Requirement: Private asset upload and controlled publication
A user SHALL be able to add a personal Asset to the local private library. The platform SHALL require sanitization PASSED, review APPROVED, and an explicit publish action before the Asset may become PUBLIC and PUBLISHED.

#### Scenario: Attempt to publish an unreviewed Asset
- **WHEN** a private Asset has not passed sanitization and review
- **THEN** publication is blocked, the Asset remains private, and the user receives a clear reason

### Requirement: Planned personal Skill generation
The platform SHALL expose a planning workflow for creating a personal Skill from an Asset or existing Skill, SHALL store it as PRIVATE with generation status PLANNED, and SHALL NOT claim that a generation service ran while the PRD capability is marked 「待建设」.

#### Scenario: Plan a personal Skill from an Asset
- **WHEN** a user selects a private Asset and saves a personal Skill plan
- **THEN** a private planned Skill record is created and both records retain their relationship without producing a generated version

### Requirement: Versioned experiment datasets
The platform SHALL manage attribution, generalization, regression, and Window online datasets with Dataset ID, type, version, local Case IDs, total sample count, local/external population reconciliation, source system, counting rule, sample scope, optional time range, and frozen/editing state.

#### Scenario: Inspect an externally supplemented dataset
- **WHEN** a Dataset contains local and unexpanded external Mock samples
- **THEN** the detail states both counts, their source, and a counting rule whose total reconciles to sample count

### Requirement: Dataset lifecycle operations
The platform SHALL allow users to create a Dataset version, select or remove eligible Case members while editable, define sample scope and source, and freeze the version before experiment use. A frozen version SHALL remain immutable and later edits SHALL create a new version.

#### Scenario: Freeze a Dataset version
- **WHEN** a user freezes a Dataset after selecting Cases and defining scope
- **THEN** the version becomes immutable and experiments can reference its stable version snapshot

### Requirement: Governance rule configuration
The platform SHALL list trigger thresholds, experiment repeat count, metric gates, and monitoring baselines with configured or pending status. Users SHALL be able to edit rules, and experiments created afterward SHALL consume applicable configured values while older snapshots remain unchanged.

#### Scenario: Configure repeat count
- **WHEN** a user changes the experiment repeat rule from three to five
- **THEN** newly created experiment snapshots default to five while existing experiment snapshots still show three

#### Scenario: View an undecided threshold
- **WHEN** a PRD threshold has not been supplied
- **THEN** the rule and dependent UI display 「待配置」 and do not infer a numeric default
