# Google Firebase Realtime Database Setup Guide
## Assistive IoT Sound Intelligence System for Deaf & Hard of Hearing

This guide provides step-by-step instructions to configure **Firebase Realtime Database** for your ESP32 microcontroller, Python AI Sound Classifier, and the Web Portal.

---

## 1. Create a Firebase Project

1. Open the [Google Firebase Console](https://console.firebase.google.com/).
2. Sign in with your Google Account.
3. Click **"Add Project"** (or "Create a project").
4. Enter a project name (e.g., `aurasound-iot-assistive`).
5. Disable Google Analytics (optional, not needed for Realtime Database) and click **"Create Project"**.

---

## 2. Create the Realtime Database

1. In the left navigation menu of the Firebase Console, go to **Build** > **Realtime Database**.
2. Click the **"Create Database"** button.
3. Choose a database location closest to your location (e.g., `United States (us-central1)`, `Singapore (asia-southeast1)`, or `Belgium (europe-west1)`).
4. For security rules, select **"Start in test mode"**.
   > [!NOTE]
   > Test mode allows immediate read/write access so your ESP32 and web app can communicate without needing complex OAuth tokens during development.

---

## 3. Realtime Database Security Rules

Navigate to the **"Rules"** tab inside Realtime Database and paste the following rules:

```json
{
  "rules": {
    ".read": true,
    ".write": true
  }
}
```

Click **"Publish"**.

> [!TIP]
> **For Production Deployment**: Once testing is complete, you can secure the rules with an authentication secret or user login:
> ```json
> {
>   "rules": {
>     "live_telemetry": { ".read": true, ".write": "auth != null" },
>     "latest_sound_classification": { ".read": true, ".write": "auth != null" },
>     "sound_events": { ".read": true, ".write": "auth != null" },
>     "sos_alert": { ".read": true, ".write": true }
>   }
> }
> ```

---

## 4. Retrieve Your Database URL

1. In the **"Data"** tab of Realtime Database, look at the top of the tree view.
2. You will see a URL formatted like:
   ```
   https://YOUR-PROJECT-ID-default-rtdb.firebaseio.com/
   ```
3. Copy this URL (without the trailing slash `/`).

---

## 5. JSON Database Schema

The system automatically manages 4 nodes in your Realtime Database:

```json
{
  "live_telemetry": {
    "sound_level_db": 68.4,
    "led_level": 2,
    "high_voice_detected": false,
    "peak_sound_detected": false,
    "device_status": "ONLINE",
    "timestamp_ms": 1725372800000
  },
  "latest_sound_classification": {
    "sound_class": "GLASS_CRACK",
    "display_name": "Glass Cracking / Breaking",
    "icon": "💥",
    "severity": "CRITICAL",
    "confidence": 0.94,
    "decibels": 88.5,
    "suggested_action": "High alert! Check windows, doors, or fallen glassware.",
    "timestamp": "2026-09-03T15:10:00Z"
  },
  "sos_alert": false,
  "sound_events": {
    "-O7xyz123abc": {
      "sound_class": "HIGH_VOICE",
      "display_name": "High Voice / Shouting",
      "icon": "🗣️",
      "severity": "WARNING",
      "confidence": 0.89,
      "decibels": 76.2,
      "timestamp": "2026-09-03T15:08:22Z"
    }
  }
}
```

---

## 6. Linking the Components

### A. Linking the ESP32 Firmware
Open `firmware/esp32_firmware/esp32_firmware.ino` in Arduino IDE or VS Code:
```cpp
const char* WIFI_SSID     = "Your_WiFi_Name";
const char* WIFI_PASSWORD = "Your_WiFi_Password";
const char* FIREBASE_HOST = "https://YOUR-PROJECT-ID-default-rtdb.firebaseio.com";
```

### B. Linking the Python Sound Classifier
When launching `python_backend/sound_classifier.py`, specify your URL:
```bash
python sound_classifier.py --firebase-url "https://YOUR-PROJECT-ID-default-rtdb.firebaseio.com" --mode sim
```
Or for live microphone:
```bash
python sound_classifier.py --firebase-url "https://YOUR-PROJECT-ID-default-rtdb.firebaseio.com" --mode live
```

### C. Linking the Web Portal
1. Open the web portal in your browser (`web_portal/index.html`).
2. Click the ⚙️ (Settings gear icon) in the top right header.
3. Paste your Realtime Database URL into the **Realtime Database URL** field.
4. Click **"Save & Connect"**.
5. The portal will automatically switch from Simulation Mode to Live Firebase mode!
