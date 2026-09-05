# AuraSound IoT: Assistive Environmental Sound Intelligence & Alert System
### An IoT & Machine Learning Acoustic Awareness System for Deaf & Hard of Hearing Individuals

---

## 1. Executive Summary & Problem Statement

Individuals who are deaf or hard of hearing face significant accessibility barriers in indoor and domestic environments. Critical everyday sounds—such as someone shouting or calling their name, glass breaking or falling, a baby crying, door knocking, smoke alarms, or a pet alerting—cannot be perceived through auditory channels. 

**AuraSound IoT** bridges this sensory gap by transforming room acoustic vibrations into instant, accessible visual intelligence. The system employs:
1. An **ESP32 microcontroller** paired with an **INMP441 high-precision I2S digital MEMS microphone** that continuously samples room sound pressure levels with zero analog noise.
2. A **4-LED sound level visual bar** (`L1`, `L2`, `L3`, `L4`) providing immediate local visual indication of ambient sound intensity.
3. A **Python AI / Acoustic Digital Signal Processing (DSP) Engine** capable of recognizing distinct acoustic events (e.g., Dog Barking, Glass Cracking, Baby Crying, Door Knocks, High Voice/Shouting, and Fire Alarms).
4. A **Google Firebase Realtime Database** cloud synchronization pipeline.
5. An **Assistive Web Portal** featuring full-screen visual strobe flashes, live decibel VU meters, event history logs, and a bidirectional **Emergency SOS Buzzer trigger** that activates the physical room buzzer on demand.

---

## 2. System Architecture

```
                       +-----------------------------------+
                       |    ROOM ACOUSTIC ENVIRONMENT      |
                       +-----------------------------------+
                                         |
                                         v
                         +-------------------------------+
                         |   INMP441 I2S Digital Mic     |
                         |   (24-bit PCM via I2S DMA)    |
                         +-------------------------------+
                                         |
                                         v
+---------------------------------------------------------------------------------+
|                               ESP32 MICROCONTROLLER                             |
|                                                                                 |
|  [I2S Audio Capture] ---> [RMS & Decibel DSP] ---> [4-LED VU Meter Driver]      |
|                                    |                        |                   |
|                                    v                        v                   |
|                          [WiFi HTTP Client]             [L1, L2, L3, L4]        |
|                                    |                                            |
|                                    |<------------------ [Buzzer Driver (GPIO18)]|
+---------------------------------------------------------------------------------+
                                     |                           ^
                                     v                           |
                    +----------------------------------+         |
                    |  GOOGLE FIREBASE REALTIME DB     |         |
                    |  - /live_telemetry               |         |
                    |  - /latest_sound_classification  |         |
                    |  - /sound_events                 |         |
                    |  - /sos_alert -----------------------------+
                    +----------------------------------+
                             ^                     ^
                             |                     |
                             v                     v
     +-------------------------------+   +------------------------------------+
     |   PYTHON SOUND CLASSIFIER     |   |       ASSISTIVE WEB PORTAL         |
     |   - FFT & Spectral Centroid   |   |   - Fullscreen Strobe Visual Alert |
     |   - Zero Crossing Rate & ZCR  |   |   - Real-time Decibel Gauge        |
     |   - Pattern Classifier:       |   |   - Virtual 4-LED Status Bar       |
     |     * Glass Crack 💥          |   |   - Emergency SOS Buzzer Trigger   |
     |     * Dog Bark 🐕             |   |   - Sound Event History Log        |
     |     * Baby Cry 👶             |   |   - Haptic Vibration Notification  |
     |     * High Voice 🗣️           |   +------------------------------------+
     |     * Siren Alarm 🚨          |
     +-------------------------------+
```

---

## 3. Hardware Bill of Materials & Pinout

| Component | Model / Spec | Interface | ESP32 Pin Connection | Purpose |
| :--- | :--- | :--- | :--- | :--- |
| **Microcontroller** | ESP32 DevKit V1 (30/38 pin) | USB / 3.3V Logic | - | Core processing & WiFi gateway |
| **Digital Microphone** | INMP441 Omnidirectional MEMS | I2S Digital | VDD -> `3V3`<br>GND -> `GND`<br>SD -> `GPIO 32`<br>WS -> `GPIO 25`<br>SCK -> `GPIO 33`<br>L/R -> `GND` | Captures high-definition 24-bit audio without analog interference |
| **Buzzer Module** | 3-Pin Module (Active / Passive) | Digital I/O | VCC -> `3V3`<br>GND -> `GND`<br>I/O -> `GPIO 18` | Audible room alert triggered via Emergency SOS from web |
| **4-LED Sound Bar** | 4-LED Bar (Green, Yellow, Orange, Red) | Digital GPIO | L1 -> `GPIO 12`<br>L2 -> `GPIO 14`<br>L3 -> `GPIO 27`<br>L4 -> `GPIO 26`<br>Cathode -> `GND` | Hardware visual level meter (low, moderate, high voice, peak) |

> Complete ASCII schematics and wiring safety rules are documented in [`connections.txt`](connections.txt).

---

## 4. Software Modules Overview

### 4.1 ESP32 Firmware (`firmware/esp32_firmware/esp32_firmware.ino`)
- **I2S DMA Audio Pipeline**: Direct memory access ring buffer sampling audio at 16,000 Hz in 24-bit precision.
- **RMS Sound Decibel Conversion**: Calculates calibrated decibel Sound Pressure Level (dB SPL) with exponential smoothing filters.
- **4-Level LED Thresholding**:
  - `L1 (GPIO 12)`: Active at $\ge 45\text{ dB}$ (Low ambient conversation).
  - `L2 (GPIO 14)`: Active at $\ge 58\text{ dB}$ (Normal room talk).
  - `L3 (GPIO 27)`: Active at $\ge 70\text{ dB}$ (High voice / loud sound).
  - `L4 (GPIO 26)`: Active at $\ge 82\text{ dB}$ (Critical peak / shattering / screams).
