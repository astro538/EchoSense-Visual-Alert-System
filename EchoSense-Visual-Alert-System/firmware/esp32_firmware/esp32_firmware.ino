/*
 ==============================================================================
  AuraSound IoT: Assistive Acoustic Environmental Intelligence System
  Target Hardware:
    - ESP32 DevKit V1 (30-pin / 38-pin)
    - INMP441 I2S Digital Omnidirectional MEMS Microphone (6 pins)
    - 3-Pin Buzzer Module (VCC, GND, I/O on GPIO 18)
    - 4 Small Individual LEDs (Common Cathode):
        * 4 Long Legs (+ve Anodes) -> GPIO 12 (L1), 14 (L2), 27 (L3), 26 (L4)
        * 4 Short Legs (-ve Cathodes) -> Combined to single ESP32 GND
 ==============================================================================
*/

#include <WiFi.h>
#include <HTTPClient.h>
#include <driver/i2s.h>
#include <math.h>

// ---------------------------------------------------------------------------
// 1. NETWORK & FIREBASE CONFIGURATION
// ---------------------------------------------------------------------------
// Replace with your local WiFi network details
const char* WIFI_SSID     = "VijHouse-JioFiber-4G";
const char* WIFI_PASSWORD = "mudit@9152787816";

// Firebase Realtime Database URL and Authentication Secret
const char* FIREBASE_HOST = "https://rain-dei-default-rtdb.firebaseio.com";
const char* FIREBASE_AUTH = "xxeSyW61RLsqJLy9O9pXmHr9RK5NR8Yo7cka2W0G";

// ---------------------------------------------------------------------------
// 2. PIN DEFINITIONS (Hardware Architecture)
// ---------------------------------------------------------------------------
// INMP441 I2S MEMS Microphone
#define I2S_SD_PIN        32  // Serial Data (SD)
#define I2S_WS_PIN        25  // Word Select / LRCK (WS)
#define I2S_SCK_PIN       33  // Serial Clock / BCLK (SCK)
#define I2S_PORT          I2S_NUM_0

// 3-Pin Buzzer Module
#define BUZZER_PIN        18  // Signal I/O Pin for Room Buzzer

// 4 Individual LEDs (Common Cathode Setup)
// Each LED has one positive (long leg) and one negative (short leg).
// All 4 short legs are joined together and connected to ESP32 GND.
#define LED_L1_PIN        12  // L1 (+ve Long Leg): Level 1 - Ambient / Dialogue (> 44 dB)
#define LED_L2_PIN        14  // L2 (+ve Long Leg): Level 2 - Normal Conversation (> 58 dB)
#define LED_L3_PIN        27  // L3 (+ve Long Leg): Level 3 - High Voice/Shout   (> 72 dB)
#define LED_L4_PIN        26  // L4 (+ve Long Leg): Level 4 - Critical Peak Sound (> 84 dB)

// ESP32 Onboard Inbuilt LED (Available on all standard ESP32 DevKit V1 boards)
// Used when external LEDs are not connected, or as an additional visual beacon.
#define PIN_INBUILT_LED   2   // Built-in Blue LED on GPIO 2

// ---------------------------------------------------------------------------
// 3. AUDIO DSP & THRESHOLD CONSTANTS
// ---------------------------------------------------------------------------
#define SAMPLE_RATE       16000
#define BUFFER_SAMPLES    512

// Decibel Thresholds for 4-LED Visual Sound Bar & Onboard LED
// Calibrated so normal conversational speech (50-62 dB) does NOT false-trigger warnings!
const float DB_THRESHOLD_L1 = 44.0; // Conversation audible start
const float DB_THRESHOLD_L2 = 58.0; // Normal room dialogue
const float DB_THRESHOLD_L3 = 72.0; // Elevated Speech / Shouting / Alert
const float DB_THRESHOLD_L4 = 84.0; // Critical Peak / Bang / Shatter Alert

