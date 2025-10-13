#!/usr/bin/env python3
"""
Simple Supabase connection test
"""

import requests
import json

def test_supabase_connection():
    """Test basic Supabase connection"""
    print("🔍 Testing Supabase connection...")
    
    # Test a simple endpoint that should work
    try:
        response = requests.get("http://localhost:3000/api/tables", timeout=30)
        print(f"Status Code: {response.status_code}")
        print(f"Response: {response.text}")
        
        if response.status_code == 500:
            data = response.json()
            if "Could not find the function public.get_tables" in data.get('details', ''):
                print("✅ Connection to Supabase is working, but get_tables RPC function doesn't exist")
                print("This means the primary information_schema query failed and it fell back to RPC")
                return True
            else:
                print("❌ Different error occurred")
                return False
        elif response.status_code == 200:
            print("✅ Tables endpoint working perfectly")
            return True
        else:
            print(f"❌ Unexpected status code: {response.status_code}")
            return False
            
    except Exception as e:
        print(f"❌ Connection failed: {str(e)}")
        return False

if __name__ == "__main__":
    test_supabase_connection()