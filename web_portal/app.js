/**
 * ==============================================================================
 *  AuraSound IoT: Assistive Acoustic Environmental Intelligence Web Portal
 *  Real-Time Firebase Realtime Database Engine & Sensory Accessibility System
 * ==============================================================================
 */

// -----------------------------------------------------------------------------
// 1. CONFIGURATION & STATE MANAGEMENT
// -----------------------------------------------------------------------------
const CONFIG = {
  DEFAULT_FIREBASE_URL: "https://rain-dei-default-rtdb.firebaseio.com",
  DEFAULT_AUTH_TOKEN: "xxeSyW61RLsqJLy9O9pXmHr9RK5NR8Yo7cka2W0G",
  FALLBACK_POLL_INTERVAL_MS: 900
};

// Sound Catalog & Visual Strobe Themes
const SOUND_CATALOG = {
  NORMAL_AMBIENT: {
    name: "Room Quiet & Normal",
    icon: "🍃",
    severity: "NORMAL",
    badgeClass: "normal",
    description: "The microphone is monitoring room acoustics. Sounds like loud voices, dog barks, or cracks will trigger instant visual notifications.",
    actionCue: "No abnormal sound detected. Room acoustics are tranquil.",
    tier: 0,
    strobeColor: "none"
  },
  SIREN_ALARM: {
    name: "Fire Alarm / Emergency Siren",
    icon: "🚨",
    severity: "EMERGENCY",
    badgeClass: "critical",
    description: "Continuous high-decibel emergency siren detected! Smoke alarm, security system, or fire alarm.",
    actionCue: "URGENT SAFETY: Check smoke detectors or evacuate premises immediately!",
    tier: 1,
    strobeColor: "red"
  },
  GLASS_CRACK: {
    name: "Glass Cracking / Breaking",
    icon: "💥",
    severity: "CRITICAL",
    badgeClass: "critical",
    description: "High-frequency acoustic fracture identified! Sharp transient sound typical of breaking glass, dropped items, or crack.",
    actionCue: "Inspect windows, sliding doors, or kitchen for fallen glassware!",
    tier: 2,
    strobeColor: "red"
  },
  BABY_CRY: {
    name: "Baby Crying / Distress",
    icon: "👶",
    severity: "HIGH",
    badgeClass: "warning",
    description: "Continuous infant distress harmonic pattern detected. Baby or child crying in nursery.",
    actionCue: "Check infant's crib or nursery immediately.",
    tier: 2,
    strobeColor: "pink"
  },
  DOOR_KNOCK: {
    name: "Door Knock / Visitor Tap",
    icon: "🚪",
    severity: "INFO",
    badgeClass: "normal",
    description: "Rhythmic low-frequency impact pulses identified on the entrance door.",
    actionCue: "A visitor or delivery person is knocking at your entrance.",
    tier: 3,
    strobeColor: "blue"
  },
  DOORBELL: {
    name: "Doorbell Chime",
    icon: "🔔",
    severity: "INFO",
    badgeClass: "normal",
    description: "Harmonic two-tone resonant doorbell chime detected.",
    actionCue: "Someone has pressed the entrance doorbell.",
    tier: 3,
    strobeColor: "blue"
  },
  DOG_BARK: {
    name: "Dog Barking",
    icon: "🐕",
    severity: "WARNING",
    badgeClass: "warning",
    description: "Repetitive animal acoustic bark bursts recognized outside or near premises.",
    actionCue: "Check entrance or yard for pets or visitors.",
    tier: 3,
    strobeColor: "amber"
  },
  HIGH_VOICE: {
    name: "High Voice / Shouting",
    icon: "🗣️",
    severity: "WARNING",
    badgeClass: "warning",
    description: "Elevated human speech energy or distress shout identified by room microphone.",
    actionCue: "Someone in the room or vicinity is speaking loudly or calling out.",
    tier: 4,
    strobeColor: "purple"
  }
};

// Global App State
const state = {
  firebaseUrl: localStorage.getItem("aura_firebase_url") || CONFIG.DEFAULT_FIREBASE_URL,
  authToken: localStorage.getItem("aura_auth_token") || CONFIG.DEFAULT_AUTH_TOKEN,
  
  // Realtime Audio & Hardware Mirror
  currentDb: 38.0,
  currentLedLevel: 0,
  lastHardwarePing: 0,
  espStatus: "CONNECTING", // ONLINE, STANDBY, OFFLINE
  activeSoundClass: "NORMAL_AMBIENT",
  activeSeverity: "NORMAL",
  confidence: 0.98,
  
  // SOS & Buzzer
  sosActive: false,
  sosCountdownTimer: null,
  residentAddress: localStorage.getItem("aura_resident_address") || "Hostel Block B, Room 204",
  activeEmergencyCall: {
    inProgress: false,
    category: null,
    phone: "",
    messageText: "",
    repeatTimer: null
  },
  
  // Historical Log (Persisted in localStorage with baseline events)
  events: JSON.parse(localStorage.getItem("aura_event_logs") || JSON.stringify([
    {
      id: "evt_init_1",
      timestamp: new Date(Date.now() - 360000).toISOString(),
      timestamp_epoch: Date.now() - 360000,
      sound_class: "HIGH_VOICE",
      display_name: "High Voice / Shouting",
      icon: "🗣️",
      severity: "WARNING",
      decibels: 74,
      suggested_action: "Elevated human voice energy identified in room."
    },
    {
      id: "evt_init_2",
      timestamp: new Date(Date.now() - 840000).toISOString(),
      timestamp_epoch: Date.now() - 840000,
      sound_class: "DOOR_KNOCK",
      display_name: "Door Knock / Visitor",
      icon: "🚪",
      severity: "INFO",
      decibels: 56,
      suggested_action: "Physical knock detected at room entrance."
    },
    {
      id: "evt_init_3",
      timestamp: new Date(Date.now() - 1500000).toISOString(),
      timestamp_epoch: Date.now() - 1500000,
      sound_class: "NORMAL_AMBIENT",
      display_name: "Room Quiet & Normal",
      icon: "🍃",
      severity: "NORMAL",
      decibels: 35,
      suggested_action: "Baseline room acoustic floor established."
    }
  ])),
  historyFilter: "ALL",

  // Automated Voice Warning & WhatsApp Technology
  ttsVoiceAlerts: localStorage.getItem("aura_tts_alerts") !== "false",
  criticalDbThreshold: parseFloat(localStorage.getItem("aura_critical_db_threshold")) || 82.0,
  lastAutoWhatsDispatch: 0,
  lastLoudSoundAlertTime: 0,
  lastTtsAnnounceTime: 0,
  
  // Sensory Matrix Preferences (EchoSense Overload Prevention)
  sensoryPrefs: JSON.parse(localStorage.getItem("aura_sensory_prefs") || JSON.stringify({
    tier2_strobe: true,
    tier2_vibe: true,
    tier2_led: true,
    tier3_strobe: false,
    tier3_vibe: true,
    tier3_led: true,
    tier4_strobe: false,
    tier4_vibe: false,
    tier4_led: true
  })),

  // Emergency Contacts (EchoSense Feature)
  contacts: JSON.parse(localStorage.getItem("aura_emergency_contacts") || JSON.stringify([
    { id: 1, name: "Family / Emergency Caregiver", role: "Caregiver", phone: "+919876543210" },
    { id: 2, name: "Hostel Warden / Neighbor", role: "Facility Support", phone: "+919123456780" }
  ])),

  // Speech Recognition (STT)
  speechRecognition: null,
  isListeningStt: false,

  // Audio Input Source Selection: 'esp32' (INMP441) or 'laptop' (Laptop Mic)
  audioSource: localStorage.getItem("aura_audio_source") || "esp32",
  laptopMediaStream: null,
  laptopAudioContext: null,
  laptopAnalyser: null,
  laptopAnimFrameId: null,
  lastLaptopPushTime: 0,

  // Event Source & Polling
  eventSource: null,
  pollTimer: null,
  heartbeatTimer: null
};


// -----------------------------------------------------------------------------
// 2. FIREBASE REALTIME DATABASE SYNC ENGINE (SSE STREAM + POLLING)
// -----------------------------------------------------------------------------
function initFirebaseSync() {
  console.log(`[FIREBASE] Initializing Live Stream to: ${state.firebaseUrl}`);
  
  // Close any existing SSE connection
  if (state.eventSource) {
    try { state.eventSource.close(); } catch (e) {}
  }

  // Setup Server-Sent Events (SSE) stream for zero-latency Firebase sync
  try {
    const sseUrl = `${state.firebaseUrl.replace(/\/$/, '')}/.json?auth=${state.authToken}`;
    state.eventSource = new EventSource(sseUrl);

    state.eventSource.addEventListener('put', (e) => {
      try {
        const payload = JSON.parse(e.data);
        handleFirebaseStreamPacket(payload.path, payload.data);
      } catch (err) {
        console.warn("[FIREBASE SSE Parse Error]", err);
      }
    });

    state.eventSource.onopen = () => {
      console.log("[FIREBASE] SSE Stream Connected Successfully.");
      updateFirebaseStatus(true, "Firebase RTDB: Connected");
    };

    state.eventSource.onerror = () => {
      console.warn("[FIREBASE] SSE Stream reconnecting...");
      updateFirebaseStatus(false, "Reconnecting RTDB...");
    };
  } catch (err) {
    console.error("[FIREBASE] SSE Init Failed:", err);
  }

  // Fallback Polling (Every 900ms) to ensure continuous synchronization
  if (state.pollTimer) clearInterval(state.pollTimer);
  state.pollTimer = setInterval(pollFirebaseSnapshot, CONFIG.FALLBACK_POLL_INTERVAL_MS);

  // Initial immediate snapshot pull
  pollFirebaseSnapshot();

  // ESP32 Hardware Heartbeat Monitor (Runs every 1000ms)
  if (state.heartbeatTimer) clearInterval(state.heartbeatTimer);
  state.heartbeatTimer = setInterval(evaluateHardwareHeartbeat, 1000);
}