// Timing intervals (non-blocking)
const unsigned long PUSH_INTERVAL_MS = 300;   // Telemetry push to Firebase (~3 times/sec)
const unsigned long POLL_INTERVAL_MS = 600;   // Poll for SOS emergency state (~1.6 times/sec)
const unsigned long SOS_MAX_DURATION_MS = 7000; // Auto-silence buzzer after 7s to prevent annoyance

// ---------------------------------------------------------------------------
// 4. SYSTEM STATE VARIABLES
// ---------------------------------------------------------------------------
bool sosAlertActive             = false;
unsigned long sosTriggerTime    = 0;
unsigned long lastFirebasePushTime = 0;
unsigned long lastFirebasePollTime = 0;
unsigned long lastSerialPrintTime  = 0;
float smoothedDb                = 35.0;
int currentLedLevel             = 0;
float criticalDbLimit           = 82.0; // Dynamic critical threshold synced with web slider

// ---------------------------------------------------------------------------
// 5. I2S MICROPHONE DRIVER SETUP (INMP441)
// ---------------------------------------------------------------------------
void setupI2S() {
  i2s_config_t i2s_config = {
    .mode                 = (i2s_mode_t)(I2S_MODE_MASTER | I2S_MODE_RX),
    .sample_rate          = SAMPLE_RATE,
    .bits_per_sample      = I2S_BITS_PER_SAMPLE_32BIT, // INMP441 transmits 24-bit in 32-bit slot
    .channel_format       = I2S_CHANNEL_FMT_RIGHT_LEFT,// Accepts both L/R=GND (Left) and L/R=VDD (Right)
    .communication_format = (i2s_comm_format_t)(I2S_COMM_FORMAT_STAND_I2S),
    .intr_alloc_flags     = ESP_INTR_FLAG_LEVEL1,
    .dma_buf_count        = 4,
    .dma_buf_len          = BUFFER_SAMPLES,
    .use_apll             = false,
    .tx_desc_auto_clear   = false,
    .fixed_mclk           = 0
  };

  i2s_pin_config_t pin_config = {
    .bck_io_num   = I2S_SCK_PIN,
    .ws_io_num    = I2S_WS_PIN,
    .data_out_num = I2S_PIN_NO_CHANGE,
    .data_in_num  = I2S_SD_PIN
  };

  esp_err_t err = i2s_driver_install(I2S_PORT, &i2s_config, 0, NULL);
  if (err != ESP_OK) {
    Serial.printf("[ERROR] I2S Driver Install Failed: %d\n", err);
    return;
  }

  err = i2s_set_pin(I2S_PORT, &pin_config);
  if (err != ESP_OK) {
    Serial.printf("[ERROR] I2S Pin Config Failed: %d\n", err);
    return;
  }

  i2s_zero_dma_buffer(I2S_PORT);
  Serial.println("[OK] INMP441 I2S Microphone Initialized (16kHz, Dual-Slot 24-bit DMA).");
}

