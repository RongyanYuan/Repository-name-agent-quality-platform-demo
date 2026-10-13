## Purpose

在现有数据集与评测工作台中管理人工任务输入、独立生成执行和重新评测，让使用者逐条查看结果、失败原因与证据，并通过不可覆盖的批次快照反查原始样本和固定资产版本。

## ADDED Requirements

### Requirement: Manual Query inputs
The system SHALL allow adding task text and one of PPT / Word / Excel / 生图 to an unfrozen user-owned dataset, with an optional fixed asset version. It MUST preserve inputs on reload and distinguish them from existing Trace enrollment.

#### Scenario: Save a new Query
- **WHEN** a user fills the required task and product type and saves
- **THEN** a pending Query appears in that dataset and remains after reload

#### Scenario: Frozen inputs
- **WHEN** a dataset is frozen
- **THEN** adding Query or Trace is blocked while execution of existing inputs remains available

### Requirement: Dataset execution modes
The system SHALL provide generation plus evaluation and evaluation-only modes in dataset rows and details, for gate, golden and personal datasets. Generation MUST create a new execution graph from source inputs; evaluation-only MUST reuse existing execution and artifacts without overwriting historical assessments.

#### Scenario: Generate from existing Trace inputs
- **WHEN** a user runs generation and evaluation on an existing test set
- **THEN** new Session / Case / Trace / Artifact records are created and the original Trace is retained as source

#### Scenario: Evaluate existing outputs
- **WHEN** a user selects evaluation-only
- **THEN** existing outputs receive a new assessment batch, and manual reviews and earlier batches remain unchanged

#### Scenario: External statistics and missing outputs
- **WHEN** a dataset includes external population counts or inputs lack reusable outputs
- **THEN** statistics without concrete Query records are excluded from runnable inputs, and evaluation-only explains missing artifacts instead of inventing results

### Requirement: Immutable execution history
The system SHALL capture dataset version, member inputs, asset version, execution mode and evaluation standards per run. It MUST append a new batch for another run and keep execution outcomes separate from gate decisions and publication state.

#### Scenario: Repeat or modify dataset after a run
- **WHEN** the dataset gains inputs or another run starts
- **THEN** previous run inputs, scores, evidence and configuration remain inspectable as recorded

### Requirement: Per-record progress and results
The system SHALL show Query, product type, execution time, status, process and artifact final scores on a 0–2 scale, deliverable and Case / Trace navigation. It MUST preserve successful records when a batch partly fails and expose failure reasons.

#### Scenario: Completed run
- **WHEN** a local Mock run finishes
- **THEN** every successful record has numeric 0–2 final scores, module/dimension evidence, a downloadable Mock deliverable and a navigable execution

#### Scenario: Failure and interrupted execution
- **WHEN** a run fails partly or the browser reloads before completion
- **THEN** persisted progress and errors remain, completed outputs are retained, and unfinished work can be continued without duplicating completed records

### Requirement: Context and provider boundaries
The system SHALL retain the dataset and filter context when opening an execution and returning. It MUST clearly identify local Mock generation and evaluation and provide an adapter boundary for real services, without adding pages or claiming real online execution.

#### Scenario: Result detail and return
- **WHEN** a user opens a generated execution from a dataset batch and returns
- **THEN** the owning dataset, selected batch and original filters are restored

#### Scenario: Mock output
- **WHEN** the local provider supplies an artifact and scores
- **THEN** the UI and deliverable identify them as Mock and do not automatically grant gate approval