function handleFirebaseStreamPacket(path, data) {
  if (!data) return;

  // Root data snapshot
  if (path === "/" || path === "") {
    if (data.live_telemetry) processTelemetryUpdate(data.live_telemetry);
    if (data.latest_sound_classification) processSoundClassification(data.latest_sound_classification);
    if (data.sos_alert !== undefined) processSosUpdate(data.sos_alert);
    if (data.sound_events) processHistoricalEvents(data.sound_events);
  }
  // Telemetry sub-path
  else if (path.startsWith("/live_telemetry")) {
    if (path === "/live_telemetry") processTelemetryUpdate(data);
    else if (path === "/live_telemetry/sound_level_db") updateDecibelGauge(data);
    else if (path === "/live_telemetry/led_level") updateVirtualLedBar(data);
  }
  // Classification sub-path
  else if (path.startsWith("/latest_sound_classification")) {
    processSoundClassification(data);
  }
  // SOS alert sub-path
  else if (path.startsWith("/sos_alert")) {
    processSosUpdate(data);
  }
  // Events sub-path
  else if (path.startsWith("/sound_events")) {
    processHistoricalEvents(data);
  }
}

async function pollFirebaseSnapshot() {
  if (!state.firebaseUrl) return;
  const cleanUrl = state.firebaseUrl.replace(/\/$/, '') + `/.json?auth=${state.authToken}`;

  try {
    const res = await fetch(cleanUrl);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    if (data) {
      updateFirebaseStatus(true, "Firebase RTDB: Live");
      if (data.live_telemetry) processTelemetryUpdate(data.live_telemetry);
      if (data.latest_sound_classification) processSoundClassification(data.latest_sound_classification);
      if (data.sos_alert !== undefined) processSosUpdate(data.sos_alert);
      if (data.sound_events) processHistoricalEvents(data.sound_events);
    }
  } catch (err) {
    updateFirebaseStatus(false, "Sync Offline");
  }
}


// -----------------------------------------------------------------------------
// 3. HARDWARE & AUDIO TELEMETRY PROCESSORS
// -----------------------------------------------------------------------------
function processTelemetryUpdate(telemetry) {
  if (!telemetry) return;

  // Always track ESP32 hardware heartbeat
  if (telemetry.timestamp_ms) {
    state.lastHardwarePing = Date.now();
    evaluateHardwareHeartbeat();
  }

  // If user selected Laptop Mic as input, don't let ESP32 overwrite the live decibel display
  if (state.audioSource === "laptop") {
    return;
  }

  // 1. Decibels
  if (telemetry.sound_level_db !== undefined) {
    const db = parseFloat(telemetry.sound_level_db) || 30.0;
    updateDecibelGauge(db);

    // High dB warning on telemetry: Visual warning only. SOS is strictly manual!
    const now = Date.now();
    if (db >= state.criticalDbThreshold && (now - state.lastLoudSoundAlertTime > 6000)) {
      state.lastLoudSoundAlertTime = now;

      const eventData = {
        sound_class: "HIGH_VOLUME_PEAK",
        display_name: "High Sound Peak (INMP441)",
        severity: "WARNING",
        icon: "🔊",
        decibels: Math.round(db),
        suggested_action: `INMP441 room mic sensed ${Math.round(db)} dB (exceeded ${state.criticalDbThreshold} dB warning threshold). Emergency SOS is manual-only.`
      };

      recordSoundEvent(eventData);
      processSoundClassification(eventData);
    }
  }

  // 2. Hardware 4-LED status
  if (telemetry.led_level !== undefined) {
    updateVirtualLedBar(telemetry.led_level);
  }
}

function updateDecibelGauge(dbVal) {
  const db = parseFloat(dbVal) || 30.0;
  state.currentDb = db;

  const dbEl = document.getElementById("decibelVal");
  if (dbEl) dbEl.textContent = db.toFixed(1);

  // SVG Gauge Arc Math (radius 82, circumference ~ 515.22)
  const circle = document.getElementById("gaugeCircleFill");
  if (circle) {
    const circumference = 2 * Math.PI * 82;
    // Map 30 dB -> 100 dB across 100% of arc
    const pct = Math.min(Math.max((db - 30.0) / 70.0, 0), 1);
    const strokeOffset = circumference * (1 - pct);
    circle.style.strokeDashoffset = strokeOffset;

    // Color gradient based on intensity
    if (db >= 80) circle.style.stroke = "#ef4444";
    else if (db >= 68) circle.style.stroke = "#f97316";
    else if (db >= 55) circle.style.stroke = "#f59e0b";
    else circle.style.stroke = "#10b981";
  }

  // Context Text & Chip
  const contextEl = document.getElementById("decibelContext");
  const chipEl = document.getElementById("dbStatusChip");

  let statusText = "Quiet Ambient";
  let chipClass = "normal";

  if (db >= 80) {
    statusText = "Critical Peak Sound!";
    chipClass = "critical";
  } else if (db >= 68) {
    statusText = "Elevated Voice / Loud";
    chipClass = "warning";
  } else if (db >= 55) {
    statusText = "Moderate Conversation";
    chipClass = "normal";
  }

  if (contextEl) contextEl.textContent = statusText;
  if (chipEl) {
    chipEl.textContent = statusText;
    chipEl.className = `chip-status ${chipClass}`;
  }
}

function updateVirtualLedBar(level) {
  const lvl = parseInt(level) || 0;
  state.currentLedLevel = lvl;

  const leds = [
    document.getElementById("virtualLed1"),
    document.getElementById("virtualLed2"),
    document.getElementById("virtualLed3"),
    document.getElementById("virtualLed4")
  ];

  leds.forEach((ledEl, index) => {
    if (!ledEl) return;
    if (index < lvl) {
      ledEl.classList.add("active");
    } else {
      ledEl.classList.remove("active");
    }
  });

  const levelTxtEl = document.getElementById("activeLevelTxt");
  const chipEl = document.getElementById("ledStatusChip");
  
  const levelNames = [
    "Level 0 (All LEDs OFF)",
    "Level 1: L1 ON (Green > 42 dB)",
    "Level 2: L1 & L2 ON (Yellow > 55 dB)",
    "Level 3: L1, L2, L3 ON (Orange > 68 dB)",
    "Level 4: All 4 LEDs ON (Red Peak > 80 dB)"
  ];

  if (levelTxtEl) levelTxtEl.textContent = levelNames[lvl] || `Level ${lvl}`;
  if (chipEl) chipEl.textContent = `L${lvl} Active`;
}

function evaluateHardwareHeartbeat() {
  const pill = document.getElementById("deviceStatusPill");
  const dot = document.getElementById("espStatusDot");
  const text = document.getElementById("deviceStatusText");
  if (!pill || !dot || !text) return;

  const delta = Date.now() - state.lastHardwarePing;

  if (state.lastHardwarePing === 0) {
    dot.className = "status-dot connecting";
    text.textContent = "Connecting RTDB...";
    state.espStatus = "CONNECTING";
  } else if (delta < 4000) {
    dot.className = "status-dot online";
    text.textContent = `ESP32 Active (${(delta / 1000).toFixed(1)}s)`;
    state.espStatus = "ONLINE";
  } else if (delta < 12000) {
    dot.className = "status-dot standby";
    text.textContent = "ESP32 Standby";
    state.espStatus = "STANDBY";
  } else {
    dot.className = "status-dot offline";
    text.textContent = "ESP32 Offline";
    state.espStatus = "OFFLINE";
  }
}

function updateFirebaseStatus(online, message) {
  const pill = document.getElementById("firebaseStatusPill");
  const text = document.getElementById("firebaseStatusText");
  if (!pill || !text) return;

  const dot = pill.querySelector(".status-dot");
  if (dot) dot.className = `status-dot ${online ? 'online' : 'offline'}`;
  text.textContent = message;
}


// -----------------------------------------------------------------------------
// 3B. AUDIO INPUT SOURCE SWITCHING (ESP32 INMP441 vs LAPTOP MIC)
// -----------------------------------------------------------------------------
async function setAudioSource(source) {
  state.audioSource = source;
  localStorage.setItem("aura_audio_source", source);

  const btnEsp32 = document.getElementById("btnSourceEsp32");
  const btnLaptop = document.getElementById("btnSourceLaptop");
  const badge = document.getElementById("activeMicSourceBadge");

  if (source === "laptop") {
    if (btnEsp32) btnEsp32.classList.remove("active");
    if (btnLaptop) btnLaptop.classList.add("active", "live-mic");
    if (badge) {
      badge.innerHTML = `<i class="fa-solid fa-laptop"></i> Laptop Mic (Live)`;
      badge.classList.add("laptop-active");
    }
    await startLaptopMicCapture();
  } else {
    if (btnLaptop) btnLaptop.classList.remove("active", "live-mic");
    if (btnEsp32) btnEsp32.classList.add("active");
    if (badge) {
      badge.innerHTML = `<i class="fa-solid fa-microchip"></i> INMP441`;
      badge.classList.remove("laptop-active");
    }
    stopLaptopMicCapture();
    startSyntheticOscilloscope();
  }
}

let sustainedHighVoiceFrames = 0;

