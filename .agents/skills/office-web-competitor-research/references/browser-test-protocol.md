# Browser and desktop protocol

1. Inspect current access without changing user projects. Record product, mode, login/plan, version if shown. Use a fresh research conversation/project.
2. Use approved synthetic inputs. User authorization to research does not authorize uploading private files, making purchases or publishing sensitive content. Handle login, CAPTCHAs, permissions and publication according to current tool policy.
3. Record prompt and start time. Capture entry, questions, first-draft checkpoint, revisions, final artifact and any failure. Store screenshots with numbered filenames and write their meaning into events.jsonl; record turn-level details in turns.jsonl and phase timings in timing.json.
4. Respond from the task answer bank only to questions asked. Record assumptions. Do not silently add product-specific prompt engineering.
5. Inspect output: visible content plus actual interactions. Code in a chat is not an executed webpage. Open preview if available; click declared filters/buttons; inspect desktop and mobile where supported. A partial code panel is `partial`, not a completed deliverable.
6. Apply bounded revision policy. Stop on acceptance, budget, persistent failure or access block. Record stop reason; do not loop indefinitely or conceal failures with manual fixes.
7. Download/export when available and authorized. Public publication is a separate action; a saved preview can finish a generation test. Preserve no credentials in evidence.
8. Validate evidence files, statuses and metrics. A screenshot or summary from another product cannot support this run.

Serial UI execution prevents focus/session collision. Parallel agents may research docs, judge saved artifacts and synthesize evidence, but do not manipulate the same app/session concurrently.

Status vocabulary: planned, running, completed, failed, blocked, unsupported, not_tested. Completed means the test protocol finished, not that the product passed.
