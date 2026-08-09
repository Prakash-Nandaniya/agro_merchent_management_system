# Karma Trading agent — v2

## What changed from v1

| Ask | Where |
|---|---|
| Smart routing: greeting / off-topic / business first | `agent/router.py` — `classify_intent_node`, runs before anything else |
| More analytics (trend, forecast, correlation, outliers, ROI, CAGR, moving average...) | `agent/math_ops.py` — 22 operations now, up from ~6 |
| Retry on failure, loop back with feedback | Two loops: SQL (`nodes.py` + `graph.py`), custom codegen (`codegen.py` + `graph.py`) |
| Web search → read sources → extract → feed to LLM | `agent/websearch.py` — `web_search_node` |
| Firm/business report requests | `is_report` flag from the router, honored in `final_analysis_node`'s prompt |
| LLM writes a Python function for math the catalog doesn't cover, runs it on real data | `agent/codegen.py` — sandboxed, see security section below |

## Graph shape

```
START -> classify_intent --+-> greeting_response -----------------> END
                            +-> off_topic_response ----------------> END
                            +-> web_search -> generate_sql <--------+
                                                    |                 |
                                                    v                 | retry (max 2)
                                               execute_sql -----------+
                                                    |
                                                    v
                                               plan_math -> execute_math --+-> final_analysis -> END
                                                                            +-> custom_codegen <-+
                                                                                  |   retry (max 2) |
                                                                                  +------------------+
```

`web_search` and `generate_sql` both run unconditionally but no-op internally
when `needs_web_search` / `needs_db` are false (set by the router) — e.g. a
business question that's pure web lookup (today's rainfall) skips SQL, and a
DB-only question skips the search+fetch+summarize round trip entirely.

## 1. Intent routing

`classify_intent_node` runs first, always. A regex catches bare greetings
("hi", "hello", "how are you") without spending an LLM call. Everything else
gets one classification call that returns:

```json
{"intent": "greeting|off_topic|business", "needs_web_search": bool, "needs_db": bool, "is_report": bool}
```

- `greeting` → short canned-style reply, `END`.
- `off_topic` → polite redirect to business topics, `END`.
- `business` → enters the real pipeline. This bucket deliberately includes
  crop/farming/production/rainfall/crop-safety/government-policy questions,
  not just direct trade/invoice lookups — see the prompt in `router.py` if
  you want to tighten or loosen that boundary.

## 2. Retry loops

Both loops follow the same shape: a node sets an `*_error` field and bumps a
`*_retry_count`; a small `route_after_*` function checks the state and either
sends execution back to the generating node (with the error folded into the
next prompt as feedback) or lets it fall through once the retry budget
(`MAX_SQL_RETRIES` / hardcoded `2` for codegen, both in `state.py`/`codegen.py`)
is spent. On exhaustion, the pipeline continues anyway — `final_analysis_node`
is told about the error and answers with whatever data it does have rather
than dead-ending the user.

## 3. Web search

`web_search_node` only runs its body when `needs_web_search` is true (router
decides this — e.g. "what's the rain forecast this week" or "any new
government policy on wheat MSP"). It searches (SerpAPI by default, same as
your original code — set `WEB_SEARCH_API_KEY`), fetches each result page,
strips it to plain text with a regex (swap in BeautifulSoup if you already
depend on it for cleaner extraction), and makes one LLM call to compress
everything into a short sourced briefing stored in `state["web_context"]`.
`final_analysis_node` folds that into its context alongside the DB data.

## 4. Report mode

`is_report=True` doesn't change the pipeline shape — it changes two prompts:
`generate_sql_node` is told to write a broad summary query when no specific
filters were given, and `final_analysis_node` is told to structure the answer
with short markdown section headers instead of a flat paragraph. Try: *"give
me a report on this month's trades"* or *"how's the firm doing overall"*.

## 5. LLM-generated custom math — how the sandbox works

When `plan_math_node` can't express something with the standard catalog
(`agent/math_ops.py`), it emits `{"op": "custom", "description": "..."}`.
`execute_math_node` routes those aside into `pending_custom_ops`, and
`custom_codegen_node` (in `codegen.py`) handles them:

