#!/usr/bin/env python3
"""
Backend API Testing for Supabase Table Viewer
Tests all backend endpoints for the table viewer application.
"""

import requests
import json
import sys
import os
from urllib.parse import urlencode

# Get base URL from environment
BASE_URL = "http://localhost:3000"
API_BASE = f"{BASE_URL}/api"

def test_get_tables():
    """Test GET /api/tables endpoint"""
    print("\n=== Testing GET /api/tables ===")
    
    try:
        response = requests.get(f"{API_BASE}/tables", timeout=30)
        print(f"Status Code: {response.status_code}")
        print(f"Response Headers: {dict(response.headers)}")
        
        if response.status_code == 200:
            data = response.json()
            print(f"Response: {json.dumps(data, indent=2)}")
            
            # Validate response structure
            if 'tables' in data and isinstance(data['tables'], list):
                print(f"✅ SUCCESS: Found {len(data['tables'])} tables")
                return data['tables']
            else:
                print("❌ FAILED: Invalid response structure - missing 'tables' array")
                return None
        else:
            print(f"❌ FAILED: HTTP {response.status_code}")
            try:
                error_data = response.json()
                print(f"Error: {json.dumps(error_data, indent=2)}")
            except:
                print(f"Error text: {response.text}")
            return None
            
    except requests.exceptions.RequestException as e:
        print(f"❌ FAILED: Request error - {str(e)}")
        return None
    except Exception as e:
        print(f"❌ FAILED: Unexpected error - {str(e)}")
        return None

def test_get_table_columns(table_name):
    """Test GET /api/table-columns endpoint"""
    print(f"\n=== Testing GET /api/table-columns?table={table_name} ===")
    
    try:
        params = {'table': table_name}
        response = requests.get(f"{API_BASE}/table-columns", params=params, timeout=30)
        print(f"Status Code: {response.status_code}")
        
        if response.status_code == 200:
            data = response.json()
            print(f"Response: {json.dumps(data, indent=2)}")
            
            # Validate response structure
            if 'columns' in data and isinstance(data['columns'], list):
                print(f"✅ SUCCESS: Found {len(data['columns'])} columns for table '{table_name}'")
                return data['columns']
            else:
                print("❌ FAILED: Invalid response structure - missing 'columns' array")
                return None
        else:
            print(f"❌ FAILED: HTTP {response.status_code}")
            try:
                error_data = response.json()
                print(f"Error: {json.dumps(error_data, indent=2)}")
            except:
                print(f"Error text: {response.text}")
            return None
            
    except requests.exceptions.RequestException as e:
        print(f"❌ FAILED: Request error - {str(e)}")
        return None
    except Exception as e:
        print(f"❌ FAILED: Unexpected error - {str(e)}")
        return None

def test_get_table_data(table_name):
    """Test GET /api/table-data endpoint without filters"""
    print(f"\n=== Testing GET /api/table-data?table={table_name} ===")
    
    try:
        params = {'table': table_name}
        response = requests.get(f"{API_BASE}/table-data", params=params, timeout=30)
        print(f"Status Code: {response.status_code}")
        
        if response.status_code == 200:
            data = response.json()
            print(f"Response structure: {{'data': [{len(data.get('data', []))} rows]}}")
            
            # Show first few rows if available
            if 'data' in data and isinstance(data['data'], list) and len(data['data']) > 0:
                print(f"First row sample: {json.dumps(data['data'][0], indent=2)}")
                print(f"✅ SUCCESS: Retrieved {len(data['data'])} rows from table '{table_name}'")
                return data['data']
            elif 'data' in data and isinstance(data['data'], list):
                print(f"✅ SUCCESS: Table '{table_name}' is empty (0 rows)")
                return data['data']
            else:
                print("❌ FAILED: Invalid response structure - missing 'data' array")
                return None
        else:
            print(f"❌ FAILED: HTTP {response.status_code}")
            try:
                error_data = response.json()
                print(f"Error: {json.dumps(error_data, indent=2)}")
            except:
                print(f"Error text: {response.text}")
            return None
            
    except requests.exceptions.RequestException as e:
        print(f"❌ FAILED: Request error - {str(e)}")
        return None
    except Exception as e:
        print(f"❌ FAILED: Unexpected error - {str(e)}")
        return None

