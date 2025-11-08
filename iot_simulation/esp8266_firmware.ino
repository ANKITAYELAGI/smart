/*
 * ESP8266 NodeMCU Firmware for Smart Parking System
 * CRPark-Inspired IoT Sensor Implementation
 * 
 * Hardware:
 * - ESP8266 NodeMCU
 * - HC-SR04 Ultrasonic Sensor
 * - LED indicators
 * - WiFi connectivity
 * 
 * Features:
 * - Real-time parking slot detection
 * - WiFi connectivity with auto-reconnect
 * - Data transmission to backend API
 * - Heartbeat monitoring
 * - Error handling and recovery
 */

#include <ESP8266WiFi.h>
#include <ESP8266HTTPClient.h>
#include <ArduinoJson.h>
#include <WiFiClientSecure.h>

// WiFi Configuration
const char* ssid = "SmartPark_WiFi";
const char* password = "parking123";

// API Configuration
const char* api_endpoint = "http://localhost:8000";
const char* device_id = "device_001";
const char* lot_id = "lot_001";

// Hardware Pins
const int TRIG_PIN = D2;
const int ECHO_PIN = D3;
const int LED_PIN = D4;
const int STATUS_LED = D5;

// Sensor Configuration
const float DISTANCE_THRESHOLD = 30.0; // cm - distance below which slot is occupied
const int MAX_DISTANCE = 200; // cm - maximum measurable distance
const int MIN_DISTANCE = 2;   // cm - minimum measurable distance

// Timing Configuration
const unsigned long SENSOR_INTERVAL = 3000;    // Send data every 3 seconds
const unsigned long HEARTBEAT_INTERVAL = 30000; // Send heartbeat every 30 seconds
const unsigned long RECONNECT_INTERVAL = 10000; // Try to reconnect every 10 seconds

// Global Variables
unsigned long lastSensorTime = 0;
unsigned long lastHeartbeatTime = 0;
unsigned long lastReconnectTime = 0;
bool wifiConnected = false;
bool lastSlotStatus = false; // false = free, true = occupied
int slotNumber = 1;

// Function Declarations
void setupWiFi();
void reconnectWiFi();
float measureDistance();
bool isSlotOccupied();
void sendSensorData();
void sendHeartbeat();
void blinkLED(int pin, int times, int delay_ms);
void handleError(String error);

void setup() {
  Serial.begin(115200);
  delay(1000);
  
  Serial.println();
  Serial.println("🚗 Smart Parking IoT Sensor Starting...");
  Serial.println("Device ID: " + String(device_id));
  Serial.println("Lot ID: " + String(lot_id));
  
  // Initialize pins
  pinMode(TRIG_PIN, OUTPUT);
  pinMode(ECHO_PIN, INPUT);
  pinMode(LED_PIN, OUTPUT);
  pinMode(STATUS_LED, OUTPUT);
  
  // Initialize LEDs
  digitalWrite(LED_PIN, LOW);
  digitalWrite(STATUS_LED, LOW);
  
  // Setup WiFi
  setupWiFi();
  
  Serial.println("✅ IoT Sensor initialized successfully");
  blinkLED(STATUS_LED, 3, 200); // Success indicator
}

void loop() {
  unsigned long currentTime = millis();
  
  // Check WiFi connection
  if (WiFi.status() != WL_CONNECTED) {
    wifiConnected = false;
    digitalWrite(STATUS_LED, LOW);
    
    if (currentTime - lastReconnectTime > RECONNECT_INTERVAL) {
      reconnectWiFi();
      lastReconnectTime = currentTime;
    }
    return;
  } else if (!wifiConnected) {
    wifiConnected = true;
    digitalWrite(STATUS_LED, HIGH);
    Serial.println("✅ WiFi reconnected");
  }
  
  // Send sensor data at regular intervals
  if (currentTime - lastSensorTime > SENSOR_INTERVAL) {
    sendSensorData();
    lastSensorTime = currentTime;
  }
  
  // Send heartbeat at regular intervals
  if (currentTime - lastHeartbeatTime > HEARTBEAT_INTERVAL) {
    sendHeartbeat();
    lastHeartbeatTime = currentTime;
  }
  
  // Small delay to prevent overwhelming the system
  delay(100);
}