- **Firebase Synchronization**: Pushes live decibels and sound alerts to Firebase Realtime Database over WiFi HTTPS REST.
- **Bidirectional SOS Buzzer**: Polls `/sos_alert` and activates a distinct cadence on `GPIO 18` when triggered from the web portal.

### 4.2 Python AI Sound Classifier (`python_backend/sound_classifier.py`)
- **Acoustic Feature Extraction**:
  - *Spectral Centroid*: Frequency brightness distinguishing glass shattering (>3.5 kHz) from voices and barking.
  - *Zero Crossing Rate (ZCR)* & *Crest Factor*: Distinguishes explosive transients from continuous tones.
  - *Harmonic Pitch Estimation*: Identifies infant distress frequencies (450–600 Hz) and siren sweeps.
- **Target Sound Classifications**:
  - 💥 **Glass Cracking / Breaking**: High-frequency acoustic transient and rapid decay.
  - 🐕 **Dog Barking**: Periodic mid-frequency envelope bursts.
  - 👶 **Baby Crying**: Modulated high-pitch vocal harmonic pattern.
  - 🚪 **Door Knock**: Low-frequency resonant impact pulses (<500 Hz).
  - 🗣️ **High Voice / Shouting**: High vocal band energy (1 kHz–3 kHz).
  - 🚨 **Siren / Fire Alarm**: Continuous tonal emergency sweep.
- **Dual Operating Modes**:
  - `Live Microphone Mode`: Captures PC mic input in real time.
  - `Simulation Mode`: Generates synthetic waveforms with interactive terminal keys (`1`–`6`, `A`) for quick testing without hardware.

### 4.3 Assistive Web Portal (`web_portal/`)
- **Accessible Design for Deaf & Hard of Hearing**:
  - **Fullscreen Visual Strobe Alert**: Replaces audible cues with flashing visual warnings for urgent events.
  - **Haptic Vibration**: Uses the browser Vibration API to buzz smartphones on critical events.
  - **Sound Decibel Gauge**: Circular progress arc showing current room decibel levels.
  - **Virtual 4-LED Display**: Matches physical ESP32 `L1`–`L4` state in real-time.
  - **Emergency SOS Controller**: One-click button to trigger the room's physical ESP32 buzzer.
  - **Simulation & Demo Mode**: Built-in sound demo chips allowing instant presentation even without active hardware.
  - **Firebase Configuration Drawer**: Allows plugging in custom Firebase project URLs in seconds.

---

## 5. Directory Structure

```
Intellectual/
├── connections.txt                     # Detailed pin-to-pin wiring guide & ASCII schematic
├── firebase_setup_guide.md             # Firebase Realtime Database setup instructions
├── README.md                           # Comprehensive engineering project report
├── firmware/
│   └── esp32_firmware/
│       └── esp32_firmware.ino          # ESP32 C++ Arduino firmware (I2S, LEDs, Buzzer, Firebase)
├── python_backend/
│   ├── sound_classifier.py            # AI audio DSP & classification engine
│   └── requirements.txt               # Python dependencies (numpy, scipy, sounddevice)
└── web_portal/
    ├── index.html                      # Accessible assistive HTML dashboard
    ├── styles.css                      # Ultra-premium dark glassmorphism styling & strobe animations
    └── app.js                          # Real-time Firebase sync, VU meter, and SOS controller
```

---

## 6. Quick Start & Execution

### Step 1: Open the Web Portal
Double-click [`web_portal/index.html`](web_portal/index.html) or run a local server:
```bash
cd web_portal
python -m http.server 8080
```
Open `http://localhost:8080` in your web browser. You can immediately test all features using the **Demo Sim** chips (Dog Barking, Glass Crack, Baby Cry, High Voice, Siren) and test the **Emergency SOS** button.

### Step 2: Run the Python Sound Classifier
```bash
cd python_backend
pip install -r requirements.txt
python sound_classifier.py --mode sim
```
Press keys `1` through `6` to simulate different sound profiles, or run with `--mode live` to classify live sounds from your microphone.

### Step 3: Flash the ESP32 Hardware
1. Connect the ESP32, INMP441, Buzzer, and 4-LEDs according to [`connections.txt`](connections.txt).
2. Open `firmware/esp32_firmware/esp32_firmware.ino` in Arduino IDE.
3. In the Library Manager, install **ArduinoJson** and **ESP32 Board package**.
4. Set your WiFi credentials and your Firebase database URL.
5. Select board **"ESP32 Dev Module"** and upload.

---

## 7. Verification & Testing

- **INMP441 Audio Capture**: Verified I2S DMA initialization on GPIO 32/25/33.
- **LED Meter Mapping**: Verified monotonic activation of L1 (45 dB), L2 (58 dB), L3 (70 dB), and L4 (82 dB).
- **Acoustic Classifier**: Successfully verified spectral centroid and energy features against synthetic waveforms for cracks, barks, knocks, cries, and shouts.
- **SOS Buzzer Control**: Bidirectional synchronization between web portal button and ESP32 hardware verified via `/sos_alert` node.
- **Accessibility UI**: Verified high-contrast visual strobe flash on critical sound detection.

---

## 8. License & Acknowledgements
Developed with Google DeepMind Antigravity for assistive IoT accessibility.
Open-source under the MIT License.
