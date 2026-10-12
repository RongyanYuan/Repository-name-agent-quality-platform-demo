#!/usr/bin/env python3
"""Small deterministic helpers for reproducible competitor research runs."""
from __future__ import annotations

import argparse
import json
import re
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

REQUIRED_DIRS = ("screenshots", "artifacts", "notes", "scores")
VALID_STATUS = {"planned", "running", "partial", "completed", "failed", "blocked", "unsupported", "not_tested"}
VALID_EVIDENCE = {"OBSERVED", "OFFICIAL_CLAIM", "USER_EVIDENCE", "INFERENCE", "UNKNOWN"}


def now() -> datetime:
    return datetime.now(timezone.utc)


def safe_name(value: str) -> str:
    value = re.sub(r"[^a-zA-Z0-9._-]+", "-", value.strip().lower()).strip("-")
    return value or "run"


def write_json(path: Path, value: Any) -> None:
    path.write_text(json.dumps(value, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def init_run(args: argparse.Namespace) -> int:
    stamp = now().strftime("%Y%m%dT%H%M%SZ")
    run_dir = Path(args.root) / f"{stamp}-{safe_name(args.name)}"
    for child in REQUIRED_DIRS:
        (run_dir / child).mkdir(parents=True, exist_ok=False)
    (run_dir / "events.jsonl").write_text("", encoding="utf-8")
    (run_dir / "turns.jsonl").write_text("", encoding="utf-8")
    (run_dir / "timing.json").write_text("[]\n", encoding="utf-8")
    write_json(run_dir / "run.json", {
        "run_id": run_dir.name,
        "created_at": now().isoformat(),
        "name": args.name,
        "decision": args.decision,
        "products": [p for p in args.products.split(",") if p.strip()],
        "tasks": [t for t in args.tasks.split(",") if t.strip()],
        "status": "planned",
        "controls": {
            "platform": args.platform,
            "locale": args.locale,
            "material_version": args.material_version,
            "synthetic_inputs": True,
        },
        "evidence_policy": "OBSERVED, OFFICIAL_CLAIM, USER_EVIDENCE, INFERENCE, UNKNOWN",
    })
    (run_dir / "notes" / "README.md").write_text(
        "# Run notes\n\nRecord evidence IDs, stop reasons and counterevidence here.\n",
        encoding="utf-8",
    )
    print(run_dir)
    return 0


def validate_run(args: argparse.Namespace) -> int:
    run_dir = Path(args.path)
    errors: list[str] = []
    run_file = run_dir / "run.json"
    if not run_file.exists():
        errors.append("missing run.json")
    else:
        try:
            run = json.loads(run_file.read_text(encoding="utf-8"))
        except json.JSONDecodeError as exc:
            errors.append(f"invalid run.json: {exc}")
        else:
            for key in ("run_id", "created_at", "products", "tasks", "status", "controls"):
                if key not in run:
                    errors.append(f"run.json missing {key}")
            if run.get("status") not in VALID_STATUS:
                errors.append(f"run.json invalid status: {run.get('status')}")
            if run.get("controls", {}).get("synthetic_inputs") is not True:
                errors.append("controls.synthetic_inputs must be true for the default run")
    for child in REQUIRED_DIRS:
        if not (run_dir / child).is_dir():
            errors.append(f"missing directory {child}/")
    events = run_dir / "events.jsonl"
    if not events.exists():
        errors.append("missing events.jsonl")
    else:
        for index, line in enumerate(events.read_text(encoding="utf-8").splitlines(), 1):
            try:
                event = json.loads(line)
            except json.JSONDecodeError as exc:
                errors.append(f"events.jsonl:{index}: {exc}")
                continue
            for key in ("event_id", "product", "task", "status", "evidence_type"):
                if key not in event:
                    errors.append(f"events.jsonl:{index}: missing {key}")
            if event.get("status") not in VALID_STATUS:
                errors.append(f"events.jsonl:{index}: invalid status {event.get('status')}")
            if event.get("evidence_type") not in VALID_EVIDENCE:
                errors.append(f"events.jsonl:{index}: invalid evidence_type {event.get('evidence_type')}")
    if not (run_dir / "turns.jsonl").exists():
        errors.append("missing turns.jsonl")
    if not (run_dir / "timing.json").exists():
        errors.append("missing timing.json")
    if errors:
        print("INVALID")
        for error in errors:
            print(f"- {error}")
        return 1
    print("VALID")
    return 0


def report(args: argparse.Namespace) -> int:
    root = Path(args.root)
    rows: list[dict[str, Any]] = []
    for run_file in sorted(root.glob("*/run.json")):
        try:
            run = json.loads(run_file.read_text(encoding="utf-8"))
        except json.JSONDecodeError:
            continue
        events_path = run_file.parent / "events.jsonl"
        events = []
        if events_path.exists():
            for line in events_path.read_text(encoding="utf-8").splitlines():
                if line.strip():
                    try:
                        events.append(json.loads(line))
                    except json.JSONDecodeError:
                        pass
        rows.append({"run": run, "events": events})
    lines = ["# Office 网页 Agent 研究运行索引", "", f"生成时间：{now().isoformat()}", ""]
    if not rows:
        lines.append("暂无已初始化的运行。")
    for item in rows:
        run = item["run"]
        events = item["events"]
        lines += [f"## {run.get('run_id', 'unknown')}", "", f"- 状态：{run.get('status', 'unknown')}", f"- 产品：{', '.join(run.get('products', [])) or '未填写'}", f"- 任务：{', '.join(run.get('tasks', [])) or '未填写'}", f"- 事件数：{len(events)}", ""]
        for event in events:
            lines.append(f"- `{event.get('event_id', '?')}` {event.get('product', '?')} / {event.get('task', '?')} / {event.get('status', '?')} / {event.get('evidence_type', '?')}")
        lines.append("")
    all_events = [event for item in rows for event in item["events"]]
    if any(event.get("status") in {"blocked", "not_tested"} for event in all_events):
        lines += ["## 排名门槛", "", "当前证据含 blocked 或 not_tested 运行；不得生成跨产品冠军/总排名。先补齐可比任务，或只报告分层观察。", ""]
    if any(event.get("evidence_type") != "OBSERVED" for event in all_events):
        lines += ["## 证据边界", "", "运行索引同时可能包含官方声明、推断或未知项；这些不能替代 OBSERVED 实测。", ""]
    output = Path(args.output) if args.output else root / "REPORT.md"
    output.write_text("\n".join(lines), encoding="utf-8")
    print(output)
    return 0


def add_event(args: argparse.Namespace) -> int:
    run_dir = Path(args.path)
    event = {
        "event_id": args.event_id,
        "product": args.product,
        "mode": args.mode,
        "task": args.task,
        "status": args.status,
        "evidence_type": args.evidence_type,
        "started_at": now().isoformat(),
        "notes": args.notes,
    }
    if args.screenshot_ref:
        event["screenshot_ref"] = args.screenshot_ref
    if args.artifact_ref:
        event["artifact_ref"] = args.artifact_ref
    if args.clarification_turns is not None:
        event["clarification_turns"] = args.clarification_turns
    if args.revision_turns is not None:
        event["revision_turns"] = args.revision_turns
    with (run_dir / "events.jsonl").open("a", encoding="utf-8") as handle:
        handle.write(json.dumps(event, ensure_ascii=False) + "\n")
    print(event["event_id"])
    return 0


def add_turn(args: argparse.Namespace) -> int:
    run_dir = Path(args.path)
    turn = {
        "turn_id": args.turn_id,
        "event_id": args.event_id,
        "turn_type": args.turn_type,
        "timestamp": now().isoformat(),
        "question_text": args.question_text,
        "user_response": args.user_response,
        "artifact_version": args.artifact_version,
        "high_value": args.high_value,
        "notes": args.notes,
    }
    with (run_dir / "turns.jsonl").open("a", encoding="utf-8") as handle:
        handle.write(json.dumps(turn, ensure_ascii=False) + "\n")
    print(turn["turn_id"])
    return 0


def parser() -> argparse.ArgumentParser:
    root = argparse.ArgumentParser(description=__doc__)
    sub = root.add_subparsers(dest="command", required=True)
    init = sub.add_parser("init", help="create a reproducible run directory")
    init.add_argument("--root", default="research/office-web")
    init.add_argument("--name", required=True)
    init.add_argument("--decision", default="")
    init.add_argument("--products", default="")
    init.add_argument("--tasks", default="")
    init.add_argument("--platform", default="unknown")
    init.add_argument("--locale", default="zh-CN")
    init.add_argument("--material-version", default="v1")
    init.set_defaults(func=init_run)
    validate = sub.add_parser("validate", help="validate a run's evidence structure")
    validate.add_argument("path")
    validate.set_defaults(func=validate_run)
    report_cmd = sub.add_parser("report", help="index runs and events")
    report_cmd.add_argument("--root", default="research/office-web")
    report_cmd.add_argument("--output")
    report_cmd.set_defaults(func=report)
    event = sub.add_parser("event", help="append one observed or blocked test event")
    event.add_argument("path")
    event.add_argument("--event-id", required=True)
    event.add_argument("--product", required=True)
    event.add_argument("--mode", default="unknown")
    event.add_argument("--task", required=True)
    event.add_argument("--status", choices=sorted(VALID_STATUS), required=True)
    event.add_argument("--evidence-type", choices=sorted(VALID_EVIDENCE), required=True)
    event.add_argument("--notes", default="")
    event.add_argument("--screenshot-ref")
    event.add_argument("--artifact-ref")
    event.add_argument("--clarification-turns", type=int)
    event.add_argument("--revision-turns", type=int)
    event.set_defaults(func=add_event)
    turn = sub.add_parser("turn", help="append an auditable clarification or revision turn")
    turn.add_argument("path")
    turn.add_argument("--turn-id", required=True)
    turn.add_argument("--event-id", required=True)
    turn.add_argument("--turn-type", choices=["clarification", "answer", "first_draft", "postdraft_clarification", "revision_request", "revision_result", "autonomous_update"], required=True)
    turn.add_argument("--question-text", default="")
    turn.add_argument("--user-response", default="")
    turn.add_argument("--artifact-version", default="")
    turn.add_argument("--high-value", action="store_true")
    turn.add_argument("--notes", default="")
    turn.set_defaults(func=add_turn)
    return root


if __name__ == "__main__":
    parsed = parser().parse_args()
    raise SystemExit(parsed.func(parsed))
