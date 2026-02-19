#!/usr/bin/env python3
"""Test the PainPoint AI API endpoints"""

import json
import urllib.request
import sys
import os

# Set UTF-8 encoding for output
os.environ['PYTHONIOENCODING'] = 'utf-8'
if sys.stdout.encoding != 'utf-8':
    import io
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')

def test_health():
    """Test health endpoint"""
    print("=" * 60)
    print("📋 Testing /api/health endpoint")
    print("=" * 60)
    
    url = "http://localhost:8000/api/health"
    try:
        with urllib.request.urlopen(url, timeout=10) as response:
            result = json.loads(response.read().decode())
            print(json.dumps(result, indent=2))
            print("✅ Health check PASSED\n")
            return True
    except Exception as e:
        print(f"❌ Error: {e}\n")
        return False

def test_single_analysis():
    """Test single feedback analysis"""
    print("=" * 60)
    print("📊 Testing /api/analyse-single endpoint")
    print("=" * 60)
    
    feedback = {
        "feedback": "Payment failed but money was deducted. No refund after 5 days."
    }
    
    url = "http://localhost:8000/api/analyse-single"
    data = json.dumps(feedback).encode()
    req = urllib.request.Request(
        url, 
        data=data, 
        headers={"Content-Type": "application/json"}, 
        method="POST"
    )
    
    try:
        with urllib.request.urlopen(req, timeout=30) as response:
            result = json.loads(response.read().decode())
            print(f"Input: {feedback['feedback']}\n")
            print("Response:")
            print(json.dumps(result, indent=2))
            
            if result.get("success"):
                print("\n✅ Single analysis PASSED")
            else:
                print("\n⚠️  Analysis completed but success=false")
            print()
            return True
    except Exception as e:
        print(f"❌ Error: {e}\n")
        return False

def main():
    print("\n🔮 PainPoint AI - API Test Suite")
    print("================================\n")
    
    results = []
    results.append(("Health Check", test_health()))
    results.append(("Single Analysis", test_single_analysis()))
    
    print("=" * 60)
    print("📊 TEST SUMMARY")
    print("=" * 60)
    for test_name, passed in results:
        status = "✅ PASSED" if passed else "❌ FAILED"
        print(f"{test_name}: {status}")
    
    all_passed = all(r[1] for r in results)
    if all_passed:
        print("\n🎉 All tests PASSED! Backend is working correctly.")
    else:
        print("\n⚠️  Some tests failed. Check errors above.")
    
    return 0 if all_passed else 1

if __name__ == "__main__":
    sys.exit(main())
