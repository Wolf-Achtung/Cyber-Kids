import requests
import sys
import json
from datetime import datetime

class CyberGuardAPITester:
    def __init__(self, base_url="https://cybershield-41.preview.emergentagent.com"):
        self.base_url = base_url
        self.api_url = f"{base_url}/api"
        self.tests_run = 0
        self.tests_passed = 0
        self.failed_tests = []

    def run_test(self, name, method, endpoint, expected_status, data=None, validate_func=None):
        """Run a single API test"""
        url = f"{self.api_url}/{endpoint}"
        headers = {'Content-Type': 'application/json'}

        self.tests_run += 1
        print(f"\n🔍 Testing {name}...")
        print(f"   URL: {url}")
        
        try:
            if method == 'GET':
                response = requests.get(url, headers=headers, timeout=30)
            elif method == 'POST':
                response = requests.post(url, json=data, headers=headers, timeout=30)

            print(f"   Status: {response.status_code}")
            
            success = response.status_code == expected_status
            response_data = {}
            
            if success:
                try:
                    response_data = response.json()
                    print(f"   Response: {json.dumps(response_data, indent=2)[:200]}...")
                    
                    # Additional validation if provided
                    if validate_func:
                        validation_result = validate_func(response_data)
                        if not validation_result:
                            success = False
                            print(f"   ❌ Validation failed")
                        else:
                            print(f"   ✅ Validation passed")
                            
                except Exception as e:
                    print(f"   ⚠️  Could not parse JSON: {e}")
                    response_data = {"raw_response": response.text[:200]}

            if success:
                self.tests_passed += 1
                print(f"✅ {name} - PASSED")
            else:
                print(f"❌ {name} - FAILED (Expected {expected_status}, got {response.status_code})")
                self.failed_tests.append({
                    'name': name,
                    'expected': expected_status,
                    'actual': response.status_code,
                    'response': response.text[:500]
                })

            return success, response_data

        except Exception as e:
            print(f"❌ {name} - ERROR: {str(e)}")
            self.failed_tests.append({
                'name': name,
                'error': str(e)
            })
            return False, {}

    def validate_health_response(self, data):
        """Validate health endpoint response"""
        required_fields = ['status', 'mongo', 'llm_ready']
        for field in required_fields:
            if field not in data:
                print(f"   Missing field: {field}")
                return False
        
        if data['status'] != 'ok':
            print(f"   Status not ok: {data['status']}")
            return False
            
        if not isinstance(data['mongo'], bool):
            print(f"   Mongo field not boolean: {data['mongo']}")
            return False
            
        if not isinstance(data['llm_ready'], bool):
            print(f"   LLM ready field not boolean: {data['llm_ready']}")
            return False
            
        return True

    def validate_classification_response(self, data):
        """Validate classification endpoint response"""
        required_fields = ['risk_categories', 'overall_risk_score', 'suggested_reply']
        for field in required_fields:
            if field not in data:
                print(f"   Missing field: {field}")
                return False
        
        # Check risk categories
        if not isinstance(data['risk_categories'], list) or len(data['risk_categories']) == 0:
            print(f"   Risk categories should be non-empty list")
            return False
            
        # Check overall risk score
        score = data['overall_risk_score']
        if not isinstance(score, (int, float)) or score < 0 or score > 1:
            print(f"   Overall risk score should be between 0 and 1: {score}")
            return False
            
        # Check suggested reply
        if not isinstance(data['suggested_reply'], str) or len(data['suggested_reply'].strip()) == 0:
            print(f"   Suggested reply should be non-empty string")
            return False
            
        return True

    def validate_guides_response(self, data):
        """Validate guides endpoint response"""
        if not isinstance(data, list):
            print(f"   Guides should be a list")
            return False
            
        for guide in data:
            # Check no MongoDB _id leaked
            if '_id' in guide:
                print(f"   Found MongoDB _id in guide: {guide}")
                return False
                
            required_fields = ['id', 'title', 'sections']
            for field in required_fields:
                if field not in guide:
                    print(f"   Missing field in guide: {field}")
                    return False
                    
            if not isinstance(guide['sections'], list):
                print(f"   Guide sections should be a list")
                return False
                
        return True

    def validate_report_response(self, data):
        """Validate report creation response"""
        required_fields = ['id', 'created_at']
        for field in required_fields:
            if field not in data:
                print(f"   Missing field: {field}")
                return False
        return True

    def validate_scenarios_response(self, data):
        """Validate simulator scenarios response"""
        if not isinstance(data, list):
            print(f"   Scenarios should be a list")
            return False
            
        for scenario in data:
            # Check no MongoDB _id leaked
            if '_id' in scenario:
                print(f"   Found MongoDB _id in scenario: {scenario}")
                return False
                
            # Check for human-readable ampersands (not &amp;)
            for field in ['title', 'message']:
                if field in scenario and '&amp;' in str(scenario[field]):
                    print(f"   Found HTML entity &amp; in {field}: {scenario[field]}")
                    return False
                    
        return True

    def validate_status_response(self, data):
        """Validate status endpoint response (no ObjectId leakage)"""
        if not isinstance(data, list):
            print(f"   Status should be a list")
            return False
            
        for item in data:
            if '_id' in item:
                print(f"   Found MongoDB _id in status: {item}")
                return False
        return True

