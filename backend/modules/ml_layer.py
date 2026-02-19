"""
ml_layer.py
-----------
Traditional ML pre-analysis layer using TextBlob and keyword matching.

This module runs BEFORE the LLM to provide:
1. Fast sentiment analysis (Positive/Negative/Neutral)
2. Initial category suggestion based on keywords
3. Confidence scores for category prediction

This hybrid approach (ML + LLM) provides:
- Speed: ML gives instant results
- Depth: LLM provides reasoning and solutions
- Validation: Cross-check between ML and LLM outputs
"""

from textblob import TextBlob
from typing import Dict, List


# ═══════════════════════════════════════════════════════════════
#  CATEGORY KEYWORD MAPPINGS - 19 CATEGORIES
# ═══════════════════════════════════════════════════════════════

CATEGORY_KEYWORDS: Dict[str, List[str]] = {
    "Payments & Billing": [
        "payment", "pay", "paid", "billing", "bill", "invoice",
        "price", "cost", "fee", "transaction", "purchase"
    ],
    
    "Refund & Charges": [
        "refund", "refunded", "refundable", "money back", "charge back", "chargeback",
        "double charge", "charged twice", "unexpected charge", "unauthorized charge",
        "deducted", "withdrawal", "return money"
    ],
    
    "Subscription Issues": [
        "subscription", "cancel", "cancel subscription", "unsubscribe", "cancel membership",
        "renew", "renewal", "recurring", "auto-renew", "premium", "plan",
        "upgrade", "downgrade", "membership", "expired"
    ],
    
    "Login & Authentication": [
        "login", "sign in", "sign up", "password", "authentication", "verify",
        "verification code", "two factor", "2fa", "mfa", "cannot login", "cant login",
        "login failed", "password reset", "forgot password", "username", "credentials"
    ],
    
    "Account Management": [
        "profile", "account settings", "personal information", "change email",
        "update profile", "account deletion", "delete account", "account preferences"
    ],
    
    "App Performance / Speed": [
        "slow", "speed", "lag", "lagging", "latency", "takes forever", "slow loading",
        "sluggish", "performance", "fast", "slow app", "optimization", "speedup"
    ],
    
    "Bugs & Errors / Crashes": [
        "crash", "crashed", "crashing", "error", "bug", "glitch", "exception",
        "not working", "broken", "fails", "failed", "error message", "404", "500"
    ],
    
    "UI / UX Problems": [
        "ui", "user experience", "ux", "design", "button", "display", "layout",
        "layout", "navigation", "menu", "font", "color", "icon", "confusing",
        "hard to find", "difficult to use"
    ],
    
    "Feature Request": [
        "feature", "add", "feature request", "missing", "wish", "want", "wanted",
        "need", "request", "suggestion", "would be nice", "should have",
        "could add", "new feature", "improvement", "would like"
    ],
    
    "Notifications Issues": [
        "notification", "notifications", "alert", "alerts", "email notification",
        "push notification", "message not received", "missed notification",
        "notification settings", "notify"
    ],
    
    "Security & Privacy": [
        "security", "privacy", "hack", "hacked", "breach", "data breach", "stolen",
        "password leaked", "vulnerable", "encryption", "malware", "virus",
        "phishing", "scam", "unsafe", "leaked", "data protection"
    ],
    
    "Customer Support": [
        "support", "customer service", "help", "contact", "response", "reply",
        "agent", "representative", "ticket", "unresponsive", "ignored",
        "email", "chat", "helpdesk", "contact support"
    ],
    
    "Data Sync / Data Loss": [
        "sync", "synchronize", "data loss", "lost data", "data deleted", "sync failed",
        "sync error", "backup", "restore", "recovery", "missing data", "disappeared",
        "lost message", "lost file", "not syncing", "out of sync"
    ],
    
    "Integration / API Issues": [
        "api", "integration", "connect", "webhook", "oauth", "sso", "third party",
        "plugin", "extension", "slack", "zapier", "integration failed", "cannot connect",
        "connection failed"
    ],
    
    "Installation / Update Problems": [
        "install", "installation", "update", "upgrade", "download", "setup",
        "install failed", "install error", "patch", "rollback", "dependency"
    ],
    
    "Compatibility Issues": [
        "compatible", "compatibility", "incompatible", "browser", "device", "os",
        "android", "ios", "windows", "mac", "linux", "version", "not supported"
    ],
    
    "Network / Connectivity": [
        "network", "connection", "internet", "wifi", "offline", "online", "connected",
        "disconnect", "bandwidth", "connectivity", "cannot reach", "no connection"
    ],
    
    "Accessibility Problems": [
        "accessibility", "accessible", "screen reader", "keyboard", "colorblind",
        "color blind", "contrast", "font size", "zoom", "hearing", "deaf", "disability",
        "accessible design", "wcag", "aria"
    ],
}