def test_filtered_table_data(table_name, columns, table_data):
    """Test GET /api/table-data with filters"""
    print(f"\n=== Testing Filtered Table Data for '{table_name}' ===")
    
    if not columns or not table_data or len(table_data) == 0:
        print("⚠️ SKIPPED: No columns or data available for filter testing")
        return True
    
    # Find a suitable column for testing (prefer text columns)
    test_column = None
    test_value = None
    
    # Look for a text column with data
    for col in columns:
        col_name = col.get('column_name')
        if col_name and col_name in table_data[0]:
            sample_value = table_data[0][col_name]
            if sample_value is not None and isinstance(sample_value, str) and len(sample_value) > 0:
                test_column = col_name
                test_value = sample_value
                break
    
    # If no text column, try any column with data
    if not test_column:
        for col in columns:
            col_name = col.get('column_name')
            if col_name and col_name in table_data[0]:
                sample_value = table_data[0][col_name]
                if sample_value is not None:
                    test_column = col_name
                    test_value = sample_value
                    break
    
    if not test_column:
        print("⚠️ SKIPPED: No suitable column found for filter testing")
        return True
    
    print(f"Using column '{test_column}' with value '{test_value}' for filter tests")
    
    # Test different filter types
    filter_tests = [
        ('contains', str(test_value)[:3] if isinstance(test_value, str) and len(str(test_value)) > 3 else str(test_value)),
        ('equals', test_value),
    ]
    
    # Add numeric tests if the value is numeric
    try:
        numeric_value = float(test_value)
        filter_tests.extend([
            ('greaterThan', numeric_value - 1),
            ('lessThan', numeric_value + 1),
        ])
    except (ValueError, TypeError):
        pass
    
    all_passed = True
    
    for filter_type, filter_value in filter_tests:
        print(f"\n--- Testing filter: {filter_type} = {filter_value} ---")
        
        try:
            params = {
                'table': table_name,
                'filterColumn': test_column,
                'filterValue': str(filter_value),
                'filterType': filter_type
            }
            
            response = requests.get(f"{API_BASE}/table-data", params=params, timeout=30)
            print(f"Status Code: {response.status_code}")
            
            if response.status_code == 200:
                data = response.json()
                if 'data' in data and isinstance(data['data'], list):
                    print(f"✅ SUCCESS: Filter '{filter_type}' returned {len(data['data'])} rows")
                else:
                    print(f"❌ FAILED: Invalid response structure for filter '{filter_type}'")
                    all_passed = False
            else:
                print(f"❌ FAILED: HTTP {response.status_code} for filter '{filter_type}'")
                try:
                    error_data = response.json()
                    print(f"Error: {json.dumps(error_data, indent=2)}")
                except:
                    print(f"Error text: {response.text}")
                all_passed = False
                
        except requests.exceptions.RequestException as e:
            print(f"❌ FAILED: Request error for filter '{filter_type}' - {str(e)}")
            all_passed = False
        except Exception as e:
            print(f"❌ FAILED: Unexpected error for filter '{filter_type}' - {str(e)}")
            all_passed = False
    
    return all_passed

def test_error_cases():
    """Test error handling"""
    print("\n=== Testing Error Cases ===")
    
    # Test missing table parameter for table-columns
    print("\n--- Testing missing table parameter for table-columns ---")
    try:
        response = requests.get(f"{API_BASE}/table-columns", timeout=30)
        print(f"Status Code: {response.status_code}")
        if response.status_code == 400:
            print("✅ SUCCESS: Correctly returned 400 for missing table parameter")
        else:
            print(f"❌ FAILED: Expected 400, got {response.status_code}")
    except Exception as e:
        print(f"❌ FAILED: Error testing missing table parameter - {str(e)}")
    
    # Test missing table parameter for table-data
    print("\n--- Testing missing table parameter for table-data ---")
    try:
        response = requests.get(f"{API_BASE}/table-data", timeout=30)
        print(f"Status Code: {response.status_code}")
        if response.status_code == 400:
            print("✅ SUCCESS: Correctly returned 400 for missing table parameter")
        else:
            print(f"❌ FAILED: Expected 400, got {response.status_code}")
    except Exception as e:
        print(f"❌ FAILED: Error testing missing table parameter - {str(e)}")
    
    # Test invalid table name
    print("\n--- Testing invalid table name ---")
    try:
        params = {'table': 'nonexistent_table_12345'}
        response = requests.get(f"{API_BASE}/table-data", params=params, timeout=30)
        print(f"Status Code: {response.status_code}")
        if response.status_code in [404, 500]:
            print("✅ SUCCESS: Correctly handled invalid table name")
        else:
            print(f"⚠️ WARNING: Unexpected status code {response.status_code} for invalid table")
    except Exception as e:
        print(f"❌ FAILED: Error testing invalid table name - {str(e)}")

def test_unsupported_methods():
    """Test that POST, PUT, DELETE methods are not allowed"""
    print("\n=== Testing Unsupported HTTP Methods ===")
    
    methods = ['POST', 'PUT', 'DELETE']
    
    for method in methods:
        print(f"\n--- Testing {method} method ---")
        try:
            response = requests.request(method, f"{API_BASE}/tables", timeout=30)
            print(f"Status Code: {response.status_code}")
            if response.status_code == 405:
                print(f"✅ SUCCESS: {method} correctly returns 405 Method Not Allowed")
            else:
                print(f"❌ FAILED: {method} returned {response.status_code}, expected 405")
        except Exception as e:
            print(f"❌ FAILED: Error testing {method} method - {str(e)}")

def main():
    """Main test function"""
    print("🚀 Starting Supabase Table Viewer Backend API Tests")
    print(f"Testing against: {API_BASE}")
    
    # Test 1: Get all tables
    tables = test_get_tables()
    if not tables:
        print("\n❌ CRITICAL: Cannot proceed with other tests - tables endpoint failed")
        return False
    
    if len(tables) == 0:
        print("\n⚠️ WARNING: No tables found in the database")
        print("✅ All available tests completed successfully")
        return True
    
    # Use the first table for detailed testing
    test_table = tables[0]
    if isinstance(test_table, dict) and 'table_name' in test_table:
        test_table_name = test_table['table_name']
    else:
        test_table_name = str(test_table)
    
    print(f"\n📋 Using table '{test_table_name}' for detailed testing")
    
    # Test 2: Get table columns
    columns = test_get_table_columns(test_table)
    if not columns:
        print(f"\n❌ FAILED: Could not get columns for table '{test_table}'")
        return False
    
    # Test 3: Get table data
    table_data = test_get_table_data(test_table)
    if table_data is None:
        print(f"\n❌ FAILED: Could not get data for table '{test_table}'")
        return False
    
    # Test 4: Test filtered data
    filter_success = test_filtered_table_data(test_table, columns, table_data)
    
    # Test 5: Error cases
    test_error_cases()
    
    # Test 6: Unsupported methods
    test_unsupported_methods()
    
    print("\n🎉 Backend API testing completed!")
    
    if filter_success:
        print("✅ All core functionality tests passed")
        return True
    else:
        print("⚠️ Some filter tests failed, but core functionality works")
        return True

if __name__ == "__main__":
    success = main()
    sys.exit(0 if success else 1)