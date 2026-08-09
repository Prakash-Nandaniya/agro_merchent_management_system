"""
Fixed catalog of deterministic math operations. The LLM only ever picks a
`op` name + args from OPERATIONS_DESCRIPTION — arithmetic itself always runs
here in plain Python so numbers are exact, never LLM-approximated.

If the LLM needs something NOT in this catalog, it emits {"op": "custom",
"description": "..."} instead — that gets routed to codegen.py, which asks
the LLM to write and (sandboxed) run a one-off function. See nodes.py.
"""

import math
import statistics
from collections import defaultdict
from typing import Any, Callable

Row = dict[str, Any]


def _num(row: Row, col: str) -> float:
    v = row.get(col)
    try:
        return float(v) if v is not None else 0.0
    except (TypeError, ValueError):
        return 0.0


def _values(data: list[Row], column: str) -> list[float]:
    return [_num(r, column) for r in data]


# ---------------------------------------------------------------------------
# Basic aggregates
# ---------------------------------------------------------------------------

def op_sum(data: list[Row], column: str, **_: Any) -> float:
    return round(sum(_values(data, column)), 2)


def op_average(data: list[Row], column: str, **_: Any) -> float:
    vals = _values(data, column)
    return round(sum(vals) / len(vals), 2) if vals else 0.0


def op_min(data: list[Row], column: str, **_: Any) -> float:
    vals = _values(data, column)
    return round(min(vals), 2) if vals else 0.0


def op_max(data: list[Row], column: str, **_: Any) -> float:
    vals = _values(data, column)
    return round(max(vals), 2) if vals else 0.0


def op_count(data: list[Row], column: str | None = None, **_: Any) -> int:
    if column is None:
        return len(data)
    return sum(1 for r in data if r.get(column) is not None)


def op_median(data: list[Row], column: str, **_: Any) -> float:
    vals = _values(data, column)
    return round(statistics.median(vals), 2) if vals else 0.0


def op_variance(data: list[Row], column: str, **_: Any) -> float:
    vals = _values(data, column)
    return round(statistics.variance(vals), 4) if len(vals) > 1 else 0.0


def op_std_dev(data: list[Row], column: str, **_: Any) -> float:
    vals = _values(data, column)
    return round(statistics.stdev(vals), 4) if len(vals) > 1 else 0.0


def op_percentile(data: list[Row], column: str, percentile: float, **_: Any) -> float:
    vals = sorted(_values(data, column))
    if not vals:
        return 0.0
    k = (len(vals) - 1) * (percentile / 100)
    f, c = math.floor(k), math.ceil(k)
    if f == c:
        return round(vals[int(k)], 2)
    return round(vals[f] + (vals[c] - vals[f]) * (k - f), 2)


# ---------------------------------------------------------------------------
# Grouping
# ---------------------------------------------------------------------------

def op_group_sum(data: list[Row], group_by: str, value_column: str, **_: Any) -> dict[str, float]:
    grouped: dict[str, float] = defaultdict(float)
    for r in data:
        grouped[str(r.get(group_by, "Unknown"))] += _num(r, value_column)
    return {k: round(v, 2) for k, v in grouped.items()}


def op_group_average(data: list[Row], group_by: str, value_column: str, **_: Any) -> dict[str, float]:
    sums: dict[str, float] = defaultdict(float)
    counts: dict[str, int] = defaultdict(int)
    for r in data:
        key = str(r.get(group_by, "Unknown"))
        sums[key] += _num(r, value_column)
        counts[key] += 1
    return {k: round(sums[k] / counts[k], 2) for k in sums if counts[k]}


def op_group_count(data: list[Row], group_by: str, **_: Any) -> dict[str, int]:
    counts: dict[str, int] = defaultdict(int)
    for r in data:
        counts[str(r.get(group_by, "Unknown"))] += 1
    return dict(counts)


def op_top_n(data: list[Row], column: str, n: int = 5, order: str = "desc", **_: Any) -> list[Row]:
    ranked = sorted(data, key=lambda r: _num(r, column), reverse=(order == "desc"))
    return ranked[: max(1, n)]


