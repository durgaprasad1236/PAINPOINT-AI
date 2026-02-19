"""
insight_engine.py
-----------------
Intelligence aggregation and priority scoring engine.

This module transforms individual analysis results into business intelligence:

1. Priority Scoring: Frequency × Severity
   - Identifies which issues need IMMEDIATE attention
   - Not just "how many" but "how many × how critical"

2. Executive Summary Generation
   - Auto-generates management-level insights
   - No manual report writing needed

3. Statistical Aggregations
   - Category distribution
   - Severity breakdown  
   - Emotion analysis
   - Top issues ranking

This is what makes the system a DECISION INTELLIGENCE platform,
not just an analysis tool.
"""

from collections import Counter
from typing import Dict, List

import numpy as np
import pandas as pd


# ═══════════════════════════════════════════════════════════════
#  SEVERITY SCORING
# ═══════════════════════════════════════════════════════════════

SEVERITY_SCORE: Dict[str, int] = {
    "Low": 1,
    "Medium": 2,
    "High": 3
}


# ═══════════════════════════════════════════════════════════════
#  DATAFRAME CONSTRUCTION
# ═══════════════════════════════════════════════════════════════

def build_dataframe(results: List[Dict]) -> pd.DataFrame:
    """
    Convert list of analysis results into a structured Pandas DataFrame.
    
    Adds a numeric severity_score column for calculations.
    
    Args:
        results: List of dicts from the analysis pipeline
        
    Returns:
        DataFrame with all results plus severity_score column
    """
    df = pd.DataFrame(results)
    
    # Ensure required columns exist
    required = [
        "ml_suggested_category", "severity", "emotion", "pain_point",
        "root_cause", "solution", "feature_suggestion",
        "ml_sentiment", "original_feedback"
    ]
    for col in required:
        if col not in df.columns:
            df[col] = "Unknown"
    
    # For backward compatibility, create a 'category' alias to ml_suggested_category
    if "category" not in df.columns and "ml_suggested_category" in df.columns:
        df["category"] = df["ml_suggested_category"]
    
    # Add numeric severity score
    df["severity_score"] = (
        df["severity"]
        .map(SEVERITY_SCORE)
        .fillna(1)
        .astype(int)
    )
    
    return df


# ═══════════════════════════════════════════════════════════════
#  PRIORITY SCORING ENGINE
# ═══════════════════════════════════════════════════════════════

def calculate_priority(df: pd.DataFrame) -> List[Dict]:
    """
    Calculate Priority Score = Frequency × Average Severity per category.
    
    This is THE KEY METRIC for decision-making.
    
    Example:
    - Payment: 50 issues × 2.8 severity = 140 priority
    - UI: 80 issues × 1.2 severity = 96 priority
    
    → Fix Payment FIRST even though UI has more issues!
    
    Args:
        df: DataFrame with analysis results
        
    Returns:
        List of dicts sorted by priority_score descending:
        [{
          category: str,
          frequency: int,
          avg_severity: float,
          priority_score: float,
          severity_label: str (Critical/High/Medium/Low)
        }, ...]
    """
    grouped = (
        df.groupby("category")
        .agg(
            frequency=("category", "count"),
            avg_severity=("severity_score", "mean")
        )
        .reset_index()
    )
    
    # Calculate priority score
    grouped["priority_score"] = (
        grouped["frequency"] * grouped["avg_severity"]
    ).round(2)
    
    # Sort by priority descending
    grouped = grouped.sort_values("priority_score", ascending=False).reset_index(drop=True)
    
    # Assign human-readable severity labels
    if not grouped.empty:
        max_score = grouped["priority_score"].max()
        
        def _label(score: float) -> str:
            ratio = score / max_score if max_score > 0 else 0
            if ratio >= 0.75:
                return "Critical"
            elif ratio >= 0.50:
                return "High"
            elif ratio >= 0.25:
                return "Medium"
            return "Low"
        
        grouped["severity_label"] = grouped["priority_score"].apply(_label)
    else:
        grouped["severity_label"] = "Low"
    
    grouped["avg_severity"] = grouped["avg_severity"].round(2)
    
    return grouped.to_dict(orient="records")


# ═══════════════════════════════════════════════════════════════
#  DISTRIBUTION ANALYSIS
# ═══════════════════════════════════════════════════════════════

def emotion_distribution(df: pd.DataFrame) -> List[Dict]:
    """
    Count and percentify emotion occurrences.
    
    Returns:
        List of {emotion, count, percentage} sorted by count descending
    """
    counts = Counter(df["emotion"].tolist())
    total = sum(counts.values()) or 1
    
    return [
        {
            "emotion": emotion,
            "count": count,
            "percentage": round(count / total * 100, 1)
        }
        for emotion, count in sorted(counts.items(), key=lambda x: -x[1])
    ]


