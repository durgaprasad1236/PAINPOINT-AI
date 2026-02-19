#!/usr/bin/env python3
"""Test automatic category detection with new categories"""

import sys
import os

# Add modules to path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), 'modules'))

from ml_layer import get_category
from preprocessor import preprocess_text

# Test cases showing the 19 categories
test_cases = [
    ("Payment failed but money deducted", "Payments & Billing"),
    ("I was charged twice for my subscription", "Refund & Charges"),
    ("Cannot cancel my membership", "Subscription Issues"),
    ("Cannot login to my account", "Login & Authentication"),
    ("Cannot change my profile email", "Account Management"),
    ("App runs very slow", "App Performance / Speed"),
    ("App keeps crashing when I open it", "Bugs & Errors / Crashes"),
    ("The UI is confusing and hard to navigate", "UI / UX Problems"),
    ("Please add dark mode to the app", "Feature Request"),
    ("I miss important notifications", "Notifications Issues"),
    ("My data was leaked from your servers", "Security & Privacy"),
    ("Customer support never responds to my emails", "Customer Support"),
    ("My messages disappeared and I lost all data", "Data Sync / Data Loss"),
    ("Cannot connect my Slack account", "Integration / API Issues"),
    ("Installation keeps failing with error code", "Installation / Update Problems"),
    ("App doesn't work on my old Android device", "Compatibility Issues"),
    ("No internet connection but app crashes", "Network / Connectivity"),
    ("Cannot use app with screen reader", "Accessibility Problems"),
    ("Something weird happened", "Other"),
]

print("=" * 70)
print("CATEGORY DETECTION TEST SUITE")
print("=" * 70)
print()

passed = 0
failed = 0

for feedback, expected_category in test_cases:
    cleaned = preprocess_text(feedback)
    result = get_category(cleaned)
    detected_category = result["suggested_category"]
    confidence = result["confidence"]
    
    status = "✓" if detected_category == expected_category else "✗"
    if detected_category == expected_category:
        passed += 1
    else:
        failed += 1
    
    print(f"{status} Input: {feedback}")
    print(f"  Expected: {expected_category}")
    print(f"  Detected: {detected_category} (confidence: {confidence})")
    if detected_category != expected_category:
        print(f"  ❌ MISMATCH")
    print()

print("=" * 70)
print(f"RESULTS: {passed} passed, {failed} failed out of {len(test_cases)} tests")
print("=" * 70)

sys.exit(0 if failed == 0 else 1)
