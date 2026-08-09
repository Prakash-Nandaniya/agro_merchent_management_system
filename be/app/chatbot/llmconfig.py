"""
Single source of truth for "which model does which job." Change a task's
model here — no other file needs to change. All defaults are env-overridable
so you can A/B or downgrade further without a code change.

Tier reference (verify current rates at platform.openai.com/docs/pricing
before relying on this — OpenAI updates pricing independently of model IDs):
  gpt-5.6-luna   $0.20 / $1.20 per 1M tok  — classification, extraction, summarization
  gpt-5.6-terra  $2.00 / $12.00 per 1M tok — balanced production work (~GPT-5.5 quality, half the cost)
  gpt-5.6-sol    $5.00 / $30.00 per 1M tok — flagship reasoning/coding, use only where Terra falls short

Mapping used in this project:
  classify_intent   -> Luna   (pure classification, cheapest tier is plenty)
  web summarizer     -> Luna   (extraction/summarization, Luna's exact use case)
  generate_sql       -> Terra  (schema reasoning, joins, filters — getting it wrong is costly)
  plan_math          -> Terra  (chooses ops that feed real financial numbers downstream)
  custom_codegen     -> Terra, escalate to Sol only if a description keeps failing retries
  final_analysis     -> Terra  (composes the user-facing answer, esp. multi-section reports)
"""

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