async function startLaptopMicCapture() {
  stopLaptopMicCapture(); // Clear any previous streams

  try {
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: {
        echoCancellation: false,
        noiseSuppression: false,
        autoGainControl: false
      }
    });

    state.laptopMediaStream = stream;
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    state.laptopAudioContext = new AudioCtx();

    if (state.laptopAudioContext.state === "suspended") {
      await state.laptopAudioContext.resume();
    }

    const sourceNode = state.laptopAudioContext.createMediaStreamSource(stream);
    const analyser = state.laptopAudioContext.createAnalyser();
    analyser.fftSize = 512;
    analyser.smoothingTimeConstant = 0.4;
    sourceNode.connect(analyser);
    state.laptopAnalyser = analyser;

    console.log("[AUDIO] Laptop Microphone Input Activated (Realistic Calibrated Sensitivity).");

    const timeBuffer = new Float32Array(analyser.fftSize);
    let smoothedDb = 34.0;

    function analyzeLaptopAudio() {
      if (state.audioSource !== "laptop" || !state.laptopAnalyser) return;

      analyser.getFloatTimeDomainData(timeBuffer);

      // 1. Draw Live Acoustic Waveform Oscilloscope in real time
      drawLiveOscilloscope(timeBuffer);

      // 2. Compute RMS
      let sumSquares = 0;
      for (let i = 0; i < timeBuffer.length; i++) {
        sumSquares += timeBuffer[i] * timeBuffer[i];
      }
      const rms = Math.sqrt(sumSquares / timeBuffer.length);

      // 3. Calibrated Realistic dB SPL Conversion (+78 dB Reference)
      // Normal conversation (45 - 60 dB), Shouting (72 - 80 dB), Loud Crash / Scream (> 82 dB)
      let rawDb = 32.0;
      if (rms > 0.0001) {
        rawDb = 20.0 * Math.log10(rms) + 78.0;
      }
      rawDb = Math.min(Math.max(rawDb, 30.0), 100.0);

      // Exponential Smoothing for calm, stable visual read
      smoothedDb = (smoothedDb * 0.70) + (rawDb * 0.30);

      // Map dB to 4-LED level
      let ledLevel = 0;
      if (smoothedDb >= state.criticalDbThreshold) ledLevel = 4;
      else if (smoothedDb >= 72.0) ledLevel = 3;
      else if (smoothedDb >= 58.0) ledLevel = 2;
      else if (smoothedDb >= 44.0) ledLevel = 1;

      // Update Decibel Gauge & 4-LED Bar
      updateDecibelGauge(smoothedDb);
      updateVirtualLedBar(ledLevel);

      const now = Date.now();

      // =======================================================================
      // SMART ACOUSTIC DETECTION & DEBOUNCE LOGIC (No false alarms on whispers)
      // =======================================================================
      
      // A) HIGH SOUND LEVEL WARNING (exceeding adjustable slider threshold)
      // Visual & log warning ONLY. Does NOT trigger SOS button or auto-dispatch calls!
      if (smoothedDb >= state.criticalDbThreshold && (now - state.lastLoudSoundAlertTime > 6000)) {
        state.lastLoudSoundAlertTime = now;
        sustainedHighVoiceFrames = 0;

        const eventData = {
          sound_class: "HIGH_VOLUME_PEAK",
          display_name: "High Volume Acoustic Peak",
          severity: "WARNING",
          icon: "🔊",
          decibels: Math.round(smoothedDb),
          suggested_action: `Sound reached ${Math.round(smoothedDb)} dB (crossed ${state.criticalDbThreshold} dB warning threshold). Visual indicator active. Emergency SOS is strictly manual.`
        };

        // 1. Record to persistent localStorage & UI feeds
        recordSoundEvent(eventData);

        // 2. Update Hero Spotlight
        processSoundClassification(eventData);

        // NOTE: triggerEmergencySos() and autoDispatchEmergencyAlert() removed!
        // SOS is strictly manual via the SOS button.
      }
      // B) ELEVATED VOICE / SHOUTING (72 dB - 81 dB)
      else if (smoothedDb >= 72.0 && smoothedDb < 82.0 && (now - state.lastLoudSoundAlertTime > 5000)) {
        // Require speech to be sustained for at least 150ms (not a keyboard click)
        sustainedHighVoiceFrames++;
        if (sustainedHighVoiceFrames > 7) {
          state.lastLoudSoundAlertTime = now;
          sustainedHighVoiceFrames = 0;

          const eventData = {
            sound_class: "HIGH_VOICE",
            display_name: "Elevated Voice / Shouting",
            severity: "WARNING",
            icon: "🗣️",
            decibels: Math.round(smoothedDb),
            suggested_action: "Elevated human voice energy detected in the room."
          };

          recordSoundEvent(eventData);
          processSoundClassification(eventData);
          speakVoiceWarning("Notice: Elevated voice or shouting detected.");
        }
      }
      // C) NORMAL CONVERSATIONAL SPEECH / AMBIENT (< 68 dB)
      else if (smoothedDb < 68.0) {
        sustainedHighVoiceFrames = 0;
        // If system was showing an alert and 6 seconds have passed in silence, restore normal hero
        if (now - state.lastLoudSoundAlertTime > 6000 && state.activeSoundClass !== "NORMAL_AMBIENT") {
          processSoundClassification({
            sound_class: "NORMAL_AMBIENT",
            display_name: "Room Quiet & Normal",
            severity: "NORMAL",
            confidence: 0.98,
            suggested_action: "Room monitoring active. No abnormal sound."
          });
        }
      }

      // Periodically sync live telemetry to Firebase (~3 times/sec)
      if (now - state.lastLaptopPushTime > 320) {
        state.lastLaptopPushTime = now;
        syncLaptopTelemetryToFirebase(smoothedDb, ledLevel);
      }

      state.laptopAnimFrameId = requestAnimationFrame(analyzeLaptopAudio);
    }

    analyzeLaptopAudio();

  } catch (err) {
    console.error("[AUDIO] Laptop Mic Capture Error:", err);
    alert("Could not access laptop microphone. Please ensure microphone permissions are granted in your browser.");
    setAudioSource("esp32");
  }
}

function stopLaptopMicCapture() {
  if (state.laptopAnimFrameId) {
    cancelAnimationFrame(state.laptopAnimFrameId);
    state.laptopAnimFrameId = null;
  }
  if (state.laptopMediaStream) {
    state.laptopMediaStream.getTracks().forEach(track => track.stop());
    state.laptopMediaStream = null;
  }
  if (state.laptopAudioContext) {
    try { state.laptopAudioContext.close(); } catch (e) {}
    state.laptopAudioContext = null;
  }
  state.laptopAnalyser = null;
  console.log("[AUDIO] Laptop Microphone Deactivated.");
}

