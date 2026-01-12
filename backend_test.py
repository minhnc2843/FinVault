import requests
import sys
import json
from datetime import datetime, timezone
import time

class FinVaultAPITester:
    def __init__(self, base_url="https://money-splitter-5.preview.emergentagent.com/api"):
        self.base_url = base_url
        self.token = None
        self.user_id = None
        self.tests_run = 0
        self.tests_passed = 0
        self.category_id = None
        self.transaction_id = None
        self.shared_expense_id = None
        self.friendship_id = None

    def run_test(self, name, method, endpoint, expected_status, data=None, headers=None):
        """Run a single API test"""
        url = f"{self.base_url}/{endpoint}"
        test_headers = {'Content-Type': 'application/json'}
        
        if self.token:
            test_headers['Authorization'] = f'Bearer {self.token}'
        
        if headers:
            test_headers.update(headers)

        self.tests_run += 1
        print(f"\n🔍 Testing {name}...")
        print(f"   URL: {url}")
        
        try:
            if method == 'GET':
                response = requests.get(url, headers=test_headers, timeout=30)
            elif method == 'POST':
                response = requests.post(url, json=data, headers=test_headers, timeout=30)
            elif method == 'PUT':
                response = requests.put(url, json=data, headers=test_headers, timeout=30)
            elif method == 'DELETE':
                response = requests.delete(url, headers=test_headers, timeout=30)

            success = response.status_code == expected_status
            if success:
                self.tests_passed += 1
                print(f"✅ Passed - Status: {response.status_code}")
                try:
                    return success, response.json()
                except:
                    return success, {}
            else:
                print(f"❌ Failed - Expected {expected_status}, got {response.status_code}")
                try:
                    error_detail = response.json()
                    print(f"   Error: {error_detail}")
                except:
                    print(f"   Error: {response.text}")
                return False, {}

        except Exception as e:
            print(f"❌ Failed - Error: {str(e)}")
            return False, {}

    def test_register(self):
        """Test user registration"""
        timestamp = int(time.time())
        success, response = self.run_test(
            "User Registration",
            "POST",
            "auth/register",
            200,
            data={
                "email": f"test{timestamp}@example.com",
                "password": "test123",
                "full_name": "Nguyễn Văn A"
            }
        )
        if success and 'access_token' in response:
            self.token = response['access_token']
            self.user_id = response['user']['id']
            print(f"   Registered user: {response['user']['email']}")
            return True
        return False

    def test_login(self):
        """Test user login with existing credentials"""
        success, response = self.run_test(
            "User Login",
            "POST",
            "auth/login",
            200,
            data={
                "email": "test@example.com",
                "password": "test123"
            }
        )
        if success and 'access_token' in response:
            self.token = response['access_token']
            self.user_id = response['user']['id']
            print(f"   Logged in user: {response['user']['email']}")
            return True
        return False

    def test_get_me(self):
        """Test get current user"""
        success, response = self.run_test(
            "Get Current User",
            "GET",
            "auth/me",
            200
        )
        return success

    def test_get_categories(self):
        """Test get categories"""
        success, response = self.run_test(
            "Get Categories",
            "GET",
            "categories",
            200
        )
        if success and response:
            # Find "Ăn uống" category for testing
            for cat in response:
                if cat['name'] == 'Ăn uống':
                    self.category_id = cat['id']
                    print(f"   Found category: {cat['name']} (ID: {cat['id']})")
                    break
        return success

    def test_create_transaction(self):
        """Test create transaction"""
        if not self.category_id:
            print("❌ No category ID available for transaction test")
            return False
            
        success, response = self.run_test(
            "Create Transaction",
            "POST",
            "transactions",
            200,
            data={
                "category_id": self.category_id,
                "amount": 75000,
                "currency": "VND",
                "description": "Ăn tối",
                "date": datetime.now(timezone.utc).isoformat(),
                "tags": ["dinner"]
            }
        )
        if success and 'id' in response:
            self.transaction_id = response['id']
            print(f"   Created transaction: {response['description']} - {response['amount']} {response['currency']}")
        return success

    def test_get_transactions(self):
        """Test get transactions"""
        success, response = self.run_test(
            "Get Transactions",
            "GET",
            "transactions",
            200
        )
        if success:
            print(f"   Found {len(response)} transactions")
        return success

    def test_delete_transaction(self):
        """Test delete transaction"""
        if not self.transaction_id:
            print("❌ No transaction ID available for delete test")
            return False
            
        success, response = self.run_test(
            "Delete Transaction",
            "DELETE",
            f"transactions/{self.transaction_id}",
            200
        )
        return success

    def test_create_shared_expense(self):
        """Test create shared expense"""
        if not self.category_id:
            print("❌ No category ID available for shared expense test")
            return False
            
        success, response = self.run_test(
            "Create Shared Expense",
            "POST",
            "shared-expenses",
            200,
            data={
                "title": "Ăn nhóm",
                "description": "Dinner with friends",
                "total_amount": 300000,
                "currency": "VND",
                "participant_emails": ["test2@example.com"],
                "split_type": "equal",
                "category_id": self.category_id,
                "date": datetime.now(timezone.utc).isoformat()
            }
        )
        if success and 'id' in response:
            self.shared_expense_id = response['id']
            print(f"   Created shared expense: {response['title']} - {response['total_amount']} {response['currency']}")
        return success

    def test_get_shared_expenses(self):
        """Test get shared expenses"""
        success, response = self.run_test(
            "Get Shared Expenses",
            "GET",
            "shared-expenses",
            200
        )
        if success:
            print(f"   Found {len(response)} shared expenses")
        return success

    def test_confirm_shared_expense(self):
        """Test confirm shared expense"""
        if not self.shared_expense_id:
            print("❌ No shared expense ID available for confirm test")
            return False
            
        success, response = self.run_test(
            "Confirm Shared Expense",
            "POST",
            f"shared-expenses/{self.shared_expense_id}/confirm",
            200
        )
        return success

    def test_get_settlements(self):
        """Test get settlements"""
        if not self.shared_expense_id:
            print("❌ No shared expense ID available for settlements test")
            return False
            
        success, response = self.run_test(
            "Get Settlements",
            "GET",
            f"shared-expenses/{self.shared_expense_id}/settlements",
            200
        )
        if success:
            print(f"   Found {len(response)} settlement records")
        return success

    def test_send_friend_request(self):
        """Test send friend request"""
        success, response = self.run_test(
            "Send Friend Request",
            "POST",
            "friends/request",
            200,
            data={
                "friend_email": "test2@example.com"
            }
        )
        return success

    def test_get_friends(self):
        """Test get friends"""
        success, response = self.run_test(
            "Get Friends",
            "GET",
            "friends",
            200
        )
        if success:
            print(f"   Found {len(response)} friends")
        return success

    def test_get_notifications(self):
        """Test get notifications"""
        success, response = self.run_test(
            "Get Notifications",
            "GET",
            "notifications",
            200
        )
        if success:
            print(f"   Found {len(response)} notifications")
        return success

    def test_statistics_overview(self):
        """Test statistics overview"""
        success, response = self.run_test(
            "Statistics Overview",
            "GET",
            "statistics/overview?period=month",
            200
        )
        if success:
            print(f"   Stats: Expense: {response.get('total_expense', 0)}, Income: {response.get('total_income', 0)}, Balance: {response.get('balance', 0)}")
        return success

    def test_statistics_by_category(self):
        """Test statistics by category"""
        success, response = self.run_test(
            "Statistics by Category",
            "GET",
            "statistics/by-category?period=month",
            200
        )
        if success:
            print(f"   Found {len(response)} category statistics")
        return success

    def test_update_profile(self):
        """Test update profile"""
        success, response = self.run_test(
            "Update Profile",
            "PUT",
            "users/profile",
            200,
            data={
                "currency_preference": "USD",
                "usd_vnd_rate": 24000.0
            }
        )
        if success:
            print(f"   Updated currency: {response.get('currency_preference')}, Rate: {response.get('usd_vnd_rate')}")
        return success

