# 🛡️ GuardianAI - Standalone Visual & Audible Safety System

**GuardianAI** is a real-time, multimodal emergency detection system that combines computer vision (gesture detection) and audio analysis (acoustic anomaly monitoring) to trigger local emergency responses, record incident logs, and capture camera snapshots.

---

## ✨ Features

- 🖐️ **Visual SOS Gesture Recognition**
  - Powered by **MediaPipe Hand Landmarker**.
  - Detects closed-fist emergency gesture held continuously for **1.8 seconds** to avoid false positives.

- 🔊 **Acoustic Anomaly Detection**
  - Monitors ambient sound continuously via microphone input using `sounddevice` and `numpy`.
  - Tracks a dynamic ambient noise floor to automatically detect audio energy spikes (e.g., screams, shouts, glass shattering).

- 🚨 **Emergency Dispatch & Response**
  - **Audible Alert**: Plays emergency warning beeps asynchronously.
  - **Snapshot Storage**: Automatically saves high-resolution image snapshots of incidents in the `incident_snapshots/` directory.
  - **Event Logging**: Stores event timestamps, event types, and snapshot paths in a local **SQLite** database (`guardian_events.db`).

- 🖥️ **Live HUD Dashboard & Night Guard**
  - Displays real-time system status and an **Audio Level Meter** overlay.
  - Features a **Night Guard** indicator active during restricted hours (10:00 PM – 6:00 AM).

- 🎮 **Camera Fallback & Interactive Simulation**
  - If a webcam is unavailable or locked, the system automatically falls back to an interactive canvas mode with keyboard simulation.

- 📦 **Automatic Model Downloading**
  - Automatically fetches the official Google MediaPipe `hand_landmarker.task` vision model on first run.

---

## 📁 Repository Structure

```text
visual-audible-security/
│
├── sos2.py                    # Main application script
├── requirements.txt           # Python dependencies
├── hand_landmarker.task       # MediaPipe Hand Landmarker model (auto-downloaded)
├── guardian_events.db         # SQLite database logging incidents (auto-generated)
├── incident_snapshots/        # Saved image snapshots during alerts (auto-generated)
└── README.md                  # System documentation
```

---

## ⚙️ Prerequisites & Setup

### 1. Requirements

- **Python**: Version `3.9` or higher recommended.
- **Hardware**:
  - Webcam / Camera (or run in simulation mode)
  - Microphone for acoustic monitoring
  - Windows OS (for `winsound` emergency buzzer support)

---

### 2. Installation

Clone or download the repository, then install the required dependencies using `pip`:

```bash
pip install -r requirements.txt
```

---

## 🚀 Running the System

Start the safety monitor by executing:

```bash
python sos2.py
```

### Controls & Simulation Keys

| Key / Gesture | Action |
|---|---|
| **Hold Fist (1.8s)** | Triggers Visual SOS Distress alert & snapshot |
| **Loud Sound / Scream** | Triggers Acoustic Threat Alert & snapshot |
| **`s`** (Canvas Mode) | Simulates Visual SOS Gesture |
| **`a`** (Canvas Mode) | Simulates Acoustic Threat |
| **`q`** | Safely exits the application |

---

## 🗄️ Incident Logging & Database

When an emergency event is triggered, an entry is written to `guardian_events.db` in the `event_logs` table:

```sql
CREATE TABLE event_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    timestamp TEXT,
    event_type TEXT,
    snapshot_path TEXT
);
```

Snapshots are stored as:
`incident_snapshots/INCIDENT_YYYYMMDD_HHMMSS.jpg`

---

## 🔧 System Configuration

You can customize detection sensitivity and timing directly inside [sos2.py](file:///c:/Users/win%2010/Desktop/My-project/SOS_Detector/visual-audible-security/sos2.py):

```python
# Audio Spike Sensitivity Multiplier
AUDIO_SPIKE_FACTOR = 3.5

# Restricted Night Guard Hours (24h format)
RESTRICTED_START_HOUR = 22  # 10 PM
RESTRICTED_END_HOUR = 6     # 6 AM

# Required SOS Fist Gesture Hold Time (seconds)
REQUIRED_SOS_HOLD_TIME = 1.8
```

---

## 📜 License

This project is open-source and intended for safety research and educational implementation.
