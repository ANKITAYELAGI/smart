#!/usr/bin/env python3
"""
Smart Parking IoT Sensor Simulation - Limited Time Version
Runs for a specified duration then stops automatically
"""

import random
import time
import json
import requests
from datetime import datetime
import threading
import logging
import sys

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

class UltrasonicSensor:
    """Simulates HC-SR04 Ultrasonic Sensor"""
    
    def __init__(self, trigger_pin, echo_pin):
        self.trigger_pin = trigger_pin
        self.echo_pin = echo_pin
        self.distance_threshold = 30  # cm - distance below which slot is considered occupied
        
    def measure_distance(self):
        """Simulate distance measurement"""
        # Simulate real sensor behavior with some noise
        base_distance = random.uniform(5, 200)  # Random distance in cm
        
        # Add some realistic noise
        noise = random.uniform(-2, 2)
        distance = max(0, base_distance + noise)
        
        return round(distance, 2)
    
    def is_occupied(self):
        """Determine if parking slot is occupied based on distance"""
        distance = self.measure_distance()
        return distance < self.distance_threshold

class ESP8266NodeMCU:
    """Simulates ESP8266 NodeMCU microcontroller"""
    
    def __init__(self, device_id, wifi_ssid, wifi_password, api_endpoint):
        self.device_id = device_id
        self.wifi_ssid = wifi_ssid
        self.wifi_password = wifi_password
        self.api_endpoint = api_endpoint
        self.sensors = []
        self.is_connected = False
        self.last_heartbeat = datetime.now()
        
    def add_sensor(self, sensor):
        """Add ultrasonic sensor to the device"""
        self.sensors.append(sensor)
        
    def connect_wifi(self):
        """Simulate WiFi connection"""
        logger.info(f"Device {self.device_id}: Connecting to WiFi {self.wifi_ssid}")
        time.sleep(2)  # Simulate connection time
        self.is_connected = True
        logger.info(f"Device {self.device_id}: WiFi connected successfully")
        
    def send_sensor_data(self, sensor_data):
        """Send sensor data to backend API"""
        if not self.is_connected:
            logger.warning(f"Device {self.device_id}: Not connected to WiFi")
            return False
            
        try:
            headers = {
                'Content-Type': 'application/json',
                'User-Agent': f'ESP8266-{self.device_id}'
            }
            
            response = requests.post(
                f"{self.api_endpoint}/sensor-data",
                json=sensor_data,
                headers=headers,
                timeout=5
            )
            
            if response.status_code == 200:
                logger.info(f"Device {self.device_id}: Data sent successfully")
                return True
            else:
                logger.error(f"Device {self.device_id}: Failed to send data - Status: {response.status_code}")
                return False
                
        except requests.exceptions.RequestException as e:
            logger.error(f"Device {self.device_id}: Network error - {str(e)}")
            return False

class ParkingSlotSensor:
    """Represents a parking slot with IoT sensor"""
    
    def __init__(self, slot_id, lot_id, device_id, sensor_index):
        self.slot_id = slot_id
        self.lot_id = lot_id
        self.device_id = device_id
        self.sensor_index = sensor_index
        self.sensor = UltrasonicSensor(trigger_pin=2, echo_pin=3)
        self.last_status = "free"
        self.status_change_time = datetime.now()
        
    def read_status(self):
        """Read current slot status"""
        is_occupied = self.sensor.is_occupied()
        current_status = "occupied" if is_occupied else "free"
        
        # Detect status change
        if current_status != self.last_status:
            self.status_change_time = datetime.now()
            self.last_status = current_status
            logger.info(f"Slot {self.slot_id}: Status changed to {current_status}")
            
        return {
            "slot_id": self.slot_id,
            "lot_id": self.lot_id,
            "distance": self.sensor.measure_distance(),
            "timestamp": datetime.now().isoformat(),
            "status": current_status,
            "device_id": self.device_id,
            "sensor_index": self.sensor_index
        }

