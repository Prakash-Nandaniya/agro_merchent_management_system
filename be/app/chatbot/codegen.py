import ast
import concurrent.futures
import json
import math
import statistics
from typing import Any

from langchain_core.messages import HumanMessage, SystemMessage

from app.chatbot.llmconfig import CODEGEN_ESCALATION_MODEL, CODEGEN_MODEL, make_llm
from app.chatbot.state import AgentState

_codegen_llm = make_llm(CODEGEN_MODEL)
_codegen_llm_escalated = make_llm(CODEGEN_ESCALATION_MODEL)

FUNCTION_NAME = "custom_op"
EXEC_TIMEOUT_SECONDS = 5

_ALLOWED_NODES = (
    ast.Module, ast.FunctionDef, ast.arguments, ast.arg,
    ast.Return, ast.Assign, ast.AugAssign, ast.AnnAssign, ast.Expr,
    ast.If, ast.For, ast.While, ast.Break, ast.Continue, ast.Pass,
    ast.Call, ast.Name, ast.Load, ast.Store, ast.Attribute,
    ast.BinOp, ast.UnaryOp, ast.BoolOp, ast.Compare,
    ast.Add, ast.Sub, ast.Mult, ast.Div, ast.FloorDiv, ast.Mod, ast.Pow,
    ast.USub, ast.UAdd, ast.Not, ast.And, ast.Or,
    ast.Eq, ast.NotEq, ast.Lt, ast.LtE, ast.Gt, ast.GtE, ast.In, ast.NotIn, ast.Is, ast.IsNot,
    ast.List, ast.Dict, ast.Tuple, ast.Set,
    ast.Subscript, ast.Slice, ast.Index if hasattr(ast, "Index") else ast.Slice,
    ast.ListComp, ast.DictComp, ast.SetComp, ast.GeneratorExp, ast.comprehension,
    ast.Constant, ast.keyword, ast.Starred, ast.IfExp, ast.Try, ast.ExceptHandler, ast.Raise,
)

_FORBIDDEN_NAMES = {
    "__import__", "eval", "exec", "compile", "open", "input",
    "getattr", "setattr", "delattr", "globals", "locals", "vars",
    "__builtins__", "__class__", "__base__", "__subclasses__", "__globals__",
    "__code__", "__loader__", "os", "sys", "subprocess", "socket", "requests",
    "shutil", "pathlib",
}

_SAFE_BUILTINS: dict[str, Any] = {
    "len": len, "range": range, "sum": sum, "min": min, "max": max,
    "abs": abs, "round": round, "sorted": sorted, "enumerate": enumerate,
    "zip": zip, "map": map, "filter": filter, "float": float, "int": int,
    "str": str, "bool": bool, "list": list, "dict": dict, "set": set,
    "tuple": tuple, "isinstance": isinstance, "reversed": reversed,
    "any": any, "all": all,
}


class UnsafeCodeError(ValueError):
    pass


def _validate_ast(tree: ast.AST) -> None:
    for node in ast.walk(tree):
        if not isinstance(node, _ALLOWED_NODES):
            raise UnsafeCodeError(f"Disallowed syntax: {type(node).__name__}")
        if isinstance(node, ast.Name) and node.id in _FORBIDDEN_NAMES:
            raise UnsafeCodeError(f"Disallowed name: {node.id}")
        if isinstance(node, ast.Attribute) and node.attr.startswith("__"):
            raise UnsafeCodeError(f"Disallowed dunder attribute access: {node.attr}")

    top_level_funcs = [n for n in tree.body if isinstance(n, ast.FunctionDef)]
    if len(top_level_funcs) != 1 or top_level_funcs[0].name != FUNCTION_NAME:
        raise UnsafeCodeError(f"Code must define exactly one function named `{FUNCTION_NAME}`.")


def _compile_function(code: str):
    tree = ast.parse(code, mode="exec")
    _validate_ast(tree)

    namespace: dict[str, Any] = {
        "__builtins__": _SAFE_BUILTINS,
        "math": math,
        "statistics": statistics,
    }
    exec(compile(tree, "<custom_op>", "exec"), namespace)  # noqa: S102
    func = namespace.get(FUNCTION_NAME)
    if func is None:
        raise UnsafeCodeError(f"No `{FUNCTION_NAME}` function found after compiling.")
    return func


def _run_with_timeout(func, data: list[dict], timeout: int = EXEC_TIMEOUT_SECONDS):
    with concurrent.futures.ThreadPoolExecutor(max_workers=1) as pool:
        future = pool.submit(func, data)
        return future.result(timeout=timeout)


CODEGEN_SYSTEM_PROMPT = f"""Write ONE Python function named `{FUNCTION_NAME}` that
takes a single argument `data` (a list of dicts — the query result rows, values
already floats/strings/None) and returns the requested calculation.

Rules:
- Define exactly one function: `def {FUNCTION_NAME}(data):`
- No imports — `math` and `statistics` are already available as globals.
- No file, network, or system access (not available anyway).
- Return a JSON-serializable value: number, string, list, or dict.
- Access row values with `.get(key)` and handle None/missing keys defensively.
- Keep it simple and correct over clever.

Respond with ONLY the Python code, no markdown fences, no explanation.
"""


async def _generate_code(
    description: str, columns: list[str], feedback: str | None, escalate: bool = False
) -> str:
    prompt = f"Task: {description}\n\nColumns available in each row: {columns}"
    if feedback:
        prompt += f"\n\nYour previous attempt failed with this error — fix it:\n{feedback}"

    model = _codegen_llm_escalated if escalate else _codegen_llm
    response = await model.ainvoke(
        [SystemMessage(content=CODEGEN_SYSTEM_PROMPT), HumanMessage(content=prompt)]
    )
    code = response.content.strip().strip("`")
    if code.lower().startswith("python"):
        code = code[6:].strip()
    return code


async def custom_codegen_node(state: AgentState) -> dict:
    pending = state.get("pending_custom_ops", [])
    if not pending:
        return {"custom_code_error": None}

    data = state.get("raw_rows", [])
    columns = list(data[0].keys()) if data else []
    results = dict(state.get("math_results", {}))
    last_error: str | None = None

    escalate = state.get("custom_code_retry_count", 0) > 0

    for i, step in enumerate(pending):
        description = step.get("description", "")
        label = step.get("label") or f"custom_{i}"
        feedback = state.get("custom_code_error") if i == 0 else None

        try:
            code = await _generate_code(description, columns, feedback, escalate=escalate)
            func = _compile_function(code)
            result = _run_with_timeout(func, data)
            json.dumps(result, default=str)
            results[label] = result
        except concurrent.futures.TimeoutError:
            last_error = f"'{description}' timed out after {EXEC_TIMEOUT_SECONDS}s"
            results[label] = f"error: computation timed out"
        except (UnsafeCodeError, SyntaxError, TypeError, ValueError, Exception) as e:  # noqa: BLE001
            last_error = f"'{description}' failed: {e}"
            results[label] = f"error: {e}"

    return {
        "math_results": results,
        "custom_code_error": last_error,
        "custom_code_retry_count": state.get("custom_code_retry_count", 0) + 1,
    }


def route_after_codegen(state: AgentState) -> str:
    error = state.get("custom_code_error")
    retries = state.get("custom_code_retry_count", 0)
    if error and retries < 2:
        return "custom_codegen"  # loop back and retry with the error as feedback
    return "final_analysis"