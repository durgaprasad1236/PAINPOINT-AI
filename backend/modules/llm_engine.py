"""
llm_engine.py
-------------
LLM-powered deep analysis using OpenAI API (GPT model).

This is the INTELLIGENCE CORE of PainPoint AI.

For each feedback, the LLM:
1. Detects the specific pain point
2. Classifies into a category
3. Evaluates severity (Low/Medium/High)
4. Detects emotion (Frustration/Anger/Disappointment/etc)
5. Identifies root cause (WHY the problem occurred)
6. Generates a solution (HOW to fix it)
7. Suggests product/feature improvements

This goes far beyond simple classification - it's reasoning and decision intelligence.
"""

import json
import os
import re
from typing import Dict

from dotenv import load_dotenv
from openai import OpenAI

# Load environment variables
load_dotenv()

# ═══════════════════════════════════════════════════════════════
#  OPENAI CLIENT INITIALIZATION
# ═══════════════════════════════════════════════════════════════

_client: OpenAI | None = None


def _get_client() -> OpenAI:
    """
    Initialize and return OpenAI client.
    Reads OPENAI_API_KEY from environment variables.
    """
    global _client
    if _client is None:
        api_key = os.getenv("OPENAI_API_KEY", "")
        if not api_key or api_key == "your_openai_api_key_here":
            raise EnvironmentError(
                "\n❌ OPENAI_API_KEY not found!\n\n"
                "Please:\n"
                "1. Get your key at: https://platform.openai.com/api-keys\n"
                "2. Open backend/.env file\n"
                "3. Replace 'your_openai_api_key_here' with your actual key\n"
            )
        _client = OpenAI(api_key=api_key)
    return _client


# ═══════════════════════════════════════════════════════════════
#  LLM PROMPT TEMPLATE
# ═══════════════════════════════════════════════════════════════

_PROMPT_TEMPLATE = """You are an expert AI business analyst specializing in customer experience and product improvement.

Analyze the customer feedback below and return ONLY a valid JSON object with NO explanation, NO markdown, NO code fences.

The JSON MUST have exactly these 7 fields:

{{
  "pain_point": "the specific problem the customer is experiencing (1-2 clear sentences)",
  "category": "one of: Payments & Billing | Refund & Charges | Subscription Issues | Login & Authentication | Account Management | App Performance / Speed | Bugs & Errors / Crashes | UI / UX Problems | Feature Request | Notifications Issues | Security & Privacy | Customer Support | Data Sync / Data Loss | Integration / API Issues | Installation / Update Problems | Compatibility Issues | Network / Connectivity | Accessibility Problems | Other",
  "severity": "one of: Low | Medium | High",
  "emotion": "one of: Frustration | Anger | Disappointment | Neutral | Satisfaction | Confusion",
  "root_cause": "the underlying technical or process reason this problem occurred (1-2 sentences explaining WHY)",
  "solution": "a concrete, actionable fix recommendation for the development/operations team (1-2 sentences on HOW to fix)",
  "feature_suggestion": "a product improvement or new feature that would prevent this issue in the future (1 sentence)"
}}

Customer Feedback:
\"\"\"{feedback}\"\"\"

CRITICAL: Return ONLY the JSON object. No text before or after. No markdown. No explanation."""


# ═══════════════════════════════════════════════════════════════
#  LLM ANALYSIS FUNCTION
# ═══════════════════════════════════════════════════════════════

def llm_analyse(feedback_text: str, ml_hint: str = "") -> Dict[str, any]:
    """
    Perform deep LLM analysis on a feedback string using Groq API.
    
    This is where the AI reasoning happens. The LLM doesn't just classify -
    it understands context, infers causality, and generates solutions.
    
    Args:
        feedback_text: The cleaned customer feedback string
        ml_hint: Optional category suggestion from ML layer (used for validation)
        
    Returns:
        Dict with 7 intelligence fields:
        - pain_point: What the problem is
        - category: Which area (Payment/UI/etc)
        - severity: How serious (Low/Medium/High)
        - emotion: Customer feeling
        - root_cause: WHY it happened (reasoning)
        - solution: HOW to fix it (actionable)
        - feature_suggestion: Product improvement idea
        
    On error:
        Returns dict with error messages in all fields
    """
    # Input validation
    if not feedback_text.strip():
        return _empty_result("Empty feedback - nothing to analyze")
    
    # Build prompt
    prompt = _PROMPT_TEMPLATE.format(feedback=feedback_text)
    
    try:
        # Call OpenAI API
        client = _get_client()
        response = client.chat.completions.create(
            model="gpt-4o-mini",  # OpenAI's cost-effective model
            messages=[{"role": "user", "content": prompt}],
            temperature=0.2,  # Low = consistent structured output
            max_tokens=512,
        )
        
        # Extract response
        raw_content = response.choices[0].message.content.strip()
        
        # Clean up any markdown fences the LLM might add despite instructions
        raw_content = re.sub(r"^```(?:json)?\s*", "", raw_content)
        raw_content = re.sub(r"\s*```$", "", raw_content)
        
        # Parse JSON
        result = json.loads(raw_content)
        
        # Validate required fields
        required_keys = [
            "pain_point", "category", "severity", "emotion",
            "root_cause", "solution", "feature_suggestion"
        ]
        for key in required_keys:
            if key not in result:
                result[key] = "Not detected"
        
        # Normalize values to expected options
        result["severity"] = _normalize(
            result["severity"],
            ["Low", "Medium", "High"],
            "Medium"
        )
        
        result["category"] = _normalize(
            result["category"],
            [
                "Payments & Billing", "Refund & Charges", "Subscription Issues",
                "Login & Authentication", "Account Management", "App Performance / Speed",
                "Bugs & Errors / Crashes", "UI / UX Problems", "Feature Request",
                "Notifications Issues", "Security & Privacy", "Customer Support",
                "Data Sync / Data Loss", "Integration / API Issues",
                "Installation / Update Problems", "Compatibility Issues",
                "Network / Connectivity", "Accessibility Problems", "Other"
            ],
            ml_hint if ml_hint else "Other"
        )
        
        return result
        
    except EnvironmentError as e:
        return _empty_result(f"API Key Error: {e}")
    except json.JSONDecodeError:
        return _empty_result(
            "LLM returned invalid JSON - retrying might help"
        )
    except Exception as e:
        return _empty_result(f"LLM call failed: {str(e)}")


# ═══════════════════════════════════════════════════════════════
#  HELPER FUNCTIONS
# ═══════════════════════════════════════════════════════════════

def _normalize(value: str, valid_options: list[str], default: str) -> str:
    """
    Normalize a value to match valid options (case-insensitive).
    Falls back to default if no match.
    """
    for option in valid_options:
        if option.lower() == value.strip().lower():
            return option
    return default


def _empty_result(reason: str) -> Dict[str, any]:
    """
    Create an empty result dict with error message.
    Used when analysis fails.
    """
    return {
        "pain_point": reason,
        "category": "Other",
        "severity": "Low",
        "emotion": "Neutral",
        "root_cause": "Could not determine",
        "solution": "Could not determine",
        "feature_suggestion": "Could not determine",
        "error": True
    }