async function syncLaptopTelemetryToFirebase(db, ledLevel) {
  if (!state.firebaseUrl) return;
  const cleanUrl = state.firebaseUrl.replace(/\/$/, '') + `/live_telemetry.json?auth=${state.authToken}`;

  const payload = {
    sound_level_db: Math.round(db * 10) / 10,
    led_level: ledLevel,
    high_voice_detected: (db >= 72.0),
    peak_sound_detected: (db >= 82.0),
    device_status: "ONLINE",
    audio_source: "LAPTOP_MIC",
    timestamp_ms: Date.now()
  };

  try {
    await fetch(cleanUrl, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
  } catch (e) {}
}

// -----------------------------------------------------------------------------
// 3C. REAL-TIME ACOUSTIC WAVEFORM OSCILLOSCOPE ENGINE
// -----------------------------------------------------------------------------
function drawLiveOscilloscope(timeBuffer) {
  const canvas = document.getElementById("liveOscilloscope");
  if (!canvas) return;
  const ctx = canvas.getContext("2d");
  const width = canvas.width;
  const height = canvas.height;

  ctx.fillStyle = "#070a10";
  ctx.fillRect(0, 0, width, height);

  // Center reference line
  ctx.strokeStyle = "rgba(255, 255, 255, 0.05)";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(0, height / 2);
  ctx.lineTo(width, height / 2);
  ctx.stroke();

  // Draw Audio Waveform Curve
  ctx.lineWidth = 2;
  ctx.strokeStyle = (state.currentDb >= 82) ? "#ef4444" : (state.currentDb >= 72 ? "#f97316" : "#06b6d4");
  ctx.shadowColor = ctx.strokeStyle;
  ctx.shadowBlur = 6;
  ctx.beginPath();

  const sliceWidth = width / timeBuffer.length;
  let x = 0;

  for (let i = 0; i < timeBuffer.length; i++) {
    const v = timeBuffer[i];
    const y = (height / 2) + (v * (height / 2.2));
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
    x += sliceWidth;
  }

  ctx.stroke();
  ctx.shadowBlur = 0;
}

let syntheticOscAnimId = null;
function startSyntheticOscilloscope() {
  if (syntheticOscAnimId) return;
  const canvas = document.getElementById("liveOscilloscope");
  if (!canvas) return;
  const ctx = canvas.getContext("2d");
  let phase = 0;

  function renderSynthOsc() {
    if (state.audioSource === "laptop") {
      syntheticOscAnimId = null;
      return;
    }

    const width = canvas.width;
    const height = canvas.height;
    ctx.fillStyle = "#070a10";
    ctx.fillRect(0, 0, width, height);

    ctx.strokeStyle = "rgba(255, 255, 255, 0.05)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, height / 2);
    ctx.lineTo(width, height / 2);
    ctx.stroke();

    const ampRatio = Math.min(Math.max((state.currentDb - 30) / 60, 0.05), 1.0);
    const amp = ampRatio * (height / 2.4);

    ctx.lineWidth = 2;
    ctx.strokeStyle = (state.currentDb >= 82) ? "#ef4444" : (state.currentDb >= 72 ? "#f97316" : "#06b6d4");
    ctx.shadowColor = ctx.strokeStyle;
    ctx.shadowBlur = 6;
    ctx.beginPath();

    for (let x = 0; x < width; x += 2) {
      const y = (height / 2) + Math.sin((x * 0.06) + phase) * amp * Math.sin(x * 0.015);
      if (x === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();
    ctx.shadowBlur = 0;

    phase += 0.12;
    syntheticOscAnimId = requestAnimationFrame(renderSynthOsc);
  }

  syntheticOscAnimId = requestAnimationFrame(renderSynthOsc);
}

// -----------------------------------------------------------------------------
// 3D. WEBAPP AUDIBLE VOICE TTS ENGINE & AUTOMATED DISPATCH
// -----------------------------------------------------------------------------
function toggleTtsVoiceAlerts() {
  state.ttsVoiceAlerts = !state.ttsVoiceAlerts;
  localStorage.setItem("aura_tts_alerts", state.ttsVoiceAlerts);
  const btn = document.getElementById("btnVoiceAlertToggle");
  const text = document.getElementById("voiceToggleText");
  const icon = document.getElementById("voiceToggleIcon");

  if (state.ttsVoiceAlerts) {
    if (btn) btn.classList.add("active");
    if (text) text.textContent = "Voice Alert: ON";
    if (icon) icon.className = "fa-solid fa-volume-high";
    speakVoiceWarning("Audible voice alert warnings enabled.");
  } else {
    if (btn) btn.classList.remove("active");
    if (text) text.textContent = "Voice Alert: OFF";
    if (icon) icon.className = "fa-solid fa-volume-xmark";
  }
}

let lastTtsSpeakTime = 0;
function speakVoiceWarning(text) {
  if (!state.ttsVoiceAlerts || !('speechSynthesis' in window)) return;
  const now = Date.now();
  if (now - lastTtsSpeakTime < 3500) return;
  lastTtsSpeakTime = now;

  try {
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = 1.05;
    utterance.pitch = 1.0;
    window.speechSynthesis.speak(utterance);
  } catch (e) {
    console.warn("[TTS Warning Error]", e);
  }
}

function autoDispatchEmergencyAlert(db, reason) {
  const now = Date.now();
  if (now - state.lastAutoWhatsDispatch < 45000) {
    console.log("[AUTO-WHATSAPP] Cooldown active, skipping duplicate dispatch.");
    return;
  }
  state.lastAutoWhatsDispatch = now;

  // 1. Gather last 5 acoustic logs
  const last5 = state.events.slice(0, 5);
  let logText = "1. [Current Alert] 💥 " + reason + " (" + Math.round(db) + " dB) - CRITICAL";
  if (last5.length > 0) {
    logText = last5.map((ev, idx) => {
      const t = ev.timestamp ? new Date(ev.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }) : "Recent";
      return `${idx + 1}. [${t}] ${ev.icon || '🔊'} ${ev.display_name || ev.sound_class} (${ev.decibels || '--'} dB) - ${ev.severity || 'INFO'}`;
    }).join("\n");
  }

  const fullMsg = `🚨 CRITICAL EMERGENCY ALERT - AuraSound Assistive Room System\n` +
    `A deaf/hard of hearing individual requires immediate attention!\n\n` +
    `⚠️ TRIGGER: ${reason.toUpperCase()} (${Math.round(db)} dB SPL)\n` +
    `🕒 TIME: ${new Date().toLocaleTimeString()}\n\n` +
    `📋 RECENT 5 ROOM ACOUSTIC LOGS:\n${logText}\n\n` +
    `📍 Physical room buzzer on GPIO 18 has been sounded. Please check on me or call immediately!`;

  console.log("[AUTO-WHATSAPP] Automated message generated:\n", fullMsg);

  // 2. Show on-screen toast HUD with instant 1-click fallback links
  showEmergencyDispatchToast(db, reason, fullMsg);

  // 3. Automated dispatch to all saved contacts without user friction
  if (state.contacts && state.contacts.length > 0) {
    state.contacts.forEach((contact, idx) => {
      const cleanPhone = contact.phone.replace(/[^0-9]/g, '');
      if (!cleanPhone) return;
      const waUrl = `https://api.whatsapp.com/send/?phone=${cleanPhone}&text=${encodeURIComponent(fullMsg)}`;
      setTimeout(() => {
        try {
          const win = window.open(waUrl, "_blank");
          if (!win || win.closed || typeof win.closed === 'undefined') {
            console.warn("[AUTO-WHATSAPP] Browser pop-up blocked for:", contact.name);
          }
        } catch (e) {
          console.warn("[AUTO-WHATSAPP] Window open blocked:", e);
        }
      }, idx * 700);
    });
  }

  // 4. Record automated dispatch in log table
  recordSoundEvent({
    sound_class: "WHATSAPP_AUTO_DISPATCH",
    display_name: "Emergency WhatsApp Dispatched",
    severity: "CRITICAL",
    icon: "📲",
    decibels: Math.round(db),
    action: `Automated alert with last 5 logs sent to ${state.contacts.length} saved contacts.`
  });
}

function showEmergencyDispatchToast(db, reason, fullMsg, customTitle) {
  const toast = document.getElementById("emergencyDispatchToast");
  const actions = document.getElementById("toastContactButtons");
  const summary = document.getElementById("dispatchToastSummary");
  const titleEl = toast ? toast.querySelector(".toast-info strong") : null;
  if (!toast) return;

  if (titleEl) {
    titleEl.innerHTML = customTitle || "🚨 CRITICAL SOUND DETECTED & AUTOMATIC WHATSAPP ALERT DISPATCHED";
  }

  if (summary) {
    const contactNames = state.contacts.map(c => c.name).join(", ");
    summary.textContent = `Emergency distress alert for "${state.residentAddress}" ready for ${state.contacts.length} contacts (${contactNames}). Room buzzer active on GPIO 18.`;
  }

  if (actions) {
    actions.innerHTML = "";
    state.contacts.forEach(c => {
      const clean = c.phone.replace(/[^0-9]/g, '');
      const link = document.createElement("a");
      link.className = "btn-toast-contact";
      link.href = `https://api.whatsapp.com/send/?phone=${clean}&text=${encodeURIComponent(fullMsg)}`;
      link.target = "_blank";
      link.innerHTML = `<i class="fa-brands fa-whatsapp"></i> ${escapeHtml(c.name)}`;
      actions.appendChild(link);
    });
  }

  toast.classList.remove("hidden");
}

function dismissEmergencyToast() {
  const toast = document.getElementById("emergencyDispatchToast");
  if (toast) toast.classList.add("hidden");
}

// -----------------------------------------------------------------------------
// 3E. ADJUSTABLE DANGER THRESHOLD SLIDER CONTROLLER
// -----------------------------------------------------------------------------
function onCriticalThresholdChange(val) {
  const num = parseFloat(val);
  state.criticalDbThreshold = num;
  localStorage.setItem("aura_critical_db_threshold", num);

  const chip = document.getElementById("thresholdDisplayChip");
  const text = document.getElementById("sliderValueText");
  let label = "Default";
  if (num <= 65) label = "Sensitive";
  else if (num <= 75) label = "Normal Speech";
  else if (num <= 84) label = "Loud Shout";
  else label = "Extreme Danger";

  if (chip) chip.textContent = `${num} dB • ${label}`;
  if (text) text.textContent = `${num} dB SPL`;

  // Sync to Firebase so ESP32 firmware updates its danger threshold dynamically!
  syncThresholdToFirebase(num);
}

async function syncThresholdToFirebase(threshold) {
  if (!state.firebaseUrl) return;
  const cleanUrl = state.firebaseUrl.replace(/\/$/, '') + `/config/critical_db_threshold.json?auth=${state.authToken}`;
  try {
    await fetch(cleanUrl, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(threshold)
    });
    console.log(`[CONFIG] Synced critical danger threshold to Firebase: ${threshold} dB`);
  } catch (e) {
    console.warn("[CONFIG] Failed to sync threshold to Firebase:", e);
  }
}


// -----------------------------------------------------------------------------
// 4. SOUND CLASSIFICATION & VISUAL STROBE ALERT
// -----------------------------------------------------------------------------
function processSoundClassification(classification) {
  if (!classification) return;

  const soundClass = classification.sound_class || "NORMAL_AMBIENT";
  const profile = SOUND_CATALOG[soundClass] || SOUND_CATALOG["NORMAL_AMBIENT"];

  state.activeSoundClass = soundClass;
  state.activeSeverity = classification.severity || profile.severity;
  state.confidence = classification.confidence || 0.95;

  // Update Hero Card UI
  const titleEl = document.getElementById("heroSoundTitle");
  const descEl = document.getElementById("heroSoundDescription");
  const emojiEl = document.getElementById("heroSoundEmoji");
  const badgeEl = document.getElementById("alertSeverityBadge");
  const actionEl = document.getElementById("heroActionCue");
  const confValEl = document.getElementById("confidenceVal");
  const confBarEl = document.getElementById("confidenceBar");
  const lastTimeEl = document.getElementById("lastDetectionTime");
  const heroCard = document.getElementById("heroAlertCard");

  if (titleEl) titleEl.textContent = classification.display_name || profile.name;
  if (descEl) descEl.textContent = profile.description;
  if (emojiEl) emojiEl.textContent = classification.icon || profile.icon;
  if (actionEl) actionEl.textContent = classification.suggested_action || profile.actionCue;
  
  const confPct = Math.round(state.confidence * 100);
  if (confValEl) confValEl.textContent = `${confPct}%`;
  if (confBarEl) confBarEl.style.width = `${confPct}%`;

  if (lastTimeEl) {
    const d = new Date();
    lastTimeEl.textContent = `Updated ${d.toLocaleTimeString()}`;
  }

  // Badge Styling
  if (badgeEl) {
    badgeEl.className = `badge-accent ${profile.badgeClass}`;
    badgeEl.innerHTML = `<i class="fa-solid fa-shield-halved"></i> ${profile.severity}`;
  }

  // Hero Card Glow border
  if (heroCard) {
    heroCard.className = `hero-card glass-panel alert-${profile.strobeColor}`;
  }

  // Trigger Visual Strobe Alert according to Sensory Matrix Preferences
  evaluateAndTriggerSensoryAlert(soundClass, profile);
}

function evaluateAndTriggerSensoryAlert(soundClass, profile) {
  if (soundClass === "NORMAL_AMBIENT") return;

  let shouldStrobe = false;
  let shouldVibrate = false;

  // Tier 1: Emergency (Fire / Smoke Siren) -> Always Locked ON for life safety
  if (profile.tier === 1) {
    shouldStrobe = true;
    shouldVibrate = true;
  }
  // Tier 2: Safety & Distress (Glass Break, Baby Cry)
  else if (profile.tier === 2) {
    shouldStrobe = state.sensoryPrefs.tier2_strobe;
    shouldVibrate = state.sensoryPrefs.tier2_vibe;
  }
  // Tier 3: Visitors & Doorway (Doorbell, Knock, Bark)
  else if (profile.tier === 3) {
    shouldStrobe = state.sensoryPrefs.tier3_strobe;
    shouldVibrate = state.sensoryPrefs.tier3_vibe;
  }
  // Tier 4: Human Speech (High Voice)
  else if (profile.tier === 4) {
    shouldStrobe = state.sensoryPrefs.tier4_strobe;
    shouldVibrate = state.sensoryPrefs.tier4_vibe;
  }

  // 1. Fullscreen Visual Strobe (Color Coded for Deaf Vision)
  if (shouldStrobe) {
    triggerVisualStrobe(profile);
  }

  // 2. Haptic Vibration API
  if (shouldVibrate && "vibrate" in navigator) {
    try {
      navigator.vibrate([250, 100, 250, 100, 400]);
    } catch (e) {}
  }
}

function triggerVisualStrobe(profile) {
  const strobeOverlay = document.getElementById("visualStrobeAlert");
  const strobeTitle = document.getElementById("strobeTitle");
  const strobeSub = document.getElementById("strobeSubtitle");
  const strobeBadge = document.getElementById("strobeBadge");
  const strobeIcon = document.getElementById("strobeIcon");

  if (!strobeOverlay) return;

  if (strobeTitle) strobeTitle.textContent = profile.name.toUpperCase();
  if (strobeSub) strobeSub.textContent = profile.actionCue;
  if (strobeBadge) strobeBadge.textContent = `${profile.severity} ALERT`;

  // Set strobe color class
  strobeOverlay.className = `visual-strobe-overlay active color-${profile.strobeColor}`;
}

function dismissStrobe() {
  const strobeOverlay = document.getElementById("visualStrobeAlert");
  if (strobeOverlay) {
    strobeOverlay.className = "visual-strobe-overlay hidden";
  }
}


// -----------------------------------------------------------------------------
// 5. EMERGENCY SOS, DEAF VOICE CALLING & PHYSICAL ROOM BUZZER CONTROLLER
// -----------------------------------------------------------------------------
function openEmergencyCategoryModal() {
  const modal = document.getElementById("emergencyCategoryModal");
  if (modal) modal.classList.remove("hidden");
  const addrEl = document.getElementById("displayResidentAddress");
  if (addrEl) addrEl.textContent = state.residentAddress;
  const inputEl = document.getElementById("residentAddressInput");
  if (inputEl) inputEl.value = state.residentAddress;

  // Show active neighbour name & phone dynamically on the category card
  const config = getEmergencyConfig('neighbour');
  const neighbourBadge = document.getElementById("neighbourContactDisplayBadge");
  if (neighbourBadge && config && config.neighbourContact) {
    neighbourBadge.innerHTML = `<i class="fa-solid fa-phone"></i> ${escapeHtml(config.neighbourContact.name)}: ${escapeHtml(config.neighbourContact.phone)} + <i class="fa-brands fa-whatsapp"></i>`;
  }
}

function closeEmergencyCategoryModal() {
  const modal = document.getElementById("emergencyCategoryModal");
  if (modal) modal.classList.add("hidden");
  const editBox = document.getElementById("addressEditBox");
  if (editBox) editBox.classList.add("hidden");
}

function toggleEditAddress() {
  const box = document.getElementById("addressEditBox");
  if (box) box.classList.toggle("hidden");
}

function saveResidentAddress() {
  const inputEl = document.getElementById("residentAddressInput");
  if (inputEl && inputEl.value.trim()) {
    state.residentAddress = inputEl.value.trim();
    localStorage.setItem("aura_resident_address", state.residentAddress);
    const addrEl = document.getElementById("displayResidentAddress");
    if (addrEl) addrEl.textContent = state.residentAddress;
  }
  const editBox = document.getElementById("addressEditBox");
  if (editBox) editBox.classList.add("hidden");
}

function getEmergencyConfig(categoryKey) {
  const addr = state.residentAddress;
  
  // Pick the primary contact: prioritize user-added contacts (newest added contact)
  let targetContact = null;
  if (state.contacts && state.contacts.length > 0) {
    // Look for user-added contacts (id > 1000) from newest to oldest
    const userAdded = state.contacts.slice().reverse().find(c => c.id > 1000);
    if (userAdded) {
      targetContact = userAdded;
    } else {
      // Otherwise find by keyword
      targetContact = state.contacts.find(c => {
        const r = (c.role || "").toLowerCase();
        const n = (c.name || "").toLowerCase();
        return r.includes("neighbor") || r.includes("neighbour") || r.includes("roommate") || n.includes("neighbor") || n.includes("neighbour");
      }) || state.contacts[state.contacts.length - 1];
    }
  }
  if (!targetContact) {
    targetContact = { name: "Trusted Contact", phone: "+919876543210" };
  }

  switch (categoryKey) {
    case 'police':
      return {
        label: "Police Emergency (112)",
        phone: "112",
        spokenText: `Emergency! Emergency! This is an urgent automated voice call from a deaf resident who cannot speak on a phone call. Police assistance is urgently required at ${addr}. The resident is in danger and cannot speak. Please dispatch officers to ${addr} immediately!`
      };
    case 'women':
      return {
        label: "Women Helpline (1091)",
        phone: "1091",
        spokenText: `Emergency distress call! This is an automated voice call from a deaf woman who cannot speak on a phone call. Urgent safety assistance is required at ${addr}. Please send help to ${addr} immediately!`
      };
    case 'fire':
      return {
        label: "Fire Brigade (101)",
        phone: "101",
        spokenText: `Fire emergency! Fire emergency! This is an automated call from a deaf resident who cannot speak on a phone call. Fire assistance is needed at ${addr} immediately. Please dispatch a fire engine to ${addr}!`
      };
    case 'ambulance':
      return {
        label: "Ambulance / Medical Emergency (108)",
        phone: "108",
        spokenText: `Medical emergency! This is an automated voice call from a deaf resident who cannot speak. Medical help and an ambulance are urgently required at ${addr}. Please dispatch an ambulance to ${addr} immediately!`
      };
    case 'neighbour':
    default:
      return {
        label: `${targetContact.name} (${targetContact.phone})`,
        phone: targetContact.phone,
        isNeighbour: true,
        neighbourContact: targetContact,
        spokenText: `Emergency alert! This call is from your deaf neighbor at ${addr}. I cannot speak on a voice call and require your immediate assistance. Please come over to my room at ${addr} immediately!`
      };
  }
}

function triggerCategoryCall(categoryKey) {
  const config = getEmergencyConfig(categoryKey);
  closeEmergencyCategoryModal();

  // 1. Ring Room Buzzer on ESP32
  triggerEmergencyBuzzerHardware();

  // 2. Clear distinction:
  // - Helplines (Police 112, Women 1091, Fire 101, Ambulance 108): Direct phone call
  // - Neighbour / Contacts (sonam): Direct WhatsApp message
  if (categoryKey === 'neighbour') {
    sendBroadcastEmergencyMessages(config);
  } else {
    // Official Emergency Helpline -> Call directly (Police, Fire, Ambulance, Women Helpline)
    startDirectPhoneCall(config.phone, config.label);
  }
}

function startDirectPhoneCall(phone, label) {
  const cleanPhone = phone.replace(/[^0-9+]/g, '');
  if (!cleanPhone) return;

  console.log(`[DIRECT-CALL] Calling emergency helpline ${label || cleanPhone}:`, cleanPhone);

  // 1. Launch native dialer for helpline (112, 108, 101, 1091)
  const dialAnchor = document.createElement("a");
  dialAnchor.href = `tel:${cleanPhone}`;
  dialAnchor.target = "_self";
  dialAnchor.rel = "noopener noreferrer";
  document.body.appendChild(dialAnchor);
  dialAnchor.click();
  setTimeout(() => {
    try { dialAnchor.remove(); } catch(e) {}
  }, 1000);

  // 2. Fallback window.location assign
  setTimeout(() => {
    try {
      window.location.assign(`tel:${cleanPhone}`);
    } catch(err) {
      console.warn("[DIRECT-CALL] Location assign error:", err);
    }
  }, 200);

  // 3. Show helpline call toast banner at top of dashboard
  showHelplineCallToast(cleanPhone, label || cleanPhone);

  // 4. Record in historical event log
  recordSoundEvent({
    sound_class: "HELPLINE_CALL",
    display_name: `Calling ${label || cleanPhone}`,
    severity: "CRITICAL",
    icon: "📞",
    decibels: Math.round(state.currentDb || 85),
    action: `Direct phone call initiated to emergency helpline ${cleanPhone}. Room buzzer sounding on GPIO 18.`
  });
}

function showHelplineCallToast(phone, label) {
  const toast = document.getElementById("emergencyDispatchToast");
  const actions = document.getElementById("toastContactButtons");
  const summary = document.getElementById("dispatchToastSummary");
  const titleEl = toast ? toast.querySelector(".toast-info strong") : null;
  if (!toast) return;

  if (titleEl) {
    titleEl.innerHTML = `📞 CALLING EMERGENCY HELPLINE: ${escapeHtml(label)}`;
  }

  if (summary) {
    summary.textContent = `Direct call launched to official emergency helpline ${phone}. Room buzzer active on ESP32.`;
  }

  if (actions) {
    actions.innerHTML = `
      <a href="tel:${phone}" class="btn-toast-contact" style="background:#06b6d4;">
        <i class="fa-solid fa-phone"></i> Redial ${escapeHtml(phone)}
      </a>
    `;
  }

  toast.classList.remove("hidden");
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function sendBroadcastEmergencyMessages(config) {
  if (!state.contacts || state.contacts.length === 0) return;

  const addr = state.residentAddress;
  let msgText = "";

  if (config.phone === "112") {
    msgText = `🚨 *URGENT POLICE EMERGENCY*: Hello, I am your deaf neighbor from ${addr}. I am in danger and require urgent police assistance! Please call the police (112) or come check on me at ${addr} immediately!`;
  } else if (config.phone === "1091") {
    msgText = `🚨 *URGENT WOMEN SAFETY EMERGENCY*: Hello, I am your deaf neighbor from ${addr}. Urgent women safety distress! Please call 1091 or come check on me at ${addr} immediately!`;
  } else if (config.phone === "101") {
    msgText = `🚨 *FIRE EMERGENCY ALERT*: Hello, I am your deaf neighbor from ${addr}. Smoke/fire emergency detected! Please call the fire brigade (101) and come to ${addr} immediately!`;
  } else if (config.phone === "108") {
    msgText = `🚨 *URGENT MEDICAL EMERGENCY*: Hello, I am your deaf neighbor from ${addr}. Severe medical emergency! Please call an ambulance (108) and come to ${addr} immediately!`;
  } else {
    msgText = `🚨 *URGENT EMERGENCY*: Hello, I am your deaf neighbor from ${addr}. I cannot speak on phone calls and need your immediate help right now! Please come over to my room at ${addr} immediately!`;
  }

  // 1. Show the prominent on-screen emergency dispatch toast HUD with all contacts
  showEmergencyDispatchToast(
    state.currentDb || 85,
    config.label,
    msgText,
    `🚨 EMERGENCY SOS ACTIVATED: DIRECT WHATSAPP ALERTS DISPATCHED`
  );

  // 2. Open WhatsApp directly for the primary / user-added contact (e.g. sonam)
  const contactsList = state.contacts.slice().reverse();
  const primaryContact = config.neighbourContact || contactsList.find(c => c.id > 1000) || contactsList[0];
  if (primaryContact) {
    const cleanPrimary = primaryContact.phone.replace(/[^0-9]/g, '');
    if (cleanPrimary) {
      const waUrl = `https://api.whatsapp.com/send/?phone=${cleanPrimary}&text=${encodeURIComponent(msgText)}`;
      window.open(waUrl, "_blank");
    }
  }

  // 3. Automatically dispatch to ALL remaining contacts in the list
  const otherContacts = contactsList.filter(c => c !== primaryContact);
  otherContacts.forEach((contact, idx) => {
    const cleanPhone = contact.phone.replace(/[^0-9]/g, '');
    if (!cleanPhone) return;
    const waUrl = `https://api.whatsapp.com/send/?phone=${cleanPhone}&text=${encodeURIComponent(msgText)}`;
    
    setTimeout(() => {
      try {
        const win = window.open(waUrl, "_blank");
        if (!win || win.closed || typeof win.closed === 'undefined') {
          console.warn("[AUTO-DISPATCH] Pop-up blocked for:", contact.name, contact.phone);
        }
      } catch (e) {
        console.warn("[AUTO-DISPATCH] Window open error:", e);
      }
    }, 400 + (idx * 600));
  });

  // 4. Smoothly scroll to the top of the dashboard so the red dispatch banner is instantly visible
  window.scrollTo({ top: 0, behavior: 'smooth' });

  // 5. Record in historical event log & localStorage
  recordSoundEvent({
    sound_class: "SOS_BROADCAST_DISPATCH",
    display_name: `Emergency Dispatched to All ${state.contacts.length} Contacts`,
    severity: "CRITICAL",
    icon: "📲",
    decibels: Math.round(state.currentDb || 85),
    action: `Emergency alert broadcast directly to all ${state.contacts.length} contacts (${state.contacts.map(c => c.name).join(", ")}). Direct WhatsApp links ready.`
  });
}

function openActiveCallHud(config) {
  const modal = document.getElementById("activeCallHudModal");
  const labelEl = document.getElementById("activeCallRecipientLabel");
  const textEl = document.getElementById("activeCallSpokenTranscript");
  const subEl = document.getElementById("activeCallSub");

  if (labelEl) labelEl.textContent = `Calling ${config.label}`;
  if (textEl) textEl.textContent = `"${config.spokenText}"`;
  if (subEl) subEl.textContent = "Call placed • Resident side is silent (Sound plays for responder)";
  if (modal) modal.classList.remove("hidden");

  state.activeEmergencyCall = {
    inProgress: true,
    category: config.label,
    phone: config.phone,
    messageText: config.spokenText,
    isSpeakingLocally: false,
    repeatTimer: null
  };

  // Ensure user's device does NOT speak automatically
  if ("speechSynthesis" in window) {
    window.speechSynthesis.cancel();
  }
}

function transmitVoiceNoteToSpeakerphone() {
  if (!state.activeEmergencyCall || !state.activeEmergencyCall.messageText) return;
  
  const btn = document.getElementById("btnTransmitVoice");
  if (state.activeEmergencyCall.isSpeakingLocally) {
    // If currently speaking, stop it
    if ("speechSynthesis" in window) window.speechSynthesis.cancel();
    state.activeEmergencyCall.isSpeakingLocally = false;
    if (btn) btn.innerHTML = `<i class="fa-solid fa-volume-high"></i> Play Voice into Speakerphone`;
  } else {
    // Start transmitting voice into speakerphone for responder
    state.activeEmergencyCall.isSpeakingLocally = true;
    if (btn) btn.innerHTML = `<i class="fa-solid fa-volume-xmark"></i> Stop Voice Note Playback`;
    playSpokenVoiceNoteLoop(state.activeEmergencyCall.messageText);
  }
}

function playSpokenVoiceNoteLoop(message) {
  if (!("speechSynthesis" in window)) {
    console.warn("SpeechSynthesis not available in browser.");
    return;
  }

  window.speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(message);
  utterance.rate = 0.95;
  utterance.pitch = 1.0;
  utterance.volume = 1.0;

  utterance.onend = () => {
    if (state.activeEmergencyCall && state.activeEmergencyCall.inProgress && state.activeEmergencyCall.isSpeakingLocally) {
      state.activeEmergencyCall.repeatTimer = setTimeout(() => {
        if (state.activeEmergencyCall && state.activeEmergencyCall.inProgress && state.activeEmergencyCall.isSpeakingLocally) {
          window.speechSynthesis.speak(utterance);
        }
      }, 5000);
    }
  };

  window.speechSynthesis.speak(utterance);
}

function replayEmergencyVoiceNote() {
  transmitVoiceNoteToSpeakerphone();
}

function endEmergencyCall() {
  if (state.activeEmergencyCall) {
    state.activeEmergencyCall.inProgress = false;
    state.activeEmergencyCall.isSpeakingLocally = false;
    if (state.activeEmergencyCall.repeatTimer) {
      clearTimeout(state.activeEmergencyCall.repeatTimer);
      state.activeEmergencyCall.repeatTimer = null;
    }
  }

  if ("speechSynthesis" in window) {
    window.speechSynthesis.cancel();
  }

  const modal = document.getElementById("activeCallHudModal");
  if (modal) modal.classList.add("hidden");

  silenceEmergencyBuzzer();
}

async function triggerEmergencyBuzzerHardware() {
  console.log("[SOS] Triggering room buzzer on ESP32...");
  const cleanUrl = state.firebaseUrl.replace(/\/$/, '') + `/sos_alert.json?auth=${state.authToken}`;

  try {
    const res = await fetch(cleanUrl, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(true)
    });

    if (res.ok) {
      processSosUpdate(true);
      
      // Auto-countdown 7 seconds
      let remaining = 7;
      const btnSub = document.getElementById("sosBtnSub");
      if (state.sosCountdownTimer) clearInterval(state.sosCountdownTimer);

      state.sosCountdownTimer = setInterval(() => {
        remaining--;
        if (btnSub) btnSub.textContent = `Auto-silencing in ${remaining}s...`;
        if (remaining <= 0) {
          clearInterval(state.sosCountdownTimer);
          silenceEmergencyBuzzer();
        }
      }, 1000);
    }
  } catch (err) {
    console.error("[SOS Trigger Error]", err);
  }
}

async function triggerEmergencySos() {
  // When user manually touches SOS button, open the Emergency Category Selection Modal!
  openEmergencyCategoryModal();
}

function processSosUpdate(sosState) {
  const isActive = (sosState === true || sosState === "true");
  state.sosActive = isActive;

  const btn = document.getElementById("triggerSosBtn");
  const badge = document.getElementById("buzzerStateBadge");
  const silenceBtn = document.getElementById("silenceSosBtn");
  const btnText = document.getElementById("sosBtnText");
  const btnSub = document.getElementById("sosBtnSub");

  if (isActive) {
    if (badge) {
      badge.textContent = "BUZZER SOUNDING (GPIO 18)";
      badge.className = "buzzer-state-badge sounding";
    }
    if (btn) btn.classList.add("sos-pulsing");
    if (btnText) btnText.textContent = "SOS ACTIVE IN ROOM";
    if (btnSub) btnSub.textContent = "Buzzer pulsing on ESP32";
    if (silenceBtn) silenceBtn.classList.remove("hidden");
  } else {
    if (badge) {
      badge.textContent = "BUZZER IDLE";
      badge.className = "buzzer-state-badge idle";
    }
    if (btn) btn.classList.remove("sos-pulsing");
    if (btnText) btnText.textContent = "TOUCH FOR EMERGENCY SOS";
    if (btnSub) btnSub.textContent = "Police, Women Help, Fire, Neighbour";
    if (silenceBtn) silenceBtn.classList.add("hidden");

    if (state.sosCountdownTimer) {
      clearInterval(state.sosCountdownTimer);
      state.sosCountdownTimer = null;
    }
  }
}

async function silenceEmergencyBuzzer() {
  console.log("[SOS] Silencing room buzzer...");
  const cleanUrl = state.firebaseUrl.replace(/\/$/, '') + `/sos_alert.json?auth=${state.authToken}`;

  try {
    await fetch(cleanUrl, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(false)
    });
    processSosUpdate(false);
  } catch (err) {
    console.error("[SOS Silence Error]", err);
  }
}


