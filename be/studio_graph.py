from app.chatbot.langgraph import build_graph

original_app = build_graph(None)

graph = original_app.builder.compile()