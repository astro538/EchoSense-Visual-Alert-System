# EchoSense — Visual Alert System for Deaf and Hard-of-Hearing Users

EchoSense is an assistive-technology prototype that combines acoustic monitoring, visual cues, an ESP32 device, and a web dashboard. Its goal is to help users notice important sounds in an indoor environment without depending on hearing alone.

**Project status:** research/prototype work. The system has not been validated as a certified smoke alarm, emergency-response device, or safety-critical detector.

## Problem and approach

Everyday sounds such as knocking, barking, alarms, and raised voices may be difficult to notice for people who are deaf or hard of hearing. EchoSense explores how microphone input can be translated into visible notifications and a user-controlled emergency workflow.

The system is split into cooperating components:

- **ESP32 firmware:** reads an INMP441 I2S microphone, calculates a smoothed sound-level estimate, drives a four-LED level bar, and checks Firebase for a manual SOS/buzzer command.
- **Python backend:** performs audio analysis/classification and publishes event information for the dashboard. The repository includes both `sound_classifier.py` and a separate `visual.py`/YAMNet integration path; check which entry point is used in a particular demo.
- **Firebase Realtime Database:** synchronizes telemetry, latest classification, event history, configuration, and the SOS state.
- **Web portal:** displays sound/event information, visual warnings, event history, sound-level readings, and the manual SOS workflow.

## Architecture

```text
Room sound
   |
   +--> INMP441 --> ESP32 --> RMS / sound-level estimate --> 4-LED bar
   |                   |
   |                   +--> Wi-Fi --> Firebase Realtime Database
   |
   +--> Computer microphone --> Python audio analysis/classifier
                                  |
                                  +--> event updates --> Firebase
                                                          |
                                                          v
                                                  Web dashboard
                                             visual alerts + event log
                                             manual SOS --> buzzer state
```

The ESP32's sound-level thresholds are heuristic estimates. Calibrated dB SPL measurement requires calibration against a known reference meter and suitable microphone response correction.

## Hardware

- ESP32 DevKit V1
- INMP441 I2S digital microphone
- Four discrete LEDs for sound-level indication
- Buzzer module for a manually triggered SOS alert
- Computer with microphone for the Python classification path
- Wi-Fi network and a Firebase Realtime Database project

### Current firmware pin map

| Component | ESP32 pin |
| --- | --- |
| INMP441 SD | GPIO 32 |
| INMP441 WS / LRCK | GPIO 25 |
| INMP441 SCK / BCLK | GPIO 33 |
| Buzzer signal | GPIO 18 |
| LED level 1 | GPIO 12 |
| LED level 2 | GPIO 14 |
| LED level 3 | GPIO 27 |
| LED level 4 | GPIO 26 |
| On-board LED | GPIO 2 |

For full wiring details, see [`connections.txt`](connections.txt).

## Repository layout

```text
EchoSense-Visual-Alert-System/
├── firmware/esp32_firmware/esp32_firmware.ino
├── python_backend/
│   ├── sound_classifier.py
│   ├── visual.py
│   ├── automated_emergency_call.py
│   └── requirements.txt
├── web_portal/
│   ├── index.html
│   ├── styles.css
│   └── app.js
├── connections.txt
├── firebase_setup_guide.md
├── start_python_classifier.bat
└── start_web_portal.bat
```

The repository also contains a nested `EchoSense-Visual-Alert-System/` directory with a copy of several project files. The paths above refer to the repository-root copy.

## Software requirements

- Python 3.10+ (use a version compatible with the dependencies in `python_backend/requirements.txt`)
- Arduino IDE with ESP32 board support
- Firebase Realtime Database
- A modern browser
- Python dependencies from `python_backend/requirements.txt`

## Setup

### 1. Configure Firebase securely

1. Create a Firebase project and Realtime Database.
2. Follow [`firebase_setup_guide.md`](firebase_setup_guide.md) to identify the database nodes and configure the portal.
3. Use authentication and least-privilege database rules. **Do not use public read/write rules in a deployed system.**
4. Keep database credentials and authentication tokens outside tracked source code.