// ---------------------------------------------------------------------------
// 6. AUDIO DSP: RMS WITH DC BIAS REMOVAL & REALISTIC dB SPL
// ---------------------------------------------------------------------------
float readMicrophoneDecibels() {
  int32_t samples[BUFFER_SAMPLES];
  size_t bytesRead = 0;

  esp_err_t result = i2s_read(I2S_PORT, samples, sizeof(samples), &bytesRead, 30 / portTICK_PERIOD_MS);
  if (result != ESP_OK || bytesRead == 0) {
    return smoothedDb;
  }

  int samplesCount = bytesRead / sizeof(int32_t);
  if (samplesCount <= 0) return smoothedDb;

  // 1. First Pass: Compute DC Bias (removes hardware silicon DC offset)
  double sum = 0;
  int validCount = 0;
  for (int i = 0; i < samplesCount; i++) {
    // Shift right 8 bits: convert 32-bit slot with MSB-aligned 24-bit audio to signed integer
    int32_t s = samples[i] >> 8;
    if (s != 0) { // filter out inactive slot if mono
      sum += s;
      validCount++;
    }
  }

  if (validCount == 0) return smoothedDb;
  double dcOffset = sum / validCount;

  // 2. Second Pass: Calculate AC Energy (True acoustic pressure wave)
  double sumSquare = 0;
  for (int i = 0; i < samplesCount; i++) {
    int32_t s = samples[i] >> 8;
    if (s != 0) {
      double ac = (double)s - dcOffset;
      sumSquare += ac * ac;
    }
  }

  double meanSquare = sumSquare / validCount;
  double rms = sqrt(meanSquare);

  // 3. Calibrated Conversion from INMP441 RMS to Real-World Room Decibels (dB SPL)
  // Silence floor (rms 150 - 800) -> ~32 - 38 dB SPL
  // Conversational voice speaking near mic (rms 5000 - 30000) -> 48 - 62 dB SPL
  // Shouting / loud sound (rms 70000 - 250000) -> 72 - 82 dB SPL
  // Loud clap / bang (rms > 500000) -> 84 - 98 dB SPL
  float rawDb = 32.0;
  if (rms > 20.0) {
    rawDb = 20.0 * log10(rms) - 24.0;
  }
  if (rawDb < 30.0) rawDb = 30.0;
  if (rawDb > 102.0) rawDb = 102.0;

  // Exponential moving average filter for smooth, organic visual response
  smoothedDb = (smoothedDb * 0.65f) + (rawDb * 0.35f);
  return smoothedDb;
}

// ---------------------------------------------------------------------------
// 7. 4-LED SOUND LEVEL BAR CONTROLLER (Common Cathode)
// ---------------------------------------------------------------------------
int updateLedBar(float db) {
  // Determine active level using dynamic danger threshold set by Web Slider
  int level = 0;
  if (db >= criticalDbLimit) {
    level = 4;
  } else if (db >= DB_THRESHOLD_L3) {
    level = 3;
  } else if (db >= DB_THRESHOLD_L2) {
    level = 2;
  } else if (db >= DB_THRESHOLD_L1) {
    level = 1;
  } else {
    level = 0;
  }

  // Common Cathode Logic:
  // HIGH on GPIO pin sends 3.3V to long leg (+ve) -> LED turns ON
  // LOW on GPIO pin turns LED OFF
  digitalWrite(LED_L1_PIN, (level >= 1) ? HIGH : LOW);
  digitalWrite(LED_L2_PIN, (level >= 2) ? HIGH : LOW);
  digitalWrite(LED_L3_PIN, (level >= 3) ? HIGH : LOW);
  digitalWrite(LED_L4_PIN, (level >= 4) ? HIGH : LOW);

  // ESP32 Onboard Inbuilt LED (GPIO 2) Support:
  // Mirrors room sound activity directly on the onboard blue LED for users without external LEDs!
  if (!sosAlertActive) {
    if (level == 0) {
      digitalWrite(PIN_INBUILT_LED, LOW);
    } else if (level == 1 || level == 2) {
      digitalWrite(PIN_INBUILT_LED, HIGH); // Solid ON for ambient / conversation
    } else if (level == 3) {
      digitalWrite(PIN_INBUILT_LED, (millis() % 300 < 150) ? HIGH : LOW); // Fast pulse
    } else if (level >= 4) {
      digitalWrite(PIN_INBUILT_LED, (millis() % 100 < 50) ? HIGH : LOW); // Rapid strobe
    }
  }

  currentLedLevel = level;
  return level;
}