void setupWiFi() {
  Serial.print("Connecting to WiFi: ");
  Serial.println(ssid);
  
  WiFi.begin(ssid, password);
  
  int attempts = 0;
  while (WiFi.status() != WL_CONNECTED && attempts < 20) {
    delay(500);
    Serial.print(".");
    attempts++;
    blinkLED(LED_PIN, 1, 100);
  }
  
  if (WiFi.status() == WL_CONNECTED) {
    wifiConnected = true;
    digitalWrite(STATUS_LED, HIGH);
    Serial.println();
    Serial.println("✅ WiFi connected successfully!");
    Serial.print("IP address: ");
    Serial.println(WiFi.localIP());
    Serial.print("Signal strength: ");
    Serial.print(WiFi.RSSI());
    Serial.println(" dBm");
  } else {
    Serial.println();
    Serial.println("❌ WiFi connection failed");
    handleError("WiFi connection failed");
  }
}

void reconnectWiFi() {
  Serial.println("🔄 Attempting to reconnect to WiFi...");
  WiFi.disconnect();
  delay(1000);
  WiFi.begin(ssid, password);
  
  int attempts = 0;
  while (WiFi.status() != WL_CONNECTED && attempts < 10) {
    delay(500);
    Serial.print(".");
    attempts++;
    blinkLED(LED_PIN, 1, 200);
  }
  
  if (WiFi.status() == WL_CONNECTED) {
    wifiConnected = true;
    digitalWrite(STATUS_LED, HIGH);
    Serial.println();
    Serial.println("✅ WiFi reconnected successfully!");
  } else {
    Serial.println();
    Serial.println("❌ WiFi reconnection failed");
  }
}

float measureDistance() {
  // Clear the trigger pin
  digitalWrite(TRIG_PIN, LOW);
  delayMicroseconds(2);
  
  // Send ultrasonic pulse
  digitalWrite(TRIG_PIN, HIGH);
  delayMicroseconds(10);
  digitalWrite(TRIG_PIN, LOW);
  
  // Read echo pin
  unsigned long duration = pulseIn(ECHO_PIN, HIGH, 30000); // 30ms timeout
  
  if (duration == 0) {
    Serial.println("⚠️ Sensor timeout - no echo received");
    return -1; // Error value
  }
  
  // Calculate distance in cm
  float distance = duration * 0.034 / 2;
  
  // Validate distance range
  if (distance < MIN_DISTANCE || distance > MAX_DISTANCE) {
    Serial.println("⚠️ Distance out of range: " + String(distance) + " cm");
    return -1; // Error value
  }
  
  return distance;
}

bool isSlotOccupied() {
  float distance = measureDistance();
  
  if (distance == -1) {
    // Return last known status on error
    return lastSlotStatus;
  }
  
  bool occupied = distance < DISTANCE_THRESHOLD;
  
  // Log status change
  if (occupied != lastSlotStatus) {
    Serial.println("🔄 Slot status changed: " + String(occupied ? "OCCUPIED" : "FREE") + 
                   " (Distance: " + String(distance) + " cm)");
    lastSlotStatus = occupied;
    
    // Visual indicator
    if (occupied) {
      blinkLED(LED_PIN, 2, 300); // Red pattern for occupied
    } else {
      blinkLED(LED_PIN, 1, 100); // Green pattern for free
    }
  }
  
  return occupied;
}

void sendSensorData() {
  if (!wifiConnected) {
    return;
  }
  
  float distance = measureDistance();
  bool occupied = isSlotOccupied();
  
  // Create JSON payload
  DynamicJsonDocument doc(512);
  doc["slot_id"] = String(lot_id) + "_slot_" + String(slotNumber);
  doc["lot_id"] = lot_id;
  doc["distance"] = distance;
  doc["timestamp"] = WiFi.getTime();
  doc["status"] = occupied ? "occupied" : "free";
  doc["device_id"] = device_id;
  doc["sensor_index"] = slotNumber - 1;
  doc["signal_strength"] = WiFi.RSSI();
  doc["uptime"] = millis() / 1000;
  
  String jsonString;
  serializeJson(doc, jsonString);
  
  // Send HTTP POST request
  HTTPClient http;
  http.begin(api_endpoint + "/sensor-data");
  http.addHeader("Content-Type", "application/json");
  http.addHeader("User-Agent", "ESP8266-" + String(device_id));
  
  int httpResponseCode = http.POST(jsonString);
  
  if (httpResponseCode > 0) {
    String response = http.getString();
    Serial.println("📡 Sensor data sent successfully (HTTP " + String(httpResponseCode) + ")");
    
    // Parse response for any commands
    DynamicJsonDocument responseDoc(256);
    deserializeJson(responseDoc, response);
    
    if (responseDoc.containsKey("command")) {
      String command = responseDoc["command"];
      Serial.println("📋 Received command: " + command);
      
      if (command == "restart") {
        Serial.println("🔄 Restarting device...");
        ESP.restart();
      } else if (command == "led_test") {
        blinkLED(LED_PIN, 5, 100);
      }
    }
    
  } else {
    Serial.println("❌ Failed to send sensor data (HTTP " + String(httpResponseCode) + ")");
    handleError("HTTP request failed");
  }
  
  http.end();
}