def main():
    print("🚀 Starting FinVault API Tests...")
    print("=" * 50)
    
    tester = FinVaultAPITester()
    
    # Test authentication flow
    print("\n📝 AUTHENTICATION TESTS")
    print("-" * 30)
    
    if not tester.test_register():
        print("❌ Registration failed, trying login with existing user")
        if not tester.test_login():
            print("❌ Both registration and login failed, stopping tests")
            return 1
    
    tester.test_get_me()
    
    # Test categories
    print("\n📂 CATEGORY TESTS")
    print("-" * 30)
    tester.test_get_categories()
    
    # Test transactions
    print("\n💰 TRANSACTION TESTS")
    print("-" * 30)
    tester.test_create_transaction()
    tester.test_get_transactions()
    tester.test_delete_transaction()
    
    # Test shared expenses
    print("\n👥 SHARED EXPENSE TESTS")
    print("-" * 30)
    tester.test_create_shared_expense()
    tester.test_get_shared_expenses()
    tester.test_confirm_shared_expense()
    tester.test_get_settlements()
    
    # Test friends
    print("\n👫 FRIEND TESTS")
    print("-" * 30)
    tester.test_send_friend_request()
    tester.test_get_friends()
    
    # Test notifications
    print("\n🔔 NOTIFICATION TESTS")
    print("-" * 30)
    tester.test_get_notifications()
    
    # Test statistics
    print("\n📊 STATISTICS TESTS")
    print("-" * 30)
    tester.test_statistics_overview()
    tester.test_statistics_by_category()
    
    # Test profile
    print("\n👤 PROFILE TESTS")
    print("-" * 30)
    tester.test_update_profile()
    
    # Print final results
    print("\n" + "=" * 50)
    print(f"📊 FINAL RESULTS: {tester.tests_passed}/{tester.tests_run} tests passed")
    
    if tester.tests_passed == tester.tests_run:
        print("🎉 All tests passed!")
        return 0
    else:
        print(f"⚠️  {tester.tests_run - tester.tests_passed} tests failed")
        return 1

if __name__ == "__main__":
    sys.exit(main())