// -----------------------------------------------------------------------------
// 6. DOORSTEP VISITOR ASSISTANT (EchoSense STT & TTS Feature)
// -----------------------------------------------------------------------------
function initSpeechRecognition() {
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SpeechRecognition) {
    console.warn("[STT] Web Speech Recognition not supported in this browser.");
    return;
  }

  state.speechRecognition = new SpeechRecognition();
  state.speechRecognition.continuous = true;
  state.speechRecognition.interimResults = true;
  state.speechRecognition.lang = 'en-US';

  state.speechRecognition.onstart = () => {
    state.isListeningStt = true;
    updateSttUi(true);
  };

  state.speechRecognition.onresult = (event) => {
    let interimTranscript = '';
    let finalTranscript = '';

    for (let i = event.resultIndex; i < event.results.length; ++i) {
      if (event.results[i].isFinal) {
        finalTranscript += event.results[i][0].transcript;
      } else {
        interimTranscript += event.results[i][0].transcript;
      }
    }

    if (finalTranscript) {
      appendSttLine(finalTranscript);
    }
  };

  state.speechRecognition.onerror = (event) => {
    console.warn("[STT Error]", event.error);
    state.isListeningStt = false;
    updateSttUi(false);
  };

  state.speechRecognition.onend = () => {
    state.isListeningStt = false;
    updateSttUi(false);
  };
}

