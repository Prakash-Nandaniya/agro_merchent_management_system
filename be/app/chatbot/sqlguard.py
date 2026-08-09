import re

_FORBIDDEN_KEYWORDS = {
    "INSERT", "UPDATE", "DELETE", "DROP", "ALTER", "TRUNCATE",
    "GRANT", "REVOKE", "CREATE", "EXEC", "EXECUTE", "MERGE", "CALL",
    "COPY", "VACUUM", "REINDEX", "ATTACH", "DETACH", "PRAGMA",
}


class UnsafeSQLError(ValueError):
    pass


def is_safe_select(sql_query: str) -> bool:
    q = sql_query.strip().rstrip(";").strip()
    if not q:
        return False
    upper = q.upper().lstrip("(")
    if not (upper.startswith("SELECT") or upper.startswith("WITH")):
        return False
    if ";" in q:  # reject stacked statements
        return False
    tokens = re.findall(r"[A-Za-z]+", upper)
    if any(tok in _FORBIDDEN_KEYWORDS for tok in tokens):
        return False
    return True


def validate_select_only(sql: str) -> str:
    cleaned = sql.strip().rstrip(";").strip()
    if not is_safe_select(cleaned):
        raise UnsafeSQLError(
            "Only a single read-only SELECT statement against \"Invoices\"/trades is allowed."
        )
    return cleaned