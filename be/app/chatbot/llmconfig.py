from langchain_openai import ChatOpenAI
from app.core.config import settings

CLASSIFIER_MODEL = "gpt-5.6-luna"
SUMMARIZER_MODEL = "gpt-5.6-luna"
SQL_MODEL = "gpt-5.6-terra"
MATH_PLAN_MODEL = "gpt-5.6-terra"
CODEGEN_MODEL = "gpt-5.6-terra"
CODEGEN_ESCALATION_MODEL = "gpt-5.6-sol"
FINAL_ANALYSIS_MODEL = "gpt-5.6-terra"


def make_llm(model_name: str, temperature: float = 0) -> ChatOpenAI:
    return ChatOpenAI(model=model_name, temperature=temperature,api_key=settings.OPENAI_API_KEY)