def main():
    print("🚀 Starting CyberGuard Kids API Tests")
    print("=" * 50)
    
    tester = CyberGuardAPITester()
    
    # Test 1: Health endpoint
    tester.run_test(
        "Health Check",
        "GET",
        "health",
        200,
        validate_func=tester.validate_health_response
    )
    
    # Test 2: Classification with risky German text
    risky_text = "Schick mir bitte ein Foto und sag mir wie alt du bist. Sag deinen Eltern nichts."
    tester.run_test(
        "Chat-Check Classification",
        "POST",
        "classify",
        200,
        data={"text": risky_text},
        validate_func=tester.validate_classification_response
    )
    
    # Test 3: Guides endpoint
    tester.run_test(
        "Lernhub Guides",
        "GET",
        "guides",
        200,
        validate_func=tester.validate_guides_response
    )
    
    # Test 4: Anonymous report
    tester.run_test(
        "Anonymous Report",
        "POST",
        "reports",
        200,
        data={
            "text": "Unbekannte Person fragt nach Adresse und will sich treffen.",
            "contact": "kid@example.com"
        },
        validate_func=tester.validate_report_response
    )
    
    # Test 5: Simulator scenarios
    tester.run_test(
        "Simulator Scenarios",
        "GET",
        "simulator/scenarios",
        200,
        validate_func=tester.validate_scenarios_response
    )
    
    # Test 6: Status endpoint (regression test for ObjectId)
    tester.run_test(
        "Status Endpoint (ObjectId Regression)",
        "GET",
        "status",
        200,
        validate_func=tester.validate_status_response
    )
    
    # Test 7: Root API endpoint
    tester.run_test(
        "Root API Endpoint",
        "GET",
        "",
        200
    )
    
    # Print final results
    print("\n" + "=" * 50)
    print("📊 TEST RESULTS")
    print("=" * 50)
    print(f"Tests run: {tester.tests_run}")
    print(f"Tests passed: {tester.tests_passed}")
    print(f"Tests failed: {len(tester.failed_tests)}")
    
    if tester.failed_tests:
        print("\n❌ FAILED TESTS:")
        for i, test in enumerate(tester.failed_tests, 1):
            print(f"{i}. {test['name']}")
            if 'error' in test:
                print(f"   Error: {test['error']}")
            else:
                print(f"   Expected: {test['expected']}, Got: {test['actual']}")
                print(f"   Response: {test['response']}")
    
    success_rate = (tester.tests_passed / tester.tests_run) * 100 if tester.tests_run > 0 else 0
    print(f"\n✅ Success Rate: {success_rate:.1f}%")
    
    return 0 if len(tester.failed_tests) == 0 else 1

if __name__ == "__main__":
    sys.exit(main())