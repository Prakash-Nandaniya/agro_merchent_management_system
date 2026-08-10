from langgraph.checkpoint.memory import InMemorySaver
from langgraph.graph import END, START, StateGraph
from sqlalchemy.ext.asyncio import AsyncSession

from app.chatbot.codegen import custom_codegen_node, route_after_codegen
from app.chatbot.nodes import (
    direct_answer_node,
    execute_math_node,
    final_analysis_node,
    generate_sql_node,
    make_execute_sql_node,
    plan_math_node,
    route_after_execute_math,
    route_after_execute_sql,
)
from app.chatbot.router import (
    classify_intent_node,
    greeting_response_node,
    off_topic_response_node,
    route_after_classify,
)
from app.chatbot.state import AgentState
from app.chatbot.websearch import web_search_node

_checkpointer = InMemorySaver()


def build_graph(db: AsyncSession):
    graph = StateGraph(AgentState)

    graph.add_node("classify_intent", classify_intent_node)
    graph.add_node("greeting_response", greeting_response_node)
    graph.add_node("off_topic_response", off_topic_response_node)
    graph.add_node("web_search", web_search_node)
    graph.add_node("generate_sql", generate_sql_node)
    graph.add_node("execute_sql", make_execute_sql_node(db))
    graph.add_node("plan_math", plan_math_node)
    graph.add_node("execute_math", execute_math_node)
    graph.add_node("custom_codegen", custom_codegen_node)
    graph.add_node("direct_answer", direct_answer_node)
    graph.add_node("final_analysis", final_analysis_node)

    graph.add_edge(START, "classify_intent")
    graph.add_conditional_edges(
        "classify_intent",
        route_after_classify,
        {
            "greeting_response": "greeting_response",
            "off_topic_response": "off_topic_response",
            "business_pipeline": "web_search",
            "direct_answer": "direct_answer",
        },
    )
    graph.add_edge("greeting_response", END)
    graph.add_edge("off_topic_response", END)

    graph.add_edge("web_search", "generate_sql")
    graph.add_edge("generate_sql", "execute_sql")
    graph.add_conditional_edges(
        "execute_sql",
        route_after_execute_sql,
        {"generate_sql": "generate_sql", "plan_math": "plan_math"},
    )
    graph.add_edge("plan_math", "execute_math")
    graph.add_conditional_edges(
        "execute_math",
        route_after_execute_math,
        {"custom_codegen": "custom_codegen", "final_analysis": "final_analysis"},
    )
    graph.add_edge("direct_answer", END)
    graph.add_conditional_edges(
        "custom_codegen",
        route_after_codegen,
        {"custom_codegen": "custom_codegen", "final_analysis": "final_analysis"},
    )
    graph.add_edge("final_analysis", END)

    return graph.compile(checkpointer=_checkpointer)