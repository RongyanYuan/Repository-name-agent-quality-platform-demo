---
name: office-web-competitor-research
description: Use when researching or benchmarking AI agents that turn Office attachments or short prompts into webpages, comparing Office and non-Office scenarios, output mental models, template/inspiration flows, first-draft quality, and iteration cost.
---

# Office Web Competitor Research

Produce an evidence-backed decision brief and reproducible test runs. The primary comparison is not feature count: it is how reliably a non-technical user reaches a useful, attractive, deliverable result.

## Start

1. Read `references/research-contract.md`; establish the decision, date, geography, products, account tiers and available access.
2. Read `references/scenario-matrix.md` and `references/benchmark-tasks.md`; select a balanced subset before execution. Keep source materials and acceptance criteria fixed across products.
3. Read `references/competitor-registry.md`; verify official entries and current capabilities. Separate product UI, model/API and infrastructure products. Never treat a model's capability as a shipped UI feature.
4. Create a run with `scripts/research.py init`; use synthetic or explicitly authorized attachments.

## Execute

- Use the available computer/browser tool for UI testing; follow its current documentation. Do not substitute an API for a UI benchmark without labeling it as a separate track.
- Read `references/browser-test-protocol.md`. Record entry friction, clarification, first draft, bounded revisions, acceptance and sharing/maintenance separately.
- For templates or inspiration, read `references/template-inspiration-protocol.md` and compare against the same task from a blank start.
- Preserve screenshots, prompt/answer text, phase-level timestamps and output artifacts. Record unsupported, blocked, failed, partial and not-tested as distinct statuses.
- Keep `clarification_turns` separate from `revision_turns`. A first draft after clarification is not a zero-intervention result.
- Separate an anonymous access track from a capability track using comparable authorized accounts. Blocked access belongs in the access funnel, not the capability denominator. Run two trials for shortlisted products; a single successful demo is not evidence of reliability. Keep mode, model, tier, locale, region and material version in every run.

## Judge and synthesize

Read `references/scoring-rubric.md`. Report objective metrics and anchored judgments separately; use output-specific criteria for web, PPT and image. Do not multiply subjective scores into a pseudo-precise capability number.

Validate with `scripts/research.py validate`, then build the evidence index with `scripts/research.py report`. Missing evidence means unverified, not zero capability. Do not rank products with incomparable or blocked samples.

Read `references/insight-to-brainstorm.md` for synthesis. Distinguish verified observation, official claim, user evidence and inference. User mental models require interviews or behavioral tests; product UI alone only supports hypotheses.

Deliver: a decision-first brief, coverage matrix, per-run evidence, first-draft vs final-quality comparison, intervention cost, failure patterns, counterevidence, and prioritized experiments. Keep source URLs and capture dates adjacent to claims.