function toggleSttRecognition() {
  if (!state.speechRecognition) {
    initSpeechRecognition();
    if (!state.speechRecognition) {
      alert("Live Speech-to-Text requires Chrome, Edge, or Safari with microphone permissions.");
      return;
    }
  }

  if (state.isListeningStt) {
    state.speechRecognition.stop();
  } else {
    try {
      state.speechRecognition.start();
    } catch (e) {
      console.warn("STT already starting:", e);
    }
  }
}

function updateSttUi(listening) {
  const badge = document.getElementById("sttStatusBadge");
  const label = document.getElementById("sttBtnLabel");
  const btn = document.getElementById("startSttBtn");

  if (badge) {
    if (listening) {
      badge.className = "stt-badge listening";
      badge.innerHTML = `<i class="fa-solid fa-ear-listen"></i> Listening to Visitor...`;
    } else {
      badge.className = "stt-badge";
      badge.innerHTML = `<i class="fa-solid fa-microphone-slash"></i> Mic Off`;
    }
  }

  if (label) label.textContent = listening ? "Stop Listening" : "Start Listening to Visitor";
  if (btn) {
    if (listening) btn.classList.add("listening-active");
    else btn.classList.remove("listening-active");
  }
}

function appendSttLine(text) {
  const box = document.getElementById("sttTranscriptBox");
  if (!box) return;

  const placeholder = box.querySelector(".placeholder-caption");
  if (placeholder) placeholder.remove();

  const timeStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  const line = document.createElement("div");
  line.className = "transcript-line";
  line.innerHTML = `<strong>[${timeStr}] Visitor:</strong> ${escapeHtml(text)}`;
  box.appendChild(line);
  box.scrollTop = box.scrollHeight;
}