**Credential warning:** previously committed versions of the source include Wi-Fi credentials and a Firebase authentication value. Rotate/revoke exposed credentials immediately. Removing a value from the latest file does not remove it from Git history; rotate first, then clean the source and review repository history. Never copy real secrets into this README or a public commit.

### 2. Run the web portal

From the repository root:

```bash
cd web_portal
python -m http.server 8080
```

Open [http://localhost:8080](http://localhost:8080). The portal contains demo/simulation controls; connecting live telemetry requires valid Firebase configuration. Depending on browser security restrictions, serve the page over HTTP rather than opening the file directly.

### 3. Run the Python classifier

```bash
cd python_backend
python -m venv .venv
```

Activate the environment, then install the listed dependencies:

**Windows PowerShell**
```powershell
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
python sound_classifier.py --help
```

**macOS / Linux**
```bash
source .venv/bin/activate
pip install -r requirements.txt
python sound_classifier.py --help
```

Check the script's supported command-line arguments before selecting live microphone or simulation mode. The separate `visual.py` path uses YAMNet through TensorFlow Hub and has its own integration settings. Do not assume the two Python files use the same inference pipeline.

### 4. Flash the ESP32

1. Open `firmware/esp32_firmware/esp32_firmware.ino` in Arduino IDE.
2. Install ESP32 board support.
3. Add Wi-Fi and Firebase configuration locally, without committing secrets.
4. Verify the pin mapping against `connections.txt`.
5. Select the correct board and port, upload the sketch, and inspect Serial Monitor at 115200 baud.
6. Confirm microphone readings, LED level changes, Firebase connectivity, and manual SOS/buzzer operation separately.

The checked-in firmware polls the Firebase `/sos_alert` node to drive the buzzer. If the physical SOS switch is part of the prototype build, ensure its GPIO input and event/message path are present in the exact firmware version being demonstrated.

## Accessibility interaction

The intended feedback path emphasizes visual indication: LED levels on the device, visual event notifications in the portal, and a separate manual SOS workflow. The system should not depend on an automatic high-decibel trigger to dispatch emergency messages. Browser-vibration code may exist in the current front-end source, but haptic feedback is not a core output described for this prototype.

## Testing and evaluation

Test the components independently before an integrated demonstration:

- Verify I2S microphone input and repeatability of sound-level readings.
- Test the LED thresholds with a reference sound meter where possible.
- Evaluate the classifier on labelled recordings separate from any examples used during development.
- Record per-class precision, recall, F1, false-trigger rate, and end-to-end latency.
- Verify the manual SOS path, connectivity failure behaviour, and buzzer auto-timeout.
- Test the interface with people from the intended user group only with informed consent and appropriate supervision.

The repository does not currently provide a reproducible, independent benchmark for sound-event accuracy. Do not treat hand-set thresholds or model confidence as proof of reliable emergency detection.

## Known limitations

- The project contains multiple generations of the Python classification/integration code; align the selected entry point and endpoint configuration before a demo.
- A local web server, Python process, Wi-Fi connection, and Firebase configuration may all be required for full integration.
- Browser visual effects do not guarantee that a notification will be noticed.
- A decibel estimate without acoustic calibration is not a certified SPL measurement.
- This prototype must not replace certified smoke/fire alarms, emergency communication systems, or accessibility accommodations.

## Future work

- Centralize configuration in environment variables and example configuration files.
- Remove duplicate project copies and add automated setup checks.
- Add labelled, participant-consented evaluation data and reproducible test scripts.
- Add device/API authentication, secure Firebase rules, and clearer offline behaviour.
- Document the physical SOS input and its message dispatch path alongside the wiring guide.

## License and attribution

Review third-party library and asset licenses before redistribution. Add an explicit project license if you intend to publish the code for reuse.
