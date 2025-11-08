#!/usr/bin/env python3
"""
Smart Parking System Integration Test
Tests the complete system integration and data flow
"""

import asyncio
import requests
import json
import time
import logging
from datetime import datetime, timedelta
import sys
import os

# Configure logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

class SmartParkingTester:
    """Integration tester for Smart Parking System"""
    
    def __init__(self, base_url="http://localhost:8000"):
        self.base_url = base_url
        self.test_results = []
        
    def log_test(self, test_name, success, message=""):
        """Log test result"""
        status = "✅ PASS" if success else "❌ FAIL"
        logger.info(f"{status} {test_name}: {message}")
        self.test_results.append({
            "test": test_name,
            "success": success,
            "message": message,
            "timestamp": datetime.now()
        })
        
    def test_api_health(self):
        """Test API health endpoint"""
        try:
            response = requests.get(f"{self.base_url}/health", timeout=5)
            if response.status_code == 200:
                data = response.json()
                self.log_test("API Health Check", True, f"Status: {data.get('status')}")
                return True
            else:
                self.log_test("API Health Check", False, f"HTTP {response.status_code}")
                return False
        except Exception as e:
            self.log_test("API Health Check", False, str(e))
            return False
            
    def test_parking_lots_endpoint(self):
        """Test parking lots endpoint"""
        try:
            response = requests.get(f"{self.base_url}/parking-lots", timeout=5)
            if response.status_code == 200:
                lots = response.json()
                self.log_test("Parking Lots Endpoint", True, f"Retrieved {len(lots)} lots")
                return lots
            else:
                self.log_test("Parking Lots Endpoint", False, f"HTTP {response.status_code}")
                return None
        except Exception as e:
            self.log_test("Parking Lots Endpoint", False, str(e))
            return None
            
    def test_cost_prediction(self):
        """Test cost prediction endpoint"""
        try:
            request_data = {
                "user_id": "test_user",
                "current_location": {"lat": 40.7128, "lng": -74.0060},
                "destination": {"lat": 40.7589, "lng": -73.9851},
                "arrival_time": datetime.now().isoformat(),
                "duration": 120
            }
            
            response = requests.post(
                f"{self.base_url}/predict-cost",
                json=request_data,
                timeout=10
            )
            
            if response.status_code == 200:
                data = response.json()
                optimal_lot = data.get("optimal_lot")
                costs = data.get("costs", {})
                
                self.log_test(
                    "Cost Prediction", 
                    True, 
                    f"Optimal lot: {optimal_lot}, {len(costs)} lots analyzed"
                )
                return data
            else:
                self.log_test("Cost Prediction", False, f"HTTP {response.status_code}")
                return None
        except Exception as e:
            self.log_test("Cost Prediction", False, str(e))
            return None
            
    def test_reservation_flow(self):
        """Test complete reservation flow"""
        try:
            request_data = {
                "user_id": "test_user",
                "current_location": {"lat": 40.7128, "lng": -74.0060},
                "destination": {"lat": 40.7589, "lng": -73.9851},
                "arrival_time": datetime.now().isoformat(),
                "duration": 120
            }
            
            response = requests.post(
                f"{self.base_url}/reserve",
                json=request_data,
                timeout=10
            )
            
            if response.status_code == 200:
                data = response.json()
                success = data.get("success", False)
                message = data.get("message", "")
                
                self.log_test(
                    "Reservation Flow", 
                    success, 
                    f"Success: {success}, Message: {message}"
                )
                return data
            else:
                self.log_test("Reservation Flow", False, f"HTTP {response.status_code}")
                return None
        except Exception as e:
            self.log_test("Reservation Flow", False, str(e))
            return None
            
    def test_sensor_data_endpoint(self):
        """Test sensor data endpoint"""
        try:
            sensor_data = {
                "slot_id": "test_slot_001",
                "lot_id": "lot_001",
                "distance": 25.4,
                "timestamp": datetime.now().isoformat(),
                "status": "occupied",
                "device_id": "test_device_001",
                "sensor_index": 0
            }
            
            response = requests.post(
                f"{self.base_url}/sensor-data",
                json=sensor_data,
                timeout=5
            )
            
            if response.status_code == 200:
                data = response.json()
                self.log_test("Sensor Data Endpoint", True, f"Status: {data.get('status')}")
                return True
            else:
                self.log_test("Sensor Data Endpoint", False, f"HTTP {response.status_code}")
                return False
        except Exception as e:
            self.log_test("Sensor Data Endpoint", False, str(e))
            return False
            
    def test_optimization_endpoint(self):
        """Test optimization endpoint"""
        try:
            response = requests.post(f"{self.base_url}/optimize", timeout=30)
            
            if response.status_code == 200:
                data = response.json()
                success = data.get("success", False)
                self.log_test("Optimization Endpoint", success, f"Success: {success}")
                return success
            else:
                self.log_test("Optimization Endpoint", False, f"HTTP {response.status_code}")
                return False
        except Exception as e:
            self.log_test("Optimization Endpoint", False, str(e))
            return False
            
    def test_analytics_endpoint(self):
        """Test analytics endpoint"""
        try:
            response = requests.get(f"{self.base_url}/analytics", timeout=5)
            
            if response.status_code == 200:
                data = response.json()
                lot_count = len(data)
                self.log_test("Analytics Endpoint", True, f"Retrieved analytics for {lot_count} lots")
                return data
            else:
                self.log_test("Analytics Endpoint", False, f"HTTP {response.status_code}")
                return None
        except Exception as e:
            self.log_test("Analytics Endpoint", False, str(e))
            return None
            
    def test_websocket_connection(self):
        """Test WebSocket connection"""
        try:
            import websocket
            
            def on_message(ws, message):
                logger.info(f"WebSocket message received: {message}")
                ws.close()
                
            def on_error(ws, error):
                logger.error(f"WebSocket error: {error}")
                
            def on_close(ws, close_status_code, close_msg):
                logger.info("WebSocket connection closed")
                
            def on_open(ws):
                logger.info("WebSocket connection opened")
                ws.send(json.dumps({"type": "test_message"}))
                
            ws_url = self.base_url.replace("http", "ws") + "/ws"
            ws = websocket.WebSocketApp(
                ws_url,
                on_open=on_open,
                on_message=on_message,
                on_error=on_error,
                on_close=on_close
            )
            
            # Run for 5 seconds
            ws.run_forever(timeout=5)
            self.log_test("WebSocket Connection", True, "Connection established")
            return True
            
        except ImportError:
            self.log_test("WebSocket Connection", False, "websocket-client not installed")
            return False
        except Exception as e:
            self.log_test("WebSocket Connection", False, str(e))
            return False
            
    def test_frontend_accessibility(self):
        """Test if frontend is accessible"""
        try:
            response = requests.get("http://localhost:3000", timeout=5)
            if response.status_code == 200:
                self.log_test("Frontend Accessibility", True, "Frontend is accessible")
                return True
            else:
                self.log_test("Frontend Accessibility", False, f"HTTP {response.status_code}")
                return False
        except Exception as e:
            self.log_test("Frontend Accessibility", False, str(e))
            return False
            
    def run_comprehensive_test(self):
        """Run all tests"""
        logger.info("🧪 Starting Smart Parking System Integration Tests")
        logger.info("=" * 60)
        
        # Test API endpoints
        self.test_api_health()
        lots = self.test_parking_lots_endpoint()
        self.test_cost_prediction()
        self.test_reservation_flow()
        self.test_sensor_data_endpoint()
        self.test_optimization_endpoint()
        self.test_analytics_endpoint()
        
        # Test WebSocket
        self.test_websocket_connection()
        
        # Test frontend
        self.test_frontend_accessibility()
        
        # Generate report
        self.generate_test_report()
        
    def generate_test_report(self):
        """Generate test report"""
        logger.info("\n" + "=" * 60)
        logger.info("📊 TEST REPORT")
        logger.info("=" * 60)
        
        total_tests = len(self.test_results)
        passed_tests = sum(1 for result in self.test_results if result["success"])
        failed_tests = total_tests - passed_tests
        
        logger.info(f"Total Tests: {total_tests}")
        logger.info(f"Passed: {passed_tests}")
        logger.info(f"Failed: {failed_tests}")
        logger.info(f"Success Rate: {(passed_tests/total_tests)*100:.1f}%")
        
        if failed_tests > 0:
            logger.info("\n❌ Failed Tests:")
            for result in self.test_results:
                if not result["success"]:
                    logger.info(f"  - {result['test']}: {result['message']}")
        
        logger.info("\n" + "=" * 60)
        
        if failed_tests == 0:
            logger.info("🎉 All tests passed! System is ready for use.")
        else:
            logger.info("⚠️ Some tests failed. Please check the system configuration.")
            
        return failed_tests == 0

def main():
    """Main test function"""
    print("🚗 Smart Parking System Integration Test")
    print("=" * 50)
    
    # Check if backend is running
    tester = SmartParkingTester()
    
    print("Checking if backend is running...")
    if not tester.test_api_health():
        print("❌ Backend is not running. Please start the backend first:")
        print("   cd backend && python -m uvicorn main:app --reload --host 0.0.0.0 --port 8000")
        sys.exit(1)
    
    print("✅ Backend is running. Starting comprehensive tests...")
    
    # Run all tests
    success = tester.run_comprehensive_test()
    
    if success:
        print("\n🎉 Integration tests completed successfully!")
        print("The Smart Parking System is ready for use.")
    else:
        print("\n⚠️ Some integration tests failed.")
        print("Please check the system configuration and try again.")
        sys.exit(1)

if __name__ == "__main__":
    main()