function clearSttTranscript() {
  const box = document.getElementById("sttTranscriptBox");
  if (box) {
    box.innerHTML = `<p class="placeholder-caption">Tap "Start Listening to Visitor" below. When the visitor speaks, live captions will appear here immediately.</p>`;
  }
}

// Text to Speech (TTS) Voice Synthesis
function speakQuickReply(text) {
  if (!("speechSynthesis" in window)) {
    alert("Speech Synthesis is not supported in this browser.");
    return;
  }
  window.speechSynthesis.cancel(); // Stop any previous speech
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.rate = 0.95; // Clear natural speed
  utterance.pitch = 1.0;
  window.speechSynthesis.speak(utterance);
}

function speakCustomText() {
  const input = document.getElementById("customTtsInput");
  if (!input || !input.value.trim()) return;
  speakQuickReply(input.value.trim());
  input.value = "";
}


// -----------------------------------------------------------------------------
// 7. SENSORY MATRIX & TIERED OVERLOAD PREFERENCES
// -----------------------------------------------------------------------------
function toggleSensoryModal() {
  const modal = document.getElementById("sensoryModal");
  if (modal) modal.classList.toggle("hidden");
}

function loadSensoryPreferences() {
  const p = state.sensoryPrefs;
  const setCheck = (id, val) => {
    const el = document.getElementById(id);
    if (el) el.checked = !!val;
  };

  setCheck("pref-tier2-strobe", p.tier2_strobe);
  setCheck("pref-tier2-vibe", p.tier2_vibe);
  setCheck("pref-tier2-led", p.tier2_led);

  setCheck("pref-tier3-strobe", p.tier3_strobe);
  setCheck("pref-tier3-vibe", p.tier3_vibe);
  setCheck("pref-tier3-led", p.tier3_led);

  setCheck("pref-tier4-strobe", p.tier4_strobe);
  setCheck("pref-tier4-vibe", p.tier4_vibe);
  setCheck("pref-tier4-led", p.tier4_led);
}

function saveSensoryPreferences() {
  const getCheck = (id) => {
    const el = document.getElementById(id);
    return el ? el.checked : false;
  };

  state.sensoryPrefs = {
    tier2_strobe: getCheck("pref-tier2-strobe"),
    tier2_vibe: getCheck("pref-tier2-vibe"),
    tier2_led: getCheck("pref-tier2-led"),
    tier3_strobe: getCheck("pref-tier3-strobe"),
    tier3_vibe: getCheck("pref-tier3-vibe"),
    tier3_led: getCheck("pref-tier3-led"),
    tier4_strobe: getCheck("pref-tier4-strobe"),
    tier4_vibe: getCheck("pref-tier4-vibe"),
    tier4_led: getCheck("pref-tier4-led")
  };

  localStorage.setItem("aura_sensory_prefs", JSON.stringify(state.sensoryPrefs));
  console.log("[SENSORY] Preferences Saved:", state.sensoryPrefs);
}


// -----------------------------------------------------------------------------
// 8. EMERGENCY CONTACTS & WHATSAPP BROADCAST (EchoSense Feature)
// -----------------------------------------------------------------------------
function renderEmergencyContacts() {
  const grid = document.getElementById("contactsGrid");
  if (!grid) return;

  grid.innerHTML = "";
  if (state.contacts.length === 0) {
    grid.innerHTML = `<p class="placeholder-caption">No emergency contacts saved yet. Click "Add Contact" above.</p>`;
    return;
  }

  state.contacts.forEach((contact) => {
    const card = document.createElement("div");
    card.className = "contact-card";
    const initial = contact.name.charAt(0).toUpperCase();

    // WhatsApp clean phone link
    const cleanPhone = contact.phone.replace(/[^0-9]/g, '');
    const defaultMsg = encodeURIComponent("🚨 EMERGENCY: AuraSound Assistive Room System triggered! I am deaf/hard of hearing and need immediate assistance. Please check on me.");
    const waLink = `https://wa.me/${cleanPhone}?text=${defaultMsg}`;

    card.innerHTML = `
      <div class="contact-avatar">${initial}</div>
      <div class="contact-info">
        <strong>${escapeHtml(contact.name)}</strong>
        <span>${escapeHtml(contact.role)}</span>
        <small>${escapeHtml(contact.phone)}</small>
      </div>
      <div class="contact-actions-wrap">
        <a href="tel:${cleanPhone}" class="btn-contact-action call-btn" title="Call ${escapeHtml(contact.name)}">
          <i class="fa-solid fa-phone"></i>
        </a>
        <a href="${waLink}" target="_blank" class="btn-contact-action" title="Send WhatsApp Message">
          <i class="fa-brands fa-whatsapp"></i>
        </a>
      </div>
      <button class="btn-icon-subtle" onclick="deleteContact(${contact.id})" title="Delete Contact">
        <i class="fa-solid fa-xmark"></i>
      </button>
    `;
    grid.appendChild(card);
  });
}

function toggleAddContactForm() {
  const box = document.getElementById("addContactBox");
  if (box) box.classList.toggle("hidden");
}

function saveNewContact() {
  const name = document.getElementById("newContactName").value.trim();
  const role = document.getElementById("newContactRole").value.trim() || "Emergency Contact";
  const phone = document.getElementById("newContactPhone").value.trim();

  if (!name || !phone) {
    alert("Please enter both contact name and phone number.");
    return;
  }

  const newContact = {
    id: Date.now(),
    name,
    role,
    phone
  };

  state.contacts.push(newContact);
  localStorage.setItem("aura_emergency_contacts", JSON.stringify(state.contacts));

  // Reset & re-render
  document.getElementById("newContactName").value = "";
  document.getElementById("newContactRole").value = "";
  document.getElementById("newContactPhone").value = "";
  toggleAddContactForm();
  renderEmergencyContacts();
}

function deleteContact(id) {
  state.contacts = state.contacts.filter(c => c.id !== id);
  localStorage.setItem("aura_emergency_contacts", JSON.stringify(state.contacts));
  renderEmergencyContacts();
}

function broadcastWhatsAppAlert() {
  if (state.contacts.length === 0) {
    alert("No emergency contacts saved. Please add at least one contact first.");
    return;
  }
  const firstContact = state.contacts[0];
  const cleanPhone = firstContact.phone.replace(/[^0-9]/g, '');
  const template = document.getElementById("sosMessageTemplate").textContent;
  const url = `https://wa.me/${cleanPhone}?text=${encodeURIComponent(template)}`;
  window.open(url, "_blank");
}


// -----------------------------------------------------------------------------
// 9. HISTORICAL SOUND EVENT FEED & LOCALSTORAGE PERSISTENCE
// -----------------------------------------------------------------------------
function recordSoundEvent(eventData) {
  if (!eventData) return null;

  const newEv = {
    id: "evt_" + Date.now() + "_" + Math.floor(Math.random() * 1000),
    timestamp: new Date().toISOString(),
    timestamp_epoch: Date.now(),
    sound_class: eventData.sound_class || "ACOUSTIC_ACTIVITY",
    display_name: eventData.display_name || eventData.sound_class,
    icon: eventData.icon || "🔊",
    severity: eventData.severity || "INFO",
    decibels: Math.round(eventData.decibels || state.currentDb),
    suggested_action: eventData.suggested_action || eventData.action || "Room acoustic activity recorded."
  };

  // Prepend to memory
  state.events.unshift(newEv);
  if (state.events.length > 100) state.events.pop();

  // 100% Guaranteed Persistent Storage in localStorage
  try {
    localStorage.setItem("aura_event_logs", JSON.stringify(state.events));
  } catch (e) {
    console.warn("[STORAGE] LocalStorage save error:", e);
  }

  // Update UI feeds immediately
  renderMiniFeed();
  renderFullEventTable();

  // Asynchronously sync to Firebase /sound_events
  syncSingleEventToFirebase(newEv);

  return newEv;
}

async function syncSingleEventToFirebase(ev) {
  if (!state.firebaseUrl) return;
  const cleanUrl = state.firebaseUrl.replace(/\/$/, '') + `/sound_events.json?auth=${state.authToken}`;
  try {
    await fetch(cleanUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(ev)
    });
  } catch (e) {}
}