class IoTDeviceManager:
    """Manages multiple IoT devices and sensors"""
    
    def __init__(self, api_endpoint="http://localhost:8000"):
        self.api_endpoint = api_endpoint
        self.devices = {}
        self.slots = {}
        self.running = False
        
    def create_device(self, device_id, lot_id, slot_count, wifi_ssid="SmartPark_WiFi", wifi_password="parking123"):
        """Create a new IoT device with sensors"""
        device = ESP8266NodeMCU(
            device_id=device_id,
            wifi_ssid=wifi_ssid,
            wifi_password=wifi_password,
            api_endpoint=self.api_endpoint
        )
        
        # Connect to WiFi
        device.connect_wifi()
        
        # Add sensors for each parking slot
        for i in range(slot_count):
            slot_id = f"{lot_id}_slot_{i+1}"
            slot_sensor = ParkingSlotSensor(
                slot_id=slot_id,
                lot_id=lot_id,
                device_id=device_id,
                sensor_index=i
            )
            device.add_sensor(slot_sensor)
            self.slots[slot_id] = slot_sensor
            
        self.devices[device_id] = device
        logger.info(f"Created device {device_id} with {slot_count} sensors for lot {lot_id}")
        
    def start_monitoring(self, interval=5, duration=300):
        """Start monitoring all devices and sensors for a limited time"""
        self.running = True
        logger.info(f"Starting IoT device monitoring for {duration} seconds...")
        
        # Start monitoring thread
        monitor_thread = threading.Thread(target=self._monitor_loop, args=(interval, duration))
        monitor_thread.daemon = True
        monitor_thread.start()
        
        return monitor_thread
        
    def stop_monitoring(self):
        """Stop monitoring"""
        self.running = False
        logger.info("Stopped IoT device monitoring")
        
    def _monitor_loop(self, interval, duration):
        """Main monitoring loop with timeout"""
        start_time = time.time()
        
        while self.running and (time.time() - start_time) < duration:
            try:
                for device_id, device in self.devices.items():
                    if device.is_connected:
                        for sensor in device.sensors:
                            sensor_data = sensor.read_status()
                            
                            # Send data to backend
                            success = device.send_sensor_data(sensor_data)
                            
                            if not success:
                                logger.warning(f"Failed to send data for sensor {sensor.slot_id}")
                                
                time.sleep(interval)
                
            except Exception as e:
                logger.error(f"Error in monitoring loop: {str(e)}")
                time.sleep(interval)
        
        # Auto-stop after duration
        if self.running:
            logger.info(f"Monitoring completed after {duration} seconds")
            self.running = False

def main():
    """Main function to run IoT simulation with timeout"""
    print("🚗 Smart Parking IoT Sensor Simulation (Limited Time)")
    print("=" * 60)
    
    # Get duration from command line argument or use default
    duration = 300  # 5 minutes default
    if len(sys.argv) > 1:
        try:
            duration = int(sys.argv[1])
        except ValueError:
            print("Invalid duration. Using default 300 seconds.")
    
    print(f"Running for {duration} seconds ({duration//60} minutes)")
    
    # Create IoT device manager
    manager = IoTDeviceManager()
    
    # Create devices for each parking lot
    manager.create_device("device_001", "lot_001", 10)  # Downtown Plaza (reduced slots)
    manager.create_device("device_002", "lot_002", 10)  # Central Station (reduced slots)
    manager.create_device("device_003", "lot_003", 10)  # Shopping Mall (reduced slots)
    
    # Start monitoring with timeout
    monitor_thread = manager.start_monitoring(interval=3, duration=duration)
    
    try:
        print("IoT devices are now monitoring parking slots...")
        print("Press Ctrl+C to stop early")
        
        # Wait for monitoring to complete
        monitor_thread.join()
        
        print(f"\n✅ IoT simulation completed after {duration} seconds")
        print("You can restart it anytime by running the script again.")
        
    except KeyboardInterrupt:
        print("\n🛑 Shutting down IoT simulation...")
        manager.stop_monitoring()
        print("Simulation stopped by user.")

if __name__ == "__main__":
    main()
