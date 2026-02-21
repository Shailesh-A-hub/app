#!/usr/bin/env python3
"""
DPDP Shield Backend API Testing
Tests all major endpoints for the incident response command center
"""

import requests
import json
import time
from datetime import datetime

class DPDPShieldTester:
    def __init__(self):
        self.base_url = "https://incident-command-6.preview.emergentagent.com/api"
        self.token = None
        self.session_id = None
        self.tests_run = 0
        self.tests_passed = 0
        self.results = []
        self.admin_email = "Dpdp210226@gmail.com"
        self.admin_password = "...sarvesh01"

    def log_result(self, test_name, success, response_code=None, error=None, details=None):
        """Log test result"""
        self.tests_run += 1
        if success:
            self.tests_passed += 1
            print(f"✅ {test_name} - PASSED")
        else:
            print(f"❌ {test_name} - FAILED ({response_code}) - {error}")
        
        self.results.append({
            "test": test_name,
            "success": success,
            "status_code": response_code,
            "error": error,
            "details": details
        })

    def make_request(self, method, endpoint, data=None, expected_status=200):
        """Make HTTP request with proper headers"""
        url = f"{self.base_url}/{endpoint}"
        headers = {'Content-Type': 'application/json'}
        if self.token:
            headers['Authorization'] = f'Bearer {self.token}'

        try:
            if method == 'GET':
                response = requests.get(url, headers=headers, timeout=10)
            elif method == 'POST':
                response = requests.post(url, json=data, headers=headers, timeout=10)
            elif method == 'PUT':
                response = requests.put(url, json=data, headers=headers, timeout=10)
            elif method == 'DELETE':
                response = requests.delete(url, headers=headers, timeout=10)

            success = response.status_code == expected_status
            response_data = {}
            try:
                response_data = response.json()
            except:
                response_data = {"raw_text": response.text}

            return success, response.status_code, response_data

        except Exception as e:
            return False, None, {"error": str(e)}

    def test_auth_login(self):
        """Test admin authentication"""
        success, status, data = self.make_request('POST', 'auth/login', {
            "email": self.admin_email,
            "password": self.admin_password
        })
        
        if success and 'token' in data:
            self.token = data['token']
            self.session_id = data.get('session_id')
            self.log_result("Admin Login", True, status, details=f"Token received, session: {self.session_id}")
            return True
        else:
            self.log_result("Admin Login", False, status, data.get('detail', 'No token in response'))
            return False

    def test_dashboard_stats(self):
        """Test dashboard stats endpoint"""
        success, status, data = self.make_request('GET', 'dashboard/stats')
        
        if success:
            expected_customers = 30
            expected_reports = 2
            customers_ok = data.get('total_customers') == expected_customers
            reports_ok = data.get('total_reports') >= expected_reports
            
            details = f"Customers: {data.get('total_customers')} (expected {expected_customers}), Reports: {data.get('total_reports')} (expected >= {expected_reports})"
            self.log_result("Dashboard Stats", customers_ok and reports_ok, status, details=details)
            return customers_ok and reports_ok
        else:
            self.log_result("Dashboard Stats", False, status, "Failed to fetch stats")
            return False

    def test_customers_crud(self):
        """Test customer CRUD operations"""
        # Test GET customers
        success, status, data = self.make_request('GET', 'customers')
        if not success:
            self.log_result("Get Customers", False, status, "Failed to fetch customers")
            return False
        
        customers = data if isinstance(data, list) else []
        if len(customers) < 30:
            self.log_result("Get Customers", False, status, f"Expected 30+ customers, got {len(customers)}")
            return False
        
        self.log_result("Get Customers", True, status, details=f"Retrieved {len(customers)} customers")
        
        # Test CREATE customer
        test_customer = {
            "name": "Test Customer API",
            "email": "test.api@example.com",
            "phone": "+91-9999999999"
        }
        success, status, data = self.make_request('POST', 'customers', test_customer, 200)
        if success and 'customer_id' in data:
            customer_id = data['customer_id']
            self.log_result("Create Customer", True, status, details=f"Created customer {customer_id}")
            
            # Test UPDATE customer
            update_data = {"name": "Updated Test Customer"}
            success, status, data = self.make_request('PUT', f'customers/{customer_id}', update_data)
            if success:
                self.log_result("Update Customer", True, status, details=f"Updated customer {customer_id}")
                
                # Test DELETE customer
                success, status, data = self.make_request('DELETE', f'customers/{customer_id}')
                if success:
                    self.log_result("Delete Customer", True, status, details=f"Deleted customer {customer_id}")
                    return True
                else:
                    self.log_result("Delete Customer", False, status, "Failed to delete customer")
            else:
                self.log_result("Update Customer", False, status, "Failed to update customer")
        else:
            self.log_result("Create Customer", False, status, "Failed to create customer")
        
        return False

    def test_breach_workflow(self):
        """Test breach management workflow"""
        # Get initial breach status
        success, status, data = self.make_request('GET', 'breach/status')
        if not success:
            self.log_result("Get Breach Status", False, status, "Failed to get breach status")
            return False
        
        self.log_result("Get Breach Status", True, status, details=f"Breach active: {data.get('active', False)}")
        
        # If breach is already active, reset it first
        if data.get('active'):
            success, status, _ = self.make_request('POST', 'breach/reset')
            if success:
                print("Reset existing breach")
                time.sleep(1)
        
        # Test trigger breach
        breach_data = {
            "nature": "Test API breach",
            "systems": "Test Database",
            "categories": "Test Data",
            "affected_count": 5,
            "description": "API test breach scenario"
        }
        success, status, data = self.make_request('POST', 'breach/trigger', breach_data)
        if success and 'incident_id' in data:
            incident_id = data['incident_id']
            self.log_result("Trigger Breach", True, status, details=f"Created incident {incident_id}")
            
            # Test containment
            success, status, _ = self.make_request('POST', 'breach/contain')
            if success:
                self.log_result("Confirm Containment", True, status)
                
                # Test DPB notice generation
                success, status, data = self.make_request('POST', 'breach/dpb-notice')
                if success and 'filename' in data:
                    self.log_result("Generate DPB Notice", True, status, details=f"Generated {data['filename']}")
                    
                    # Test user notifications
                    success, status, data = self.make_request('POST', 'breach/notify-users', {"channel": "EMAIL"})
                    if success:
                        count = data.get('count', 0)
                        self.log_result("Notify Users", True, status, details=f"Notified {count} users")
                        
                        # Test close incident
                        success, status, data = self.make_request('POST', 'breach/close')
                        if success and 'filename' in data:
                            self.log_result("Close Incident", True, status, details=f"Generated audit report {data['filename']}")
                            return True
                        else:
                            self.log_result("Close Incident", False, status, "Failed to close incident")
                    else:
                        self.log_result("Notify Users", False, status, "Failed to notify users")
                else:
                    self.log_result("Generate DPB Notice", False, status, "Failed to generate DPB notice")
            else:
                self.log_result("Confirm Containment", False, status, "Failed to confirm containment")
        else:
            self.log_result("Trigger Breach", False, status, "Failed to trigger breach")
        
        return False

    def test_attack_vector(self):
        """Test attack vector analysis"""
        success, status, data = self.make_request('GET', 'attack-vector')
        if success and 'api_signals' in data and 'email_signals' in data:
            api_count = len(data.get('api_signals', []))
            email_count = len(data.get('email_signals', []))
            self.log_result("Get Attack Vector", True, status, details=f"API signals: {api_count}, Email signals: {email_count}")
            
            # Test vector PDF generation
            success, status, data = self.make_request('POST', 'attack-vector/pdf')
            if success and 'filename' in data:
                self.log_result("Generate Vector PDF", True, status, details=f"Generated {data['filename']}")
                return True
            else:
                self.log_result("Generate Vector PDF", False, status, "Failed to generate vector PDF")
        else:
            self.log_result("Get Attack Vector", False, status, "Invalid attack vector response")
        
        return False

    def test_settings(self):
        """Test settings management"""
        # Get settings
        success, status, data = self.make_request('GET', 'settings')
        if success:
            self.log_result("Get Settings", True, status, details=f"Theme: {data.get('theme', 'unknown')}")
            
            # Test update settings
            update_data = {
                "sim_leaked_api_key": True,
                "sim_mailbox_forwarding": False
            }
            success, status, _ = self.make_request('PUT', 'settings', update_data)
            if success:
                self.log_result("Update Settings", True, status, details="Updated simulation toggles")
                return True
            else:
                self.log_result("Update Settings", False, status, "Failed to update settings")
        else:
            self.log_result("Get Settings", False, status, "Failed to get settings")
        
        return False

    def test_reports(self):
        """Test reports endpoints"""
        success, status, data = self.make_request('GET', 'reports')
        if success:
            reports = data if isinstance(data, list) else []
            self.log_result("Get Reports", True, status, details=f"Retrieved {len(reports)} reports")
            return True
        else:
            self.log_result("Get Reports", False, status, "Failed to get reports")
            return False

    def test_evidence(self):
        """Test evidence endpoints"""
        # Test timeline
        success, status, data = self.make_request('GET', 'evidence/timeline')
        if success:
            timeline_count = len(data.get('timeline', []))
            reports_count = data.get('reports_count', 0)
            self.log_result("Evidence Timeline", True, status, details=f"Timeline: {timeline_count} events, Reports: {reports_count}")
            
            # Test encryption demo
            success, status, data = self.make_request('GET', 'evidence/encryption-demo')
            if success and 'raw' in data and 'decrypted' in data:
                raw_count = len(data.get('raw', []))
                decrypted_count = len(data.get('decrypted', []))
                self.log_result("Encryption Demo", True, status, details=f"Raw: {raw_count}, Decrypted: {decrypted_count}")
                return True
            else:
                self.log_result("Encryption Demo", False, status, "Invalid encryption demo response")
        else:
            self.log_result("Evidence Timeline", False, status, "Failed to get evidence timeline")
        
        return False

    def test_pdf_generation(self):
        """Test standalone PDF generation"""
        success, status, data = self.make_request('POST', 'pdf/audit-report')
        if success and 'filename' in data:
            filename = data['filename']
            self.log_result("Generate Audit PDF", True, status, details=f"Generated {filename}")
            
            # Test PDF download
            try:
                pdf_url = f"{self.base_url}/pdf/{filename}"
                headers = {'Authorization': f'Bearer {self.token}'} if self.token else {}
                response = requests.get(pdf_url, headers=headers, timeout=10)
                if response.status_code == 200 and response.headers.get('content-type') == 'application/pdf':
                    self.log_result("Download PDF", True, 200, details=f"Downloaded {len(response.content)} bytes")
                    return True
                else:
                    self.log_result("Download PDF", False, response.status_code, "PDF download failed")
            except Exception as e:
                self.log_result("Download PDF", False, None, str(e))
        else:
            self.log_result("Generate Audit PDF", False, status, "Failed to generate audit PDF")
        
        return False

    def test_logout(self):
        """Test logout functionality"""
        if self.session_id:
            success, status, _ = self.make_request('POST', 'auth/logout', {"session_id": self.session_id})
            self.log_result("Admin Logout", success, status)
            return success
        return True

    def run_all_tests(self):
        """Run comprehensive backend test suite"""
        print("🔥 DPDP Shield Backend API Testing")
        print("=" * 50)
        
        # Test authentication first
        if not self.test_auth_login():
            print("❌ Authentication failed - stopping tests")
            return self.print_summary()
        
        # Run all tests
        test_methods = [
            self.test_dashboard_stats,
            self.test_customers_crud,
            self.test_breach_workflow,
            self.test_attack_vector,
            self.test_settings,
            self.test_reports,
            self.test_evidence,
            self.test_pdf_generation,
        ]
        
        for test_method in test_methods:
            try:
                test_method()
                time.sleep(0.5)  # Brief pause between tests
            except Exception as e:
                print(f"❌ {test_method.__name__} - EXCEPTION: {str(e)}")
        
        # Test logout
        self.test_logout()
        
        return self.print_summary()

    def print_summary(self):
        """Print test summary"""
        print("\n" + "=" * 50)
        print(f"📊 Test Summary: {self.tests_passed}/{self.tests_run} tests passed")
        print(f"Success Rate: {(self.tests_passed/self.tests_run*100):.1f}%" if self.tests_run > 0 else "No tests run")
        
        failed_tests = [r for r in self.results if not r['success']]
        if failed_tests:
            print(f"\n❌ Failed Tests ({len(failed_tests)}):")
            for test in failed_tests:
                print(f"  - {test['test']}: {test['error']}")
        
        return self.tests_passed == self.tests_run

if __name__ == "__main__":
    tester = DPDPShieldTester()
    success = tester.run_all_tests()
    exit(0 if success else 1)