function processHistoricalEvents(eventsObj) {
  if (!eventsObj) return;

  const remoteList = [];
  Object.keys(eventsObj).forEach((key) => {
    const ev = eventsObj[key];
    if (ev && typeof ev === "object") {
      remoteList.push({ id: key, ...ev });
    }
  });

  // Merge remote events with existing local events by ID
  const existingIds = new Set(state.events.map(e => e.id));
  remoteList.forEach(ev => {
    if (!existingIds.has(ev.id)) {
      state.events.push(ev);
      existingIds.add(ev.id);
    }
  });

  // Sort descending by timestamp
  state.events.sort((a, b) => {
    const tA = a.timestamp_epoch || (a.timestamp ? new Date(a.timestamp).getTime() : 0);
    const tB = b.timestamp_epoch || (b.timestamp ? new Date(b.timestamp).getTime() : 0);
    return tB - tA;
  });

  if (state.events.length > 100) state.events = state.events.slice(0, 100);

  // Persist merged logs
  try {
    localStorage.setItem("aura_event_logs", JSON.stringify(state.events));
  } catch (e) {}

  renderMiniFeed();
  renderFullEventTable();
}

function renderMiniFeed() {
  const feed = document.getElementById("miniEventFeed");
  if (!feed) return;

  if (state.events.length === 0) {
    feed.innerHTML = `<div class="empty-feed">Listening for room acoustic events...</div>`;
    return;
  }

  feed.innerHTML = "";
  const recent = state.events.slice(0, 4);

  recent.forEach((ev) => {
    const item = document.createElement("div");
    item.className = "mini-event-item";

    const timeStr = ev.timestamp ? new Date(ev.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : "Recently";
    item.innerHTML = `
      <span class="mini-event-icon">${ev.icon || '🔊'}</span>
      <div class="mini-event-details">
        <strong>${escapeHtml(ev.display_name || ev.sound_class)}</strong>
        <small>${timeStr} • ${ev.decibels || 45} dB</small>
      </div>
      <span class="chip-status ${getBadgeClass(ev.severity)}">${ev.severity || 'INFO'}</span>
    `;
    feed.appendChild(item);
  });
}

function renderFullEventTable() {
  const tbody = document.getElementById("fullEventsTbody");
  if (!tbody) return;

  let filtered = state.events;
  if (state.historyFilter !== "ALL") {
    filtered = state.events.filter(e => (e.severity || '').toUpperCase() === state.historyFilter);
  }

  if (filtered.length === 0) {
    tbody.innerHTML = `<tr><td colspan="5" class="empty-state">No matching sound events in history.</td></tr>`;
    return;
  }

  tbody.innerHTML = "";
  filtered.forEach((ev) => {
    const tr = document.createElement("tr");
    const timeStr = ev.timestamp ? new Date(ev.timestamp).toLocaleString() : "Recent";
    tr.innerHTML = `
      <td>${timeStr}</td>
      <td><strong>${ev.icon || '🔊'} ${escapeHtml(ev.display_name || ev.sound_class)}</strong></td>
      <td><span class="chip-status ${getBadgeClass(ev.severity)}">${ev.severity || 'INFO'}</span></td>
      <td>${ev.decibels ? ev.decibels + ' dB' : '--'}</td>
      <td>${escapeHtml(ev.suggested_action || ev.description || 'Room acoustic event detected.')}</td>
    `;
    tbody.appendChild(tr);
  });
}

function filterHistory(category) {
  state.historyFilter = category;
  document.querySelectorAll(".filter-pill").forEach(pill => {
    if (pill.textContent.toUpperCase() === category || (category === "INFO" && pill.textContent === "Visitors")) {
      pill.classList.add("active");
    } else {
      pill.classList.remove("active");
    }
  });
  renderFullEventTable();
}

async function clearEventHistory() {
  if (!confirm("Are you sure you want to clear all historical sound events? This will wipe local storage and Firebase logs.")) return;
  
  // 1. Wipe local memory and localStorage
  state.events = [];
  try {
    localStorage.removeItem("aura_event_logs");
  } catch (e) {}

  renderMiniFeed();
  renderFullEventTable();

  // 2. Clear Firebase node
  if (state.firebaseUrl) {
    const cleanUrl = state.firebaseUrl.replace(/\/$/, '') + `/sound_events.json?auth=${state.authToken}`;
    try {
      await fetch(cleanUrl, { method: "DELETE" });
    } catch (err) {
      console.warn("[Clear History Error]", err);
    }
  }
}


// -----------------------------------------------------------------------------
// 10. FIREBASE SETTINGS & TABS CONTROLLER
// -----------------------------------------------------------------------------
function switchPortalTab(tabName) {
  // Update button active state
  document.querySelectorAll(".tab-btn").forEach(btn => btn.classList.remove("active"));
  const activeBtn = document.getElementById(`tab-btn-${tabName}`);
  if (activeBtn) activeBtn.classList.add("active");

  // Update tab content view
  document.querySelectorAll(".tab-view").forEach(view => view.classList.remove("active"));
  const activeView = document.getElementById(`tab-content-${tabName}`);
  if (activeView) activeView.classList.add("active");
}

function toggleConfigDrawer() {
  const drawer = document.getElementById("configDrawer");
  if (drawer) drawer.classList.toggle("hidden");
}

function saveFirebaseConfig() {
  const url = document.getElementById("firebaseUrlInput").value.trim();
  const token = document.getElementById("firebaseAuthInput").value.trim();

  if (!url) {
    alert("Please provide a valid Firebase URL.");
    return;
  }

  state.firebaseUrl = url;
  state.authToken = token;

  localStorage.setItem("aura_firebase_url", url);
  localStorage.setItem("aura_auth_token", token);

  const dbName = extractFirebaseProjectName(url);
  const dbNameEl = document.getElementById("connectedDbName");
  if (dbNameEl) dbNameEl.textContent = dbName;

  toggleConfigDrawer();
  initFirebaseSync();
  alert("Firebase Configuration Saved! Reconnecting...");
}

async function testFirebaseConnection() {
  const box = document.getElementById("configTestResult");
  const url = document.getElementById("firebaseUrlInput").value.trim();
  const token = document.getElementById("firebaseAuthInput").value.trim();

  if (!box) return;
  box.className = "test-result-box";
  box.textContent = "Testing connection to Firebase Realtime Database...";
  box.classList.remove("hidden");

  const start = Date.now();
  const cleanUrl = url.replace(/\/$/, '') + `/.json?auth=${token}`;

  try {
    const res = await fetch(cleanUrl);
    const latency = Date.now() - start;
    if (res.ok) {
      box.className = "test-result-box success";
      box.innerHTML = `✓ Connection Successful! Latency: ${latency}ms.<br>Firebase Realtime Database is accessible.`;
    } else {
      box.className = "test-result-box error";
      box.innerHTML = `✗ HTTP Error ${res.status}: Check database rules or auth token secret.`;
    }
  } catch (err) {
    box.className = "test-result-box error";
    box.innerHTML = `✗ Connection Failed: ${err.message}. Ensure URL is correct.`;
  }
}


// -----------------------------------------------------------------------------
// 11. HELPER UTILITIES
// -----------------------------------------------------------------------------
function extractFirebaseProjectName(url) {
  try {
    const match = url.match(/https:\/\/([^.]+)\.firebaseio\.com/);
    return match ? match[1] : "Custom RTDB";
  } catch (e) {
    return "Custom RTDB";
  }
}

function getBadgeClass(severity) {
  const s = (severity || '').toUpperCase();
  if (s === "EMERGENCY" || s === "CRITICAL") return "critical";
  if (s === "WARNING" || s === "HIGH") return "warning";
  return "normal";
}

function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}


// -----------------------------------------------------------------------------
// 12. INITIALIZATION ON DOM READY
// -----------------------------------------------------------------------------
document.addEventListener("DOMContentLoaded", () => {
  console.log("[AuraSound IoT] Initializing Assistive Portal...");

  // Load configuration into input fields
  const urlInput = document.getElementById("firebaseUrlInput");
  const authInput = document.getElementById("firebaseAuthInput");
  if (urlInput) urlInput.value = state.firebaseUrl;
  if (authInput) authInput.value = state.authToken;

  // Set initial project name display
  const dbNameEl = document.getElementById("connectedDbName");
  if (dbNameEl) dbNameEl.textContent = extractFirebaseProjectName(state.firebaseUrl);

  // Load preferences and contacts
  loadSensoryPreferences();
  renderEmergencyContacts();

  // Initialize Speech Recognition
  initSpeechRecognition();

  // Render persistent historical logs immediately from localStorage
  renderMiniFeed();
  renderFullEventTable();

  // Initialize Voice Alert button state
  const btnVoice = document.getElementById("btnVoiceAlertToggle");
  const textVoice = document.getElementById("voiceToggleText");
  const iconVoice = document.getElementById("voiceToggleIcon");
  if (btnVoice) {
    if (state.ttsVoiceAlerts) {
      btnVoice.classList.add("active");
      if (textVoice) textVoice.textContent = "Voice Alert: ON";
      if (iconVoice) iconVoice.className = "fa-solid fa-volume-high";
    } else {
      btnVoice.classList.remove("active");
      if (textVoice) textVoice.textContent = "Voice Alert: OFF";
      if (iconVoice) iconVoice.className = "fa-solid fa-volume-xmark";
    }
  }

  // Initialize Audio Input Source Selection
  setAudioSource(state.audioSource);

  // Initialize Critical Danger Audio Trigger Slider
  const slider = document.getElementById("criticalDbSlider");
  const chip = document.getElementById("thresholdDisplayChip");
  const text = document.getElementById("sliderValueText");
  if (slider) slider.value = state.criticalDbThreshold;
  if (chip) {
    let label = "Default";
    if (state.criticalDbThreshold <= 65) label = "Sensitive";
    else if (state.criticalDbThreshold <= 75) label = "Normal Speech";
    else if (state.criticalDbThreshold <= 84) label = "Loud Shout";
    else label = "Extreme Danger";
    chip.textContent = `${state.criticalDbThreshold} dB • ${label}`;
  }
  if (text) text.textContent = `${state.criticalDbThreshold} dB SPL`;

  // Start synthetic oscilloscope if initial mode is ESP32
  if (state.audioSource === "esp32") {
    startSyntheticOscilloscope();
  }

  // Start Realtime Firebase Sync
  initFirebaseSync();

  // Attach explicit click listener to manual SOS button
  const sosBtn = document.getElementById("triggerSosBtn");
  if (sosBtn) {
    sosBtn.addEventListener("click", (e) => {
      e.preventDefault();
      openEmergencyCategoryModal();
    });
  }
});
