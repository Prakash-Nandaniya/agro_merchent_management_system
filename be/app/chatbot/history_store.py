import json
import os
from threading import Lock
from typing import Any, Dict, List
from datetime import datetime, date, time, timedelta
from uuid import uuid4

from langchain_core.messages import HumanMessage, SystemMessage

from app.chatbot.llmconfig import CHAT_HISTORY_SUMMARY_MODEL, make_llm

STORAGE_PATH = os.path.join(os.path.dirname(__file__), "chat_history.json")
_lock = Lock()

CHAT_SUMMARY_PROMPT = """Summarize this conversation history for an agricultural trading
business assistant. Keep key facts: crops, prices, dates, parties, amounts, and decisions.
Be concise (4-8 sentences). If a prior summary is provided, merge it with the new
messages into one coherent summary — do not repeat old information unnecessarily."""


def _read_all() -> Dict[str, Any]:
    if not os.path.exists(STORAGE_PATH):
        return {}
    try:
        with open(STORAGE_PATH, "r", encoding="utf-8") as f:
            return json.load(f)
    except Exception:
        return {}


def _write_all(data: Dict[str, Any]) -> None:
    with _lock:
        with open(STORAGE_PATH, "w", encoding="utf-8") as f:
            json.dump(data, f, ensure_ascii=False, indent=2)


def _last_midnight_iso() -> str:
    today = date.today()
    dt = datetime.combine(today, time.min)
    return dt.isoformat()


def get_thread(thread_id: str) -> Dict[str, Any]:
    data = _read_all()
    thread = data.get(thread_id)
    if not thread:
        thread = {"summary": "", "full_messages": [], "qa_count": 0, "created_at": _last_midnight_iso(), "update_time": _last_midnight_iso()}
    # migrate legacy interaction_count (counted individual messages)
    if "qa_count" not in thread and "interaction_count" in thread:
        thread["qa_count"] = thread["interaction_count"] // 2
    if "created_at" not in thread:
        thread["created_at"] = _last_midnight_iso()
    if "update_time" not in thread:
        thread["update_time"] = _last_midnight_iso()
    return thread


def save_thread(thread_id: str, thread_data: Dict[str, Any]) -> None:
    data = _read_all()
    data[thread_id] = thread_data
    _write_all(data)


def append_qa_pair(thread_id: str, user_content: str, assistant_content: str) -> None:
    t = get_thread(thread_id)
    t.setdefault("full_messages", []).extend([
        {"role": "user", "content": user_content},
        {"role": "assistant", "content": assistant_content},
    ])
    t["qa_count"] = t.get("qa_count", 0) + 1
    # ensure created_at exists (use last midnight timestamp when creating)
    if "created_at" not in t:
        t["created_at"] = _last_midnight_iso()
    # update the update_time to last midnight (per your requirement)
    t["update_time"] = _last_midnight_iso()
    save_thread(thread_id, t)


async def compact_history_if_needed(thread_id: str) -> None:
    """After 8 Q/A pairs: LLM-summarize the 5 oldest pairs, merge with old summary, keep last 3."""
    t = get_thread(thread_id)
    qa_count = t.get("qa_count", 0)
    if qa_count < 8:
        return

    full: List[Dict[str, str]] = t.get("full_messages", [])
    # 5 oldest Q/A pairs = 10 messages; keep last 3 pairs = 6 messages
    to_summarize = full[:10]
    keep = full[-6:]

    transcript = "\n".join(f"{m['role']}: {m['content']}" for m in to_summarize)
    prev_summary = t.get("summary", "")

    llm = make_llm(CHAT_HISTORY_SUMMARY_MODEL)
    prompt_parts = []
    if prev_summary:
        prompt_parts.append(f"Prior summary:\n{prev_summary}\n")
    prompt_parts.append(f"New messages to merge:\n{transcript}")

    response = await llm.ainvoke([
        SystemMessage(content=CHAT_SUMMARY_PROMPT),
        HumanMessage(content="\n".join(prompt_parts)),
    ])

    t["summary"] = (response.content or "").strip()
    t["full_messages"] = keep
    t["qa_count"] = 3
    if "created_at" not in t:
        t["created_at"] = _last_midnight_iso()
    t["update_time"] = _last_midnight_iso()
    save_thread(thread_id, t)


def purge_old_threads(max_age_days: int = 7) -> None:
    """Clear threads older than `max_age_days` by resetting their content and
    updating their `created_at` to the last midnight. This should be run at
    every request to avoid stale storage growth."""
    data = _read_all()
    changed = False
    now = datetime.now()
    cutoff = now - timedelta(days=max_age_days)
    for k, v in list(data.items()):
        # use update_time for purge decision (delete storage if stale)
        updated = v.get("update_time")
        try:
            updated_dt = datetime.fromisoformat(updated) if updated else None
        except Exception:
            updated_dt = None

        if updated_dt is None or updated_dt < cutoff:
            # remove the entire thread storage
            del data[k]
            changed = True

    if changed:
        _write_all(data)


def delete_thread(thread_id: str) -> None:
    """Remove a thread storage entirely (used when user requests deletion)."""
    data = _read_all()
    if thread_id in data:
        del data[thread_id]
        _write_all(data)