1. LLM asked to write **one** function: `def custom_op(data): ...`.
2. Code is parsed with `ast.parse` and walked node-by-node against an
   **allowlist** (`_ALLOWED_NODES`) — anything not on the list (imports,
   class defs, `with`, etc.) is rejected before it ever executes. A second
   pass blocks specific dangerous names (`eval`, `open`, `os`, dunder
   attributes like `__globals__`) even if they'd technically parse as an
   allowed node type.
3. The function is `exec`'d into a namespace with a **restricted builtins
   dict** (~25 safe functions — no `__import__`, no `open`) plus `math` and
   `statistics` pre-injected as objects, so the function never needs an
   `import` statement at all — which is why imports can just be banned
   outright rather than allowlisted per-module.
4. Runs in a worker thread with a **5-second wall-clock timeout**
   (`concurrent.futures`); a runaway loop gets abandoned, not left hanging.
5. On any failure (bad syntax, blocked construct, exception, timeout), the
   error becomes feedback for a retry (max 2), same pattern as the SQL loop.

**Be clear-eyed about what this is and isn't.** It's a reasonable allowlist
for a small internal tool talking to a trusted model provider — it closes the
obvious holes (file access, network, process spawning, introspection-based
sandbox escapes via dunders). It is **not** an OS-level security boundary.
If this ever needs to survive genuinely adversarial input, move execution to
a separate subprocess or container with real resource limits (cgroups,
seccomp, gVisor, nsjail) instead of relying on the AST check as the only
line of defense — in-process Python `exec()`, however filtered, is not where
you want your last line of defense to live.

## Models (OpenAI, cost-routed per task)

All model wiring lives in one file: `agent/llm_config.py`. Every node pulls
its client from there via `make_llm(...)` — nothing else needs touching to
swap a model.

| Model ID | ~$/1M tok (in/out) | Used for |
|---|---|---|
| `gpt-5.6-luna` | $0.20 / $1.20 | `classify_intent` (routing), web-search summarizer |
| `gpt-5.6-terra` | $2 / $12 | SQL generation, math-op planning, custom codegen (first attempt), final answer |
| `gpt-5.6-sol` | $5 / $30 | custom codegen, **escalation only** — fires automatically if Terra's generated function already failed once and the retry loop kicks in |

Reasoning for the split: classification and summarization are "read this,
pick/compress" tasks Luna handles fine at a fraction of Terra's cost. SQL
generation, choosing analytics operations, and composing the final answer all
need real reasoning about correctness, so they stay on Terra rather than
risking wrong numbers to save a few cents. Codegen starts on Terra too — only
escalates to Sol if Terra's first attempt at that specific function already
failed, so the expensive tier is rare rather than default.

Every one is independently overridable via env var:
`CLASSIFIER_MODEL`, `SUMMARIZER_MODEL`, `SQL_MODEL`, `MATH_PLAN_MODEL`,
`CODEGEN_MODEL`, `CODEGEN_ESCALATION_MODEL`, `FINAL_ANALYSIS_MODEL`.

```bash
export CLASSIFIER_MODEL=gpt-4.1-nano   # e.g. even cheaper for routing
export CODEGEN_MODEL=gpt-5.6-sol       # e.g. skip the escalation step entirely
```

**Verify model IDs and pricing before deploying** — this tier of the market
moves fast; check https://platform.openai.com/docs/pricing for current names
and rates rather than trusting the defaults baked in here indefinitely.

`pip install langchain-openai` (replaces `langchain-anthropic` from v1).

## Env vars

- `DATABASE_URL`, `AGENT_DATABASE_URL` (optional read-only role — see v1 README)
- `OPENAI_API_KEY`
- the seven model-override vars above (all optional, sensible defaults baked in)
- `WEB_SEARCH_API_KEY` (SerpAPI key — web search silently no-ops without it)

## Things worth doing before production

- Add a row-count cap / injected `LIMIT` on generated SQL (still not enforced
  in v2 — carried over from v1's known gap).
- Move custom-codegen execution to a real sandboxed subprocess per the note
  above if this is ever exposed beyond a small trusted user base.
- Consider caching `web_search_node` results briefly (e.g. 15 min) for
  repeated questions like "today's rain forecast" to cut latency/cost.