// ---------------------------------------------------------------------------
// 8. BUZZER CONTROLLER (Smart Safe Operation - No Useless Noise!)
// ---------------------------------------------------------------------------
// Routine audio levels do NOT trigger the buzzer.
// The buzzer ONLY sounds when an explicit SOS emergency is active.
// Includes an automatic 7-second cutoff to prevent annoying continuous noise.
void handleBuzzer() {
  static unsigned long lastToggleTime = 0;
  static bool buzzerState = false;

  if (sosAlertActive) {
    unsigned long now = millis();

    // Safety timeout: auto-shutoff if active for more than SOS_MAX_DURATION_MS
    if (now - sosTriggerTime > SOS_MAX_DURATION_MS) {
      Serial.println("[BUZZER] SOS safety timeout reached (7s). Auto-silencing room buzzer.");
      sosAlertActive = false;
      digitalWrite(BUZZER_PIN, LOW);
      digitalWrite(PIN_INBUILT_LED, LOW);
      resetSosInFirebase();
      return;
    }

    // Audible alarm cadence: alternating 100ms beep pulse + sync with onboard LED
    if (now - lastToggleTime > 100) {
      lastToggleTime = now;
      buzzerState = !buzzerState;
      digitalWrite(BUZZER_PIN, buzzerState ? HIGH : LOW);
      digitalWrite(PIN_INBUILT_LED, buzzerState ? HIGH : LOW); // Flash onboard LED synchronously!
    }
  } else {
    digitalWrite(BUZZER_PIN, LOW);
  }
}

// ---------------------------------------------------------------------------
// 9. FIREBASE REALTIME DATABASE SYNC (Zero-Dependency JSON)
// ---------------------------------------------------------------------------
void pushTelemetryToFirebase(float db, int ledLevel) {
  if (WiFi.status() != WL_CONNECTED) return;

  HTTPClient http;
  String url = String(FIREBASE_HOST) + "/live_telemetry.json";
  if (strlen(FIREBASE_AUTH) > 0) {
    url += "?auth=" + String(FIREBASE_AUTH);
  }

  http.begin(url);
  http.addHeader("Content-Type", "application/json");

  // Format valid JSON payload directly (zero external library dependency)
  char jsonBuffer[256];
  snprintf(jsonBuffer, sizeof(jsonBuffer),
    "{\"sound_level_db\":%.1f,\"led_level\":%d,\"high_voice_detected\":%s,\"peak_sound_detected\":%s,\"device_status\":\"ONLINE\",\"timestamp_ms\":%lu}",
    db,
    ledLevel,
    (db >= DB_THRESHOLD_L3) ? "true" : "false",
    (db >= DB_THRESHOLD_L4) ? "true" : "false",
    millis()
  );

  int httpResponseCode = http.PUT((uint8_t*)jsonBuffer, strlen(jsonBuffer));
  http.end();

  // If high voice or peak sound detected, also record in event log
  if (db >= DB_THRESHOLD_L3 && httpResponseCode > 0) {
    logSoundEventToFirebase(db);
  }
}

void logSoundEventToFirebase(float db) {
  if (WiFi.status() != WL_CONNECTED) return;

  // Rate limit event logs to prevent flooding
  static unsigned long lastEventLogTime = 0;
  if (millis() - lastEventLogTime < 2500) return;
  lastEventLogTime = millis();

  HTTPClient http;
  String url = String(FIREBASE_HOST) + "/sound_events.json";
  if (strlen(FIREBASE_AUTH) > 0) {
    url += "?auth=" + String(FIREBASE_AUTH);
  }

  http.begin(url);
  http.addHeader("Content-Type", "application/json");

  const char* eventClass = (db >= DB_THRESHOLD_L4) ? "PEAK_CRACK_ALERT" : "HIGH_VOICE";
  const char* displayName = (db >= DB_THRESHOLD_L4) ? "Peak Acoustic Impact" : "High Voice / Shouting";
  const char* severity = (db >= DB_THRESHOLD_L4) ? "CRITICAL" : "WARNING";
  const char* icon = (db >= DB_THRESHOLD_L4) ? "💥" : "🗣️";

  char jsonBuffer[320];
  snprintf(jsonBuffer, sizeof(jsonBuffer),
    "{\"sound_class\":\"%s\",\"display_name\":\"%s\",\"icon\":\"%s\",\"severity\":\"%s\",\"decibels\":%.1f,\"source\":\"ESP32_ROOM_MIC\",\"timestamp_ms\":%lu}",
    eventClass, displayName, icon, severity, db, millis()
  );

  http.POST((uint8_t*)jsonBuffer, strlen(jsonBuffer));
  http.end();
}