def op_percentage_of_total(data: list[Row], column: str, **_: Any) -> list[dict]:
    vals = _values(data, column)
    total = sum(vals)
    return [{"row": i, "value": v, "pct": round((v / total * 100) if total else 0.0, 2)} for i, v in enumerate(vals)]


# ---------------------------------------------------------------------------
# Business-specific
# ---------------------------------------------------------------------------

def op_margin(data: list[Row], revenue_column: str, cost_columns: list[str], **_: Any) -> dict[str, float]:
    revenue = sum(_values(data, revenue_column))
    cost = sum(_num(r, c) for r in data for c in cost_columns)
    profit = revenue - cost
    return {
        "revenue": round(revenue, 2),
        "cost": round(cost, 2),
        "profit": round(profit, 2),
        "margin_pct": round((profit / revenue * 100) if revenue else 0.0, 2),
    }


def op_roi(data: list[Row], invested_column: str, returned_column: str, **_: Any) -> float:
    invested = sum(_values(data, invested_column))
    returned = sum(_values(data, returned_column))
    return round((returned - invested) / invested * 100, 2) if invested else 0.0


def op_weighted_average(data: list[Row], value_column: str, weight_column: str, **_: Any) -> float:
    total_weight = sum(_values(data, weight_column))
    if not total_weight:
        return 0.0
    weighted = sum(_num(r, value_column) * _num(r, weight_column) for r in data)
    return round(weighted / total_weight, 4)


def op_ratio(data: list[Row], numerator_column: str, denominator_column: str, **_: Any) -> float:
    num = sum(_values(data, numerator_column))
    den = sum(_values(data, denominator_column))
    return round(num / den, 4) if den else 0.0


# ---------------------------------------------------------------------------
# Trend / forecasting / analytical
# ---------------------------------------------------------------------------

def op_growth_rate(data: list[Row], column: str, **_: Any) -> float:
    """% change from the first to the last row, in the order rows arrived
    (make sure the SQL query ORDER BY the relevant date/period column)."""
    vals = _values(data, column)
    if len(vals) < 2 or vals[0] == 0:
        return 0.0
    return round((vals[-1] - vals[0]) / vals[0] * 100, 2)


def op_cagr(data: list[Row], column: str, periods: float, **_: Any) -> float:
    """Compound annual growth rate between first and last row's value over
    `periods` years."""
    vals = _values(data, column)
    if len(vals) < 2 or vals[0] <= 0 or periods <= 0:
        return 0.0
    return round(((vals[-1] / vals[0]) ** (1 / periods) - 1) * 100, 2)


def op_moving_average(data: list[Row], column: str, window: int = 3, **_: Any) -> list[float]:
    vals = _values(data, column)
    if window < 1 or len(vals) < window:
        return []
    return [round(sum(vals[i - window : i]) / window, 2) for i in range(window, len(vals) + 1)]


def op_linear_forecast(data: list[Row], column: str, periods_ahead: int = 3, **_: Any) -> dict[str, Any]:
    """Simple linear-regression trend over the row sequence (rows = periods,
    ordered by the SQL query), extrapolated `periods_ahead` steps forward."""
    vals = _values(data, column)
    n = len(vals)
    if n < 3:
        return {"slope": 0.0, "intercept": 0.0, "forecast": []}

    x_mean = (n - 1) / 2
    y_mean = sum(vals) / n
    numerator = sum((i - x_mean) * (y - y_mean) for i, y in enumerate(vals))
    denominator = sum((i - x_mean) ** 2 for i in range(n))
    if denominator == 0:
        return {"slope": 0.0, "intercept": y_mean, "forecast": [round(y_mean, 2)] * periods_ahead}

    slope = numerator / denominator
    intercept = y_mean - slope * x_mean
    forecast = [round(slope * (n + i) + intercept, 2) for i in range(periods_ahead)]
    return {"slope": round(slope, 4), "intercept": round(intercept, 2), "forecast": forecast}