def severity_distribution(df: pd.DataFrame) -> List[Dict]:
    """
    Count and percentify severity levels.
    
    Returns:
        List of {severity, count, percentage} in High → Low order
    """
    counts = Counter(df["severity"].tolist())
    total = sum(counts.values()) or 1
    order = ["High", "Medium", "Low"]
    
    return [
        {
            "severity": sev,
            "count": counts.get(sev, 0),
            "percentage": round(counts.get(sev, 0) / total * 100, 1)
        }
        for sev in order
    ]


# ═══════════════════════════════════════════════════════════════
#  TOP ISSUES EXTRACTION
# ═══════════════════════════════════════════════════════════════

def top_issues(df: pd.DataFrame, n: int = 5) -> List[Dict]:
    """
    Extract top-n most critical individual feedback items.
    
    Ranked by severity_score (High severity items first).
    
    Args:
        df: Results DataFrame
        n: Number of top issues to return
        
    Returns:
        List of top issue dicts with key fields
    """
    top = (
        df.sort_values("severity_score", ascending=False)
        .head(n)[
            [
                "original_feedback",
                "category",
                "severity",
                "emotion",
                "pain_point",
                "solution"
            ]
        ]
        .fillna("N/A")
    )
    return top.to_dict(orient="records")


# ═══════════════════════════════════════════════════════════════
#  SUMMARY STATISTICS
# ═══════════════════════════════════════════════════════════════

def summary_stats(df: pd.DataFrame) -> Dict:
    """
    Compute high-level summary statistics for dashboard.
    
    Returns:
        Dict with:
        - total_feedback: int
        - high_severity_count: int
        - high_severity_percentage: float
        - top_category: str
        - top_emotion: str
        - average_severity_score: float
    """
    total = len(df)
    high_count = int((df["severity"] == "High").sum())
    
    top_category = df["category"].mode()[0] if not df.empty else "N/A"
    top_emotion = df["emotion"].mode()[0] if not df.empty else "N/A"
    avg_severity = round(df["severity_score"].mean(), 2) if not df.empty else 0
    
    return {
        "total_feedback": total,
        "high_severity_count": high_count,
        "high_severity_percentage": round(high_count / total * 100, 1) if total else 0,
        "top_category": top_category,
        "top_emotion": top_emotion,
        "average_severity_score": avg_severity
    }


# ═══════════════════════════════════════════════════════════════
#  EXECUTIVE SUMMARY GENERATION
# ═══════════════════════════════════════════════════════════════

def generate_executive_summary(
    stats: Dict,
    priority_data: List[Dict],
    emotion_data: List[Dict]
) -> str:
    """
    Auto-generate plain-English executive summary.
    
    This is the "one-page brief" for management.
    No LLM required - uses rule-based template generation.
    
    Args:
        stats: Summary statistics dict
        priority_data: Priority scores list
        emotion_data: Emotion distribution list
        
    Returns:
        Multi-line executive summary string
    """
    total = stats["total_feedback"]
    high_pct = stats["high_severity_percentage"]
    top_cat = stats["top_category"]
    top_emo = stats["top_emotion"]
    
    top_priority = priority_data[0] if priority_data else {}
    second_priority = priority_data[1] if len(priority_data) > 1 else {}
    
    lines = [
        f"📊 EXECUTIVE INTELLIGENCE SUMMARY",
        f"",
        f"Analysis of {total} customer feedback items reveals the following key insights:",
        f"",
        f"🎯 PRIORITY AREAS",
    ]
    
    if top_priority:
        lines.append(
            f"• #{1} CRITICAL: {top_priority['category']} "
            f"({top_priority['frequency']} occurrences, "
            f"avg severity {top_priority['avg_severity']}/3, "
            f"priority score {top_priority['priority_score']}) — "
            f"Status: {top_priority['severity_label']}"
        )
    
    if second_priority:
        lines.append(
            f"• #{2} HIGH: {second_priority['category']} "
            f"(priority score {second_priority['priority_score']})"
        )
    
    lines += [
        f"",
        f"⚠️  SEVERITY ANALYSIS",
        f"• {high_pct}% of feedback classified as HIGH severity",
        f"• Requires immediate product/engineering attention",
        f"",
        f"😤 CUSTOMER EMOTION",
        f"• Dominant emotion detected: {top_emo}",
        f"• {'Urgent intervention needed' if top_emo in ['Anger', 'Frustration'] else 'Manageable dissatisfaction level'}",
        f"",
        f"💡 RECOMMENDATIONS",
        f"1. Prioritize fixing {top_cat} issues immediately",
        f"2. Address root causes, not just symptoms",
        f"3. Implement automated monitoring for early detection",
        f"4. Deploy product improvements from AI-generated feature suggestions",
    ]
    
    return "\n".join(lines)