void checkSosTriggerFromFirebase() {
  if (WiFi.status() != WL_CONNECTED) return;

  HTTPClient http;
  String url = String(FIREBASE_HOST) + "/sos_alert.json";
  if (strlen(FIREBASE_AUTH) > 0) {
    url += "?auth=" + String(FIREBASE_AUTH);
  }

  http.begin(url);
  int httpCode = http.GET();

  if (httpCode == HTTP_CODE_OK) {
    String response = http.getString();
    bool shouldBeActive = (response.indexOf("true") >= 0);

    if (shouldBeActive && !sosAlertActive) {
      Serial.println("\n[ALERT] Emergency SOS Triggered from Web Portal! Room Buzzer Activated.");
      sosAlertActive = true;
      sosTriggerTime = millis();
    } else if (!shouldBeActive && sosAlertActive) {
      Serial.println("[INFO] SOS Alarm Silenced from Web Portal.");
      sosAlertActive = false;
      digitalWrite(BUZZER_PIN, LOW);
    }
  }
  http.end();
}

void checkRemoteConfig() {
  static unsigned long lastConfigCheck = 0;
  if (millis() - lastConfigCheck < 3500 || WiFi.status() != WL_CONNECTED) return;
  lastConfigCheck = millis();

  HTTPClient http;
  String url = String(FIREBASE_HOST) + "/config/critical_db_threshold.json";
  if (strlen(FIREBASE_AUTH) > 0) url += "?auth=" + String(FIREBASE_AUTH);
  http.begin(url);
  int httpCode = http.GET();
  if (httpCode == HTTP_CODE_OK) {
    String resp = http.getString();
    float val = resp.toFloat();
    if (val >= 60.0 && val <= 98.0) {
      if (abs(val - criticalDbLimit) > 0.5) {
        criticalDbLimit = val;
        Serial.printf("\n[CONFIG] Danger Threshold updated from Web Slider: %.1f dB\n", criticalDbLimit);
      }
    }
  }
  http.end();
}

void resetSosInFirebase() {
  if (WiFi.status() != WL_CONNECTED) return;

  HTTPClient http;
  String url = String(FIREBASE_HOST) + "/sos_alert.json";
  if (strlen(FIREBASE_AUTH) > 0) {
    url += "?auth=" + String(FIREBASE_AUTH);
  }

  http.begin(url);
  http.addHeader("Content-Type", "application/json");
  http.PUT((uint8_t*)"false", 5);
  http.end();
}