# ═══════════════════════════════════════════════════════════════
#  SENTIMENT ANALYSIS
# ═══════════════════════════════════════════════════════════════


# ═══════════════════════════════════════════════════════════════
#  SENTIMENT ANALYSIS
# ═══════════════════════════════════════════════════════════════

def get_sentiment(text: str) -> Dict[str, any]:
    """
    Perform sentiment analysis using TextBlob.
    
    Returns polarity (-1.0 to 1.0) and subjectivity (0.0 to 1.0).
    Classifies as Positive, Negative, or Neutral based on polarity threshold.
    
    Args:
        text: Cleaned feedback text
        
    Returns:
        Dict with:
        - sentiment_label: str (Positive/Negative/Neutral)
        - polarity: float (-1.0 to 1.0)
        - subjectivity: float (0.0 to 1.0)
    """
    if not text:
        return {
            "sentiment_label": "Neutral",
            "polarity": 0.0,
            "subjectivity": 0.0
        }
    
    # Analyze with TextBlob
    blob = TextBlob(text)
    polarity = round(blob.sentiment.polarity, 4)
    subjectivity = round(blob.sentiment.subjectivity, 4)
    
    # Classify based on polarity thresholds
    if polarity > 0.1:
        label = "Positive"
    elif polarity < -0.1:
        label = "Negative"
    else:
        label = "Neutral"
    
    return {
        "sentiment_label": label,
        "polarity": polarity,
        "subjectivity": subjectivity
    }


# ═══════════════════════════════════════════════════════════════
#  CATEGORY PREDICTION
# ═══════════════════════════════════════════════════════════════

def get_category(text: str) -> Dict[str, any]:
    """
    Predict category using keyword matching.
    
    Counts keyword matches for each category and returns the best match
    with a confidence score.
    
    Args:
        text: Cleaned feedback text
        
    Returns:
        Dict with:
        - suggested_category: str (category name or "Other")
        - confidence: float (0.0 to 1.0)
    """
    if not text:
        return {"suggested_category": "Other", "confidence": 0.0}
    
    text_lower = text.lower()
    scores: Dict[str, int] = {}
    
    # Count keyword matches for each category
    for category, keywords in CATEGORY_KEYWORDS.items():
        score = sum(1 for keyword in keywords if keyword in text_lower)
        if score > 0:
            scores[category] = score
    
    # No matches found
    if not scores:
        return {"suggested_category": "Other", "confidence": 0.0}
    
    # Find category with highest score
    best_category = max(scores, key=scores.__getitem__)
    total_hits = sum(scores.values())
    confidence = round(scores[best_category] / total_hits, 2)
    
    return {
        "suggested_category": best_category,
        "confidence": confidence
    }


# ═══════════════════════════════════════════════════════════════
#  COMBINED ML ANALYSIS
# ═══════════════════════════════════════════════════════════════

def ml_analyse(text: str) -> Dict[str, any]:
    """
    Run complete ML pre-analysis on a single feedback string.
    
    Combines sentiment analysis and category prediction.
    This runs BEFORE LLM analysis to provide fast initial insights.
    
    Args:
        text: Cleaned feedback text
        
    Returns:
        Dict with:
        - ml_sentiment: str (Positive/Negative/Neutral)
        - ml_polarity: float
        - ml_subjectivity: float
        - ml_suggested_category: str
        - ml_category_confidence: float
    """
    sentiment = get_sentiment(text)
    category = get_category(text)
    
    return {
        "ml_sentiment": sentiment["sentiment_label"],
        "ml_polarity": sentiment["polarity"],
        "ml_subjectivity": sentiment["subjectivity"],
        "ml_suggested_category": category["suggested_category"],
        "ml_category_confidence": category["confidence"]
    }