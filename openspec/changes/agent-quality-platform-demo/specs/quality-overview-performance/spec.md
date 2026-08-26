## Purpose

Provide a decision-oriented view of Agent quality and runtime behavior, with every meaningful aggregate traceable to the underlying tasks, traces, cases, or observations that explain it.

## ADDED Requirements

### Requirement: Quality overview SHALL separate outcome, process, and performance signals
The quality overview SHALL present result-evaluation KPIs, process-evaluation metrics, and performance metrics as visibly distinct sections. It MUST NOT collapse these categories into one combined score that hides whether a problem is an outcome failure, a process failure, or a runtime condition.

#### Scenario: Overview loads with distinct metric categories
- **WHEN** a user opens Quality Overview for a selected time range, Agent Version, business type, and environment
- **THEN** the page shows separately labeled outcome KPI, process metric, and performance areas, each using the currently selected scope

#### Scenario: Category values remain independently interpretable
- **WHEN** an outcome KPI, process metric, and latency metric are all displayed for the same scope
- **THEN** each value retains its own label, unit, and pass/fail or warning meaning without being replaced by a single aggregate score

### Requirement: Quality overview SHALL expose outcome KPI values and counts
The system SHALL display effective task completion rate, outcome type consistency rate, intent consistency rate, constraint satisfaction rate, accuracy rate, result usability rate, and effective-but-inefficient task rate. Every KPI card MUST show the current value, change from the previous comparable period, a compact trend, and pass/fail case counts for the active scope.

#### Scenario: KPI cards show the complete outcome set
- **WHEN** the Quality Overview receives task and evaluation data for the active scope
- **THEN** all seven named KPIs are visible and each card includes a current value, period-over-period change, trend indication, and pass/fail counts

#### Scenario: KPI cards reflect a changed scope
- **WHEN** the user changes a global filter such as business type or Agent Version
- **THEN** the KPI values, trends, and pass/fail counts refresh to represent only the newly selected scope

### Requirement: Outcome KPI and process metric drill-down SHALL identify failing work
The system SHALL let a user activate any outcome KPI card and navigate to Task / Trace with that metric's failed tasks already filtered. The system SHALL let a user activate a process metric or its anomaly data and navigate to the corresponding abnormal traces or tasks with the relevant process condition applied.

#### Scenario: User drills from an outcome KPI
- **WHEN** the user activates the Intent Consistency KPI card
- **THEN** the system opens Task / Trace, preserves the active global scope, and applies an Intent Consistency = FAIL filter so only matching failed tasks are shown by default

#### Scenario: User drills from a process metric
- **WHEN** the user activates an abnormal Memory Use or Tool Selection process metric point
- **THEN** the system opens the relevant Task / Trace or abnormal-trace view with that process metric and failure state applied as filters

### Requirement: Process evaluation metrics SHALL support comparison and anomaly inspection
The process section SHALL expose task understanding, execution path, skill or capability selection, tool selection, context assembly, memory use, unnecessary tool-call rate, unnecessary model-call rate, redundant-loop rate, retry effectiveness, and recovery success. It MUST provide bar and trend presentations, and MUST allow filtering by business type, Agent Version, and task complexity before a user drills into an anomaly.

#### Scenario: User switches process visualization
- **WHEN** the user changes the process section from bar presentation to trend presentation
- **THEN** the same selected process metrics are shown over the active scope in the requested presentation without changing their definitions

#### Scenario: User narrows process metrics by complexity
- **WHEN** the user selects a task complexity and an Agent Version in the process section
- **THEN** the displayed process values and anomaly points update to that business, version, and complexity scope

### Requirement: Root cause distribution SHALL count only first failures and remain drillable
The system SHALL show a horizontal root-cause distribution for Task Understanding, Planning / Decision, Context, Memory, Skill Routing, Tool, Loop / Retry, Skill Internal, and External Engineering. Root-cause totals MUST count only the first key failure node per task or trace and MUST exclude derived failures from duplicate root-cause counts. Selecting a root cause SHALL open Case / Badcase with that root-cause filter applied.

#### Scenario: Derived failures do not inflate root-cause totals
- **WHEN** a trace has a Memory failure followed by a Context failure marked as derived
- **THEN** the distribution counts the trace under Memory only and does not add a second root-cause count for Context

#### Scenario: User drills from a root-cause bar
- **WHEN** the user selects the Tool root-cause bar
- **THEN** the system opens Case / Badcase and shows cases whose first key failure root cause is Tool, while retaining the active global scope

