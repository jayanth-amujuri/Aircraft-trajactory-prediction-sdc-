#!/usr/bin/env python3
"""
Test script to verify both backend servers are running correctly
"""

import requests
import json
import time

def test_backend(url, name):
    """Test a backend server"""
    try:
        print(f"\n🔍 Testing {name} at {url}")
        
        # Test health endpoint
        health_response = requests.get(f"{url}/api/health", timeout=5)
        if health_response.status_code == 200:
            health_data = health_response.json()
            print(f"✅ {name} Health Check: {health_data.get('message', 'OK')}")
        else:
            print(f"❌ {name} Health Check Failed: {health_response.status_code}")
            return False
            
        return True
        
    except requests.exceptions.ConnectionError:
        print(f"❌ {name} Connection Error: Server not running at {url}")
        return False
    except Exception as e:
        print(f"❌ {name} Error: {str(e)}")
        return False

def main():
    print("🚀 SuperDensee Backend Testing")
    print("=" * 40)
    
    # Test both backends
    testing_ok = test_backend("http://localhost:5000", "Testing Phase Backend (app.py)")
    application_ok = test_backend("http://localhost:5001", "Application Phase Backend (application.py)")
    
    print("\n" + "=" * 40)
    print("📊 Test Results:")
    print(f"Testing Phase (Port 5000): {'✅ Running' if testing_ok else '❌ Not Running'}")
    print(f"Application Phase (Port 5001): {'✅ Running' if application_ok else '❌ Not Running'}")
    
    if testing_ok and application_ok:
        print("\n🎉 Both backends are running successfully!")
        print("\n📝 Next Steps:")
        print("1. Start the frontend: cd superdense-frontend && npm run dev")
        print("2. Open http://localhost:5173 in your browser")
        print("3. Choose 'Testing Phase' or 'Application Phase' from the navigation")
    else:
        print("\n⚠️  Some backends are not running.")
        print("To start them:")
        print("1. Run: start_backends.bat")
        print("2. Or manually start each backend in separate terminals:")
        print("   - Terminal 1: cd superdense-backend && python app.py")
        print("   - Terminal 2: cd superdense-backend && python application.py")

if __name__ == "__main__":
    main()