// ---------------------------------------------------------------------------
// 10. ARDUINO SETUP & INITIALIZATION
// ---------------------------------------------------------------------------
void setup() {
  Serial.begin(115200);
  delay(600);

  Serial.println("\n========================================================");
  Serial.println("  AuraSound IoT: Assistive Environmental Sound Intelligence");
  Serial.println("  Dedicated Node for Deaf & Hard of Hearing Awareness");
  Serial.println("========================================================");

  // Setup 4-LED pins (Common Cathode) + Inbuilt Blue LED on GPIO 2
  pinMode(LED_L1_PIN, OUTPUT);
  pinMode(LED_L2_PIN, OUTPUT);
  pinMode(LED_L3_PIN, OUTPUT);
  pinMode(LED_L4_PIN, OUTPUT);
  pinMode(PIN_INBUILT_LED, OUTPUT);
  digitalWrite(PIN_INBUILT_LED, LOW);

  // Visual startup LED test sweep
  Serial.println("[INIT] Testing 4-LED bar (Common Cathode) + Onboard LED...");
  digitalWrite(PIN_INBUILT_LED, HIGH);
  digitalWrite(LED_L1_PIN, HIGH); delay(120);
  digitalWrite(LED_L2_PIN, HIGH); delay(120);
  digitalWrite(LED_L3_PIN, HIGH); delay(120);
  digitalWrite(LED_L4_PIN, HIGH); delay(250);
  digitalWrite(PIN_INBUILT_LED, LOW);
  digitalWrite(LED_L1_PIN, LOW);
  digitalWrite(LED_L2_PIN, LOW);
  digitalWrite(LED_L3_PIN, LOW);
  digitalWrite(LED_L4_PIN, LOW);
  Serial.println("[OK] 4-LED Bar Verified: L1(12), L2(14), L3(27), L4(26) + Onboard LED (GPIO 2)");

  // Setup Buzzer pin
  pinMode(BUZZER_PIN, OUTPUT);
  digitalWrite(BUZZER_PIN, LOW);

  // Quick 60ms verification chirp
  digitalWrite(BUZZER_PIN, HIGH); delay(60);
  digitalWrite(BUZZER_PIN, LOW);
  Serial.println("[OK] Buzzer Verified on GPIO 18 (Idle / Standby)");

  // Setup INMP441 Microphone via I2S DMA
  setupI2S();

  // Connect to WiFi
  Serial.printf("[WIFI] Connecting to SSID: %s", WIFI_SSID);
  WiFi.mode(WIFI_STA);
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);

  int retries = 0;
  while (WiFi.status() != WL_CONNECTED && retries < 24) {
    delay(400);
    Serial.print(".");
    retries++;
  }

  if (WiFi.status() == WL_CONNECTED) {
    Serial.println("\n[OK] WiFi Connected Successfully!");
    Serial.printf("     IP Address : %s\n", WiFi.localIP().toString().c_str());
    Serial.printf("     RSSI Signal: %d dBm\n", WiFi.RSSI());
    Serial.printf("     Target RTDB: %s\n", FIREBASE_HOST);
    
    // Clear any stuck SOS alarm on startup
    resetSosInFirebase();
  } else {
    Serial.println("\n[WARN] WiFi offline or credentials pending.");
    Serial.println("       Operating in Local Offline Assistive Mode (LED bar & Mic active).");
  }
  Serial.println("--------------------------------------------------------");
}

// ---------------------------------------------------------------------------
// 11. REALTIME MAIN LOOP
// ---------------------------------------------------------------------------
void loop() {
  // 1. Read real-time audio pressure from INMP441
  float currentDb = readMicrophoneDecibels();

  // 2. Drive 4-LED Sound Level Bar (Common Cathode)
  int ledLevel = updateLedBar(currentDb);

  // 3. Handle Buzzer (Smart Alert with safety cutoff - no useless buzzing)
  handleBuzzer();

  unsigned long now = millis();

  // 4. Periodically push live decibel & LED state to Firebase Realtime Database
  if (now - lastFirebasePushTime >= PUSH_INTERVAL_MS) {
    lastFirebasePushTime = now;
    pushTelemetryToFirebase(currentDb, ledLevel);
  }

  // 5. Periodically check if Web Portal triggered Emergency SOS
  if (now - lastFirebasePollTime >= POLL_INTERVAL_MS) {
    lastFirebasePollTime = now;
    checkSosTriggerFromFirebase();
    checkRemoteConfig();
  }

  // 6. Serial Monitor Real-Time Telemetry Bar (115200 baud)
  if (now - lastSerialPrintTime >= 500) {
    lastSerialPrintTime = now;

    // Construct ASCII visual bar
    char bar[5];
    bar[0] = (ledLevel >= 1) ? '#' : '-';
    bar[1] = (ledLevel >= 2) ? '#' : '-';
    bar[2] = (ledLevel >= 3) ? '#' : '-';
    bar[3] = (ledLevel >= 4) ? '#' : '-';
    bar[4] = '\0';

    Serial.printf("[AUDIO] dB: %5.1f | Bar: [%s] L%d | WiFi: %s | SOS: %s\n",
      currentDb,
      bar,
      ledLevel,
      (WiFi.status() == WL_CONNECTED) ? "ONLINE" : "OFFLINE",
      sosAlertActive ? "ALARM!" : "IDLE"
    );
  }

  // Small delay for RTOS task yield
  delay(15);
}
