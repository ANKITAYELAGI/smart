import random
import time
import json
import requests
from datetime import datetime
import threading
import logging

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
    
    def send_heartbeat(self):
        """Send heartbeat to backend"""
        heartbeat_data = {
            "device_id": self.device_id,
            "timestamp": datetime.now().isoformat(),
            "status": "online",
            "sensor_count": len(self.sensors),
            "uptime": int(time.time())
        }
        
        try:
            response = requests.post(
                f"{self.api_endpoint}/device-heartbeat",
                json=heartbeat_data,
                timeout=5
            )
            
            if response.status_code == 200:
                self.last_heartbeat = datetime.now()
                logger.debug(f"Device {self.device_id}: Heartbeat sent")
                return True
            else:
                logger.warning(f"Device {self.device_id}: Heartbeat failed")
                return False
                
        except requests.exceptions.RequestException as e:
            logger.error(f"Device {self.device_id}: Heartbeat error - {str(e)}")
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
        
    def start_monitoring(self, interval=5):
        """Start monitoring all devices and sensors"""
        self.running = True
        logger.info("Starting IoT device monitoring...")
        
        # Start monitoring thread
        monitor_thread = threading.Thread(target=self._monitor_loop, args=(interval,))
        monitor_thread.daemon = True
        monitor_thread.start()
        
        # Start heartbeat thread
        heartbeat_thread = threading.Thread(target=self._heartbeat_loop)
        heartbeat_thread.daemon = True
        heartbeat_thread.start()
        
    def stop_monitoring(self):
        """Stop monitoring"""
        self.running = False
        logger.info("Stopped IoT device monitoring")
        
    def _monitor_loop(self, interval):
        """Main monitoring loop"""
        while self.running:
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
                
    def _heartbeat_loop(self):
        """Heartbeat loop"""
        while self.running:
            try:
                for device_id, device in self.devices.items():
                    if device.is_connected:
                        device.send_heartbeat()
                        
                time.sleep(30)  # Send heartbeat every 30 seconds
                
            except Exception as e:
                logger.error(f"Error in heartbeat loop: {str(e)}")
                time.sleep(30)
                
    def get_device_status(self):
        """Get status of all devices"""
        status = {}
        for device_id, device in self.devices.items():
            status[device_id] = {
                "connected": device.is_connected,
                "last_heartbeat": device.last_heartbeat.isoformat(),
                "sensor_count": len(device.sensors),
                "slots": [slot.slot_id for slot in device.sensors]
            }
        return status
        
    def simulate_parking_event(self, slot_id, duration=300):
        """Simulate a parking event (car arriving and leaving)"""
        if slot_id not in self.slots:
            logger.error(f"Slot {slot_id} not found")
            return
            
        slot = self.slots[slot_id]
        logger.info(f"Simulating parking event for slot {slot_id}")
        
        # Car arrives
        slot.sensor.distance_threshold = 15  # Simulate car presence
        time.sleep(2)
        
        # Car parks for duration
        time.sleep(duration)
        
        # Car leaves
        slot.sensor.distance_threshold = 30  # Reset to normal threshold
        logger.info(f"Parking event completed for slot {slot_id}")

def main():
    """Main function to run IoT simulation"""
    print("🚗 Smart Parking IoT Sensor Simulation")
    print("=" * 50)
    
    # Create IoT device manager
    manager = IoTDeviceManager()
    
    # Create devices for each parking lot
    manager.create_device("device_001", "lot_001", 50)  # Downtown Plaza
    manager.create_device("device_002", "lot_002", 80)  # Central Station  
    manager.create_device("device_003", "lot_003", 120) # Shopping Mall
    
    # Start monitoring
    manager.start_monitoring(interval=3)  # Send data every 3 seconds
    
    try:
        print("IoT devices are now monitoring parking slots...")
        print("Press Ctrl+C to stop")
        
        # Simulate some parking events
        time.sleep(10)
        manager.simulate_parking_event("lot_001_slot_1", 60)
        
        time.sleep(5)
        manager.simulate_parking_event("lot_002_slot_5", 120)
        
        # Keep running
        while True:
            time.sleep(10)
            status = manager.get_device_status()
            print(f"\nDevice Status: {len(status)} devices active")
            for device_id, device_status in status.items():
                print(f"  {device_id}: {'🟢' if device_status['connected'] else '🔴'} "
                      f"{device_status['sensor_count']} sensors")
                
    except KeyboardInterrupt:
        print("\nShutting down IoT simulation...")
        manager.stop_monitoring()
        print("Simulation stopped.")

if __name__ == "__main__":
    main()