def op_correlation(data: list[Row], column_a: str, column_b: str, **_: Any) -> float:
    a, b = _values(data, column_a), _values(data, column_b)
    if len(a) < 2 or len(set(a)) < 2 or len(set(b)) < 2:
        return 0.0
    try:
        return round(statistics.correlation(a, b), 4)
    except (statistics.StatisticsError, AttributeError):
        n = len(a)
        mean_a, mean_b = sum(a) / n, sum(b) / n
        cov = sum((x - mean_a) * (y - mean_b) for x, y in zip(a, b))
        std_a = math.sqrt(sum((x - mean_a) ** 2 for x in a))
        std_b = math.sqrt(sum((y - mean_b) ** 2 for y in b))
        return round(cov / (std_a * std_b), 4) if std_a and std_b else 0.0


def op_outliers(data: list[Row], column: str, z_threshold: float = 2.0, **_: Any) -> list[dict]:
    """Rows whose value on `column` is more than z_threshold std-devs from
    the mean — useful for flagging suspect prices/quantities."""
    vals = _values(data, column)
    if len(vals) < 3:
        return []
    mean = sum(vals) / len(vals)
    stdev = statistics.stdev(vals)
    if stdev == 0:
        return []
    flagged = []
    for r, v in zip(data, vals):
        z = (v - mean) / stdev
        if abs(z) >= z_threshold:
            flagged.append({**r, "z_score": round(z, 2)})
    return flagged


OPERATIONS: dict[str, Callable[..., Any]] = {
    "sum": op_sum,
    "average": op_average,
    "min": op_min,
    "max": op_max,
    "count": op_count,
    "median": op_median,
    "variance": op_variance,
    "std_dev": op_std_dev,
    "percentile": op_percentile,
    "group_sum": op_group_sum,
    "group_average": op_group_average,
    "group_count": op_group_count,
    "top_n": op_top_n,
    "percentage_of_total": op_percentage_of_total,
    "margin": op_margin,
    "roi": op_roi,
    "weighted_average": op_weighted_average,
    "ratio": op_ratio,
    "growth_rate": op_growth_rate,
    "cagr": op_cagr,
    "moving_average": op_moving_average,
    "linear_forecast": op_linear_forecast,
    "correlation": op_correlation,
    "outliers": op_outliers,
}

OPERATIONS_DESCRIPTION = """
sum                {column}
average            {column}
min                {column}
max                {column}
count              {column?}
median             {column}
variance           {column}
std_dev            {column}
percentile         {column, percentile: 0-100}
group_sum          {group_by, value_column}
group_average      {group_by, value_column}
group_count        {group_by}
top_n              {column, n?, order?: "desc"|"asc"}
percentage_of_total {column}
margin             {revenue_column, cost_columns: [list]}
roi                {invested_column, returned_column}
weighted_average   {value_column, weight_column}
ratio              {numerator_column, denominator_column}
growth_rate        {column}                          -- % change first->last row (ORDER BY period in SQL)
cagr               {column, periods}                 -- compound annual growth rate
moving_average     {column, window?}                 -- rolling average
linear_forecast    {column, periods_ahead?}           -- trend line + N-step forecast
correlation        {column_a, column_b}               -- Pearson correlation, -1 to 1
outliers           {column, z_threshold?}             -- rows far from the mean

If NONE of these fit what's needed, use:
custom             {description}                      -- routes to code generation
""".strip()


def run_math_plan(data: list[Row], plan: list[dict[str, Any]]) -> tuple[dict[str, Any], list[dict[str, Any]]]:
    """Runs every standard op in `plan`. Any {"op": "custom", ...} steps are
    NOT run here — they're returned separately for the codegen node to handle.
    Returns (results, pending_custom_ops)."""
    results: dict[str, Any] = {}
    pending_custom: list[dict[str, Any]] = []

    for i, step in enumerate(plan):
        op_name = step.get("op")
        label = step.get("label") or f"{op_name}_{i}"

        if op_name == "custom":
            pending_custom.append(step)
            continue

        func = OPERATIONS.get(op_name)
        if func is None:
            results[label] = f"error: unknown operation '{op_name}'"
            continue

        args = {k: v for k, v in step.items() if k not in ("op", "label")}
        try:
            results[label] = func(data, **args)
        except TypeError as e:
            results[label] = f"error: invalid arguments for '{op_name}' ({e})"

    return results, pending_custom