void sendHeartbeat() {
  if (!wifiConnected) {
    return;
  }
  
  // Create heartbeat payload
  DynamicJsonDocument doc(256);
  doc["device_id"] = device_id;
  doc["timestamp"] = WiFi.getTime();
  doc["status"] = "online";
  doc["sensor_count"] = 1;
  doc["uptime"] = millis() / 1000;
  doc["free_heap"] = ESP.getFreeHeap();
  doc["signal_strength"] = WiFi.RSSI();
  doc["ip_address"] = WiFi.localIP().toString();
  
  String jsonString;
  serializeJson(doc, jsonString);
  
  // Send HTTP POST request
  HTTPClient http;
  http.begin(api_endpoint + "/device-heartbeat");
  http.addHeader("Content-Type", "application/json");
  http.addHeader("User-Agent", "ESP8266-" + String(device_id));
  
  int httpResponseCode = http.POST(jsonString);
  
  if (httpResponseCode > 0) {
    Serial.println("💓 Heartbeat sent successfully");
  } else {
    Serial.println("❌ Failed to send heartbeat (HTTP " + String(httpResponseCode) + ")");
  }
  
  http.end();
}

void blinkLED(int pin, int times, int delay_ms) {
  for (int i = 0; i < times; i++) {
    digitalWrite(pin, HIGH);
    delay(delay_ms);
    digitalWrite(pin, LOW);
    delay(delay_ms);
  }
}

void handleError(String error) {
  Serial.println("❌ Error: " + error);
  
  // Blink error pattern
  for (int i = 0; i < 5; i++) {
    digitalWrite(LED_PIN, HIGH);
    delay(100);
    digitalWrite(LED_PIN, LOW);
    delay(100);
  }
  
  // Attempt recovery
  if (error == "WiFi connection failed") {
    delay(5000);
    setupWiFi();
  }
}

// Additional utility functions
void printSystemInfo() {
  Serial.println("\n📊 System Information:");
  Serial.println("Device ID: " + String(device_id));
  Serial.println("Lot ID: " + String(lot_id));
  Serial.println("Slot Number: " + String(slotNumber));
  Serial.println("Free Heap: " + String(ESP.getFreeHeap()) + " bytes");
  Serial.println("Chip ID: " + String(ESP.getChipId()));
  Serial.println("Flash Size: " + String(ESP.getFlashChipSize()) + " bytes");
  Serial.println("WiFi Signal: " + String(WiFi.RSSI()) + " dBm");
  Serial.println("Uptime: " + String(millis() / 1000) + " seconds");
}

// Serial command handler
void handleSerialCommand() {
  if (Serial.available()) {
    String command = Serial.readStringUntil('\n');
    command.trim();
    
    if (command == "info") {
      printSystemInfo();
    } else if (command == "test") {
      Serial.println("🧪 Running sensor test...");
      float distance = measureDistance();
      bool occupied = isSlotOccupied();
      Serial.println("Distance: " + String(distance) + " cm");
      Serial.println("Status: " + String(occupied ? "OCCUPIED" : "FREE"));
    } else if (command == "restart") {
      Serial.println("🔄 Restarting device...");
      ESP.restart();
    } else if (command == "help") {
      Serial.println("📋 Available commands:");
      Serial.println("  info    - Show system information");
      Serial.println("  test    - Test sensor reading");
      Serial.println("  restart - Restart device");
      Serial.println("  help    - Show this help");
    } else {
      Serial.println("❓ Unknown command: " + command);
      Serial.println("Type 'help' for available commands");
    }
  }
}