### Requirement: Task performance monitoring SHALL expose latency, cost, and execution volume
The performance view SHALL display Task Latency P50, P90, and P95; latency distributions for simple, medium, and complex tasks; total task cost; token usage; model-call count; tool-call count; loop count; and retry count. Complexity MUST be shown alongside observed latency based on the evaluation-provided complexity classification, without requiring a fixed hard threshold to classify tasks.

#### Scenario: Task performance reflects the active scope
- **WHEN** the user selects a time range, environment, and Agent Version in Performance Monitoring
- **THEN** all task latency percentiles, complexity distributions, cost, token, model-call, tool-call, loop, and retry values refresh for that scope

#### Scenario: Complexity and latency remain separately visible
- **WHEN** simple, medium, and complex tasks have different observed latencies
- **THEN** the view shows each complexity distribution and its observed latency information without converting complexity into an undocumented threshold or a single blended latency value

### Requirement: Tool performance monitoring SHALL surface baseline deviations and trace evidence
For every displayed tool, the system SHALL show call count, successful calls, failed calls, failure rate, P50 latency, P95 latency, 7-day and 14-day rolling baselines, and current-window deviation from those baselines. When the current P95 is flagged as materially above its historical rolling baseline, the tool view MUST show a warning. Activating an anomalous data point MUST open a detail panel containing the anomalous-trace count for the window, top tool errors, the highest-latency task, and an action to view all anomalous traces.

#### Scenario: Tool warning appears for a baseline breach
- **WHEN** a tool's current-window P95 latency is materially above its 7-day or 14-day rolling baseline
- **THEN** the tool is visibly marked with a warning and the current value and comparison baseline are both available for inspection

#### Scenario: User opens an anomalous tool point
- **WHEN** the user activates the warned tool's anomalous data point
- **THEN** a detail panel shows the window's anomalous-trace count, top tool errors, and highest-latency task, and provides a control to view all anomalous traces

#### Scenario: User views all anomalous traces
- **WHEN** the user activates View All Anomalous Traces in the tool detail panel
- **THEN** the system opens Task / Trace with the tool, time window, and anomaly condition applied, while retaining the global scope

### Requirement: Model performance monitoring SHALL expose model cost and reliability signals
The model section SHALL display model-call count, token usage, latency, failure and timeout counts, model version, and unnecessary model-call rate. Values MUST be filterable by the active time range, Agent Version, business type, and environment.

#### Scenario: Model version comparison is visible
- **WHEN** more than one model version contributes calls in the active scope
- **THEN** the model section shows each model version with its calls, tokens, latency, failures or timeouts, and unnecessary-call rate separately

#### Scenario: Model performance follows global filters
- **WHEN** the user changes the business type or environment filter
- **THEN** model performance values refresh and no value from the previous scope remains presented as current

### Requirement: Global filters and navigation context SHALL be shared across quality views
The system SHALL provide global controls for time range, Agent Version, business type (All, PPT, Excel, Word, Coding, or General), environment (Production or Staging), and search across task_id, query, and trace_id. It SHALL display the data-updated timestamp. Changing any global filter or search term MUST refresh all visible quality and performance data, and downstream pages MUST inherit the resulting scope.

#### Scenario: Search narrows data across views
- **WHEN** the user enters a task_id, query fragment, or trace_id in global search
- **THEN** the currently visible metrics and lists refresh to the matching records, and a drill-down from those records continues to use the same search scope

#### Scenario: Global filter changes refresh the dashboard
- **WHEN** the user switches from Production to Staging or selects a different time range
- **THEN** all visible KPI, process, root-cause, task-performance, tool-performance, and model-performance values refresh together and the updated timestamp remains visible

### Requirement: Back and breadcrumb navigation SHALL preserve filter state
The system SHALL retain the user's global filters and relevant local filters when navigating from an aggregate, anomaly, root cause, or task into Task / Trace or Case / Badcase. Using Back or a breadcrumb to return MUST restore the prior filtered view rather than resetting to defaults.

#### Scenario: Return from KPI drill-down
- **WHEN** the user drills from a KPI into a failed Task / Trace list and then uses Back
- **THEN** the Quality Overview reopens with the same global filters and the same prior view context

#### Scenario: Return from a case or trace detail
- **WHEN** the user has applied local status, root-cause, or complexity filters, opens a case or trace detail, and then uses a breadcrumb to return
- **THEN** the originating list restores those local filters together with the global scope
