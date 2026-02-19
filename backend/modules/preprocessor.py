"""
preprocessor.py
---------------
Text preprocessing and cleaning module for PainPoint AI.

This module handles all text normalization before LLM analysis:
- HTML/XML tag removal
- URL removal  
- Special character cleaning
- Whitespace normalization
- Input validation
"""

import re
from typing import List


def preprocess_text(text: str) -> str:
    """
    Clean and normalize a single feedback text string.
    
    Steps performed:
    1. Type validation and empty string handling
    2. HTML/XML tag removal
    3. URL removal
    4. Special character cleaning (keep letters, digits, basic punctuation)
    5. Multiple whitespace collapse
    6. Trim leading/trailing whitespace
    
    Args:
        text: Raw feedback string from user
        
    Returns:
        Cleaned and normalized text string, or empty string if invalid
        
    Examples:
        >>> preprocess_text("<p>Great app!</p>")
        'Great app!'
        
        >>> preprocess_text("Check out https://example.com for more")
        'Check out  for more'
    """
    # Guard clause: validate input
    if not isinstance(text, str) or not text.strip():
        return ""
    
    # Remove HTML/XML tags
    text = re.sub(r"<[^>]+>", " ", text)
    
    # Remove URLs
    text = re.sub(r"https?://\S+|www\.\S+", "", text)
    
    # Remove email addresses
    text = re.sub(r"\S+@\S+", "", text)
    
    # Keep only: letters, digits, spaces, and basic punctuation
    text = re.sub(r"[^\w\s.,!?'\"-]", " ", text)
    
    # Collapse multiple whitespace into single space
    text = re.sub(r"\s+", " ", text)
    
    # Remove leading/trailing whitespace
    text = text.strip()
    
    return text


def preprocess_batch(texts: List[str]) -> List[str]:
    """
    Apply preprocessing to a batch of feedback texts.
    
    Args:
        texts: List of raw feedback strings
        
    Returns:
        List of cleaned strings (invalid inputs become empty strings)
        
    Example:
        >>> preprocess_batch(["<b>Good</b>", "Bad app", ""])
        ['Good', 'Bad app', '']
    """
    return [preprocess_text(t) for t in texts]


def validate_feedback_list(texts: List[str], min_length: int = 3) -> List[str]:
    """
    Filter out invalid feedback entries.
    
    Args:
        texts: List of cleaned feedback strings
        min_length: Minimum character count to be valid (default: 3)
        
    Returns:
        List of valid feedback strings only
    """
    return [t for t in texts if len(t.strip()) >= min_length]