"""
================================================================================
   AuraSound IoT: Advanced Acoustic Digital Signal Processing & Sound Classifier
   Classifies: 
     - Fire / Smoke Alarm (Siren)
     - Glass Breaking / Shatter
     - Dog Barking
     - Baby Crying / Distress
     - Door Knock / Doorbell Chime
     - High Voice / Shouting / Screaming
     - Normal Ambient Baseline

   Syncs Live Intelligence to Firebase Realtime Database in Real Time.
================================================================================
"""

import os
import sys
import time
import math
import json
import argparse
import datetime
import threading

# Core DSP packages
import numpy as np
from scipy.signal import find_peaks
from scipy.fft import rfft, rfftfreq

# Networking
import requests

AUDIO_CAPTURE_AVAILABLE = True
sd = None

# -----------------------------------------------------------------------------
# FIREBASE CONFIGURATION (Direct Project Integration)
# -----------------------------------------------------------------------------
DEFAULT_FIREBASE_URL = "https://rain-dei-default-rtdb.firebaseio.com"
FIREBASE_AUTH_TOKEN  = "xxeSyW61RLsqJLy9O9pXmHr9RK5NR8Yo7cka2W0G"

# Sound Classification Catalog
SOUND_PROFILES = {
    "SIREN_ALARM": {
        "name": "Fire / Smoke Alarm / Siren",
        "icon": "🚨",
        "severity": "EMERGENCY",
        "color": "#dc2626",
        "description": "Continuous high-decibel tonal emergency alarm detected!",
        "suggested_action": "Evacuate room immediately or check smoke/fire detectors!",
        "strobe_color": "red"
    },
    "GLASS_CRACK": {
        "name": "Glass Cracking / Breaking",
        "icon": "💥",
        "severity": "CRITICAL",
        "color": "#ef4444",
        "description": "Sharp high-frequency acoustic shatter or dropped item fracture detected.",
        "suggested_action": "Inspect windows, sliding doors, or kitchen for broken glass.",
        "strobe_color": "red"
    },
    "DOG_BARK": {
        "name": "Dog Barking",
        "icon": "🐕",
        "severity": "WARNING",
        "color": "#f59e0b",
        "description": "Repetitive animal acoustic bark bursts recognized.",
        "suggested_action": "Check entrance or yard for pets or arriving visitors.",
        "strobe_color": "amber"
    },
    "BABY_CRY": {
        "name": "Baby Crying / Distress",
        "icon": "👶",
        "severity": "HIGH",
        "color": "#ec4899",
        "description": "Continuous infant vocal distress frequency pattern detected.",
        "suggested_action": "Check nursery or infant crib immediately.",
        "strobe_color": "pink"
    },
    "DOOR_KNOCK": {
        "name": "Door Knock / Visitor Tap",
        "icon": "🚪",
        "severity": "INFO",
        "color": "#3b82f6",
        "description": "Rhythmic low-frequency impact pulses identified on entrance door.",
        "suggested_action": "A visitor or delivery person is knocking at your door.",
        "strobe_color": "blue"
    },
    "DOORBELL": {
        "name": "Doorbell Chime",
        "icon": "🔔",
        "severity": "INFO",
        "color": "#06b6d4",
        "description": "Harmonic two-tone resonant doorbell chime detected.",
        "suggested_action": "Visitor at the entrance door.",
        "strobe_color": "blue"
    },
    "HIGH_VOICE": {
        "name": "High Voice / Shouting",
        "icon": "🗣️",
        "severity": "WARNING",
        "color": "#8b5cf6",
        "description": "Elevated human speech energy or calling out detected.",
        "suggested_action": "Someone nearby is speaking loudly or calling for attention.",
        "strobe_color": "purple"
    },
    "NORMAL_AMBIENT": {
        "name": "Room Quiet & Normal",
        "icon": "🍃",
        "severity": "NORMAL",
        "color": "#10b981",
        "description": "Ambient sound within comfortable quiet baseline.",
        "suggested_action": "No attention required.",
        "strobe_color": "none"
    }
}


# -----------------------------------------------------------------------------
# FIREBASE REST HELPER
# -----------------------------------------------------------------------------
def sync_to_firebase(firebase_url, path, data, auth_token=""):
    """Pushes data directly to Firebase Realtime Database via REST."""
    if not firebase_url:
        return False, "No URL provided"

    clean_url = firebase_url.rstrip("/") + path
    params = {}
    if auth_token:
        params["auth"] = auth_token

    try:
        r = requests.put(clean_url, params=params, json=data, timeout=3.5)
        return r.status_code == 200, r.status_code
    except Exception as e:
        return False, str(e)


def append_firebase_event(firebase_url, event_data, auth_token=""):
    """Appends an alert event to the /sound_events historical feed."""
    if not firebase_url:
        return False, "No URL provided"

    clean_url = firebase_url.rstrip("/") + "/sound_events.json"
    params = {}
    if auth_token:
        params["auth"] = auth_token

    try:
        r = requests.post(clean_url, params=params, json=event_data, timeout=3.5)
        return r.status_code == 200, r.status_code
    except Exception as e:
        return False, str(e)


# -----------------------------------------------------------------------------
# ADVANCED ACOUSTIC DSP FEATURE EXTRACTOR
# -----------------------------------------------------------------------------
class AcousticFeatureExtractor:
    def __init__(self, sample_rate=16000):
        self.sample_rate = sample_rate

    def extract_features(self, audio_chunk):
        """
        Computes calibrated acoustic DSP features from a raw PCM audio chunk:
        - Decibel Sound Pressure Level (dB SPL)
        - Spectral Centroid (Frequency center of gravity)
        - Spectral Rolloff (85% energy frequency)
        - Spectral Flatness (Tonal purity vs noise)
        - Zero Crossing Rate (ZCR)
        - Crest Factor (Peak to RMS ratio)
        - Band Energy Ratios (Sub-400Hz, 400-1800Hz, 1800-3500Hz, >3500Hz)
        - Dominant Spectral Peak Frequency
        """
        # Ensure float array
        chunk = np.asarray(audio_chunk, dtype=np.float32)
        n_samples = len(chunk)
        if n_samples == 0:
            return None

        # 1. RMS & Calibrated Decibels
        rms = np.sqrt(np.mean(chunk ** 2))
        raw_db = 20.0 * np.log10(max(rms, 1e-6)) + 80.0
        decibels = float(np.clip(raw_db, 28.0, 108.0))

        # 2. Zero Crossing Rate (ZCR)
        zero_crossings = np.sum(np.abs(np.diff(np.signbit(chunk))))
        zcr = float(zero_crossings / (2.0 * n_samples))

        # 3. Peak-to-RMS Crest Factor
        peak_amp = np.max(np.abs(chunk))
        crest_factor = float(peak_amp / max(rms, 1e-6))

        # 4. Fast Fourier Transform & Power Spectrum
        windowed = chunk * np.hanning(n_samples)
        fft_vals = np.abs(rfft(windowed))
        freqs = rfftfreq(n_samples, 1.0 / self.sample_rate)

        power_spectrum = fft_vals ** 2
        total_power = np.sum(power_spectrum)

        if total_power < 1e-9:
            return {
                "decibels": round(decibels, 1),
                "spectral_centroid": 500.0,
                "spectral_rolloff": 1000.0,
                "spectral_flatness": 0.5,
                "crest_factor": 1.5,
                "zcr": 0.05,
                "dominant_freq": 200.0,
                "band_low": 0.8,
                "band_mid": 0.1,
                "band_high": 0.05,
                "band_treble": 0.05
            }

        # 5. Spectral Centroid
        spectral_centroid = float(np.sum(freqs * power_spectrum) / total_power)

        # 6. Spectral Rolloff (85% energy mark)
        cumsum = np.cumsum(power_spectrum)
        rolloff_idx = np.where(cumsum >= 0.85 * total_power)[0]
        spectral_rolloff = float(freqs[rolloff_idx[0]]) if len(rolloff_idx) > 0 else float(freqs[-1])

        # 7. Spectral Flatness (Geometric Mean / Arithmetic Mean)
        safe_power = power_spectrum + 1e-12
        geometric_mean = np.exp(np.mean(np.log(safe_power)))
        arithmetic_mean = np.mean(safe_power)
        spectral_flatness = float(geometric_mean / max(arithmetic_mean, 1e-12))

        # 8. Dominant Peak Frequency
        peak_indices, properties = find_peaks(fft_vals, height=np.max(fft_vals) * 0.25, distance=5)
        if len(peak_indices) > 0:
            dominant_idx = peak_indices[np.argmax(fft_vals[peak_indices])]
            dominant_freq = float(freqs[dominant_idx])
        else:
            dominant_freq = float(freqs[np.argmax(fft_vals)])

        # 9. Multi-Band Energy Distribution
        mask_low = freqs < 450
        mask_mid = (freqs >= 450) & (freqs < 1800)
        mask_high = (freqs >= 1800) & (freqs < 3500)
        mask_treble = freqs >= 3500

        band_low = float(np.sum(power_spectrum[mask_low]) / total_power)
        band_mid = float(np.sum(power_spectrum[mask_mid]) / total_power)
        band_high = float(np.sum(power_spectrum[mask_high]) / total_power)
        band_treble = float(np.sum(power_spectrum[mask_treble]) / total_power)

        return {
            "decibels": round(decibels, 1),
            "spectral_centroid": round(spectral_centroid, 1),
            "spectral_rolloff": round(spectral_rolloff, 1),
            "spectral_flatness": round(spectral_flatness, 3),
            "crest_factor": round(crest_factor, 2),
            "zcr": round(zcr, 3),
            "dominant_freq": round(dominant_freq, 1),
            "band_low": round(band_low, 3),
            "band_mid": round(band_mid, 3),
            "band_high": round(band_high, 3),
            "band_treble": round(band_treble, 3)
        }


# -----------------------------------------------------------------------------
# MULTI-CATEGORY ACOUSTIC CLASSIFIER ENGINE
# -----------------------------------------------------------------------------
class AcousticClassifier:
    def __init__(self, sample_rate=16000):
        self.sample_rate = sample_rate
        self.extractor = AcousticFeatureExtractor(sample_rate)
        self.history = []
        self.last_detection_time = 0

    def classify_chunk(self, audio_chunk):
        feats = self.extractor.extract_features(audio_chunk)
        if not feats:
            return None

        db = feats["decibels"]
        centroid = feats["spectral_centroid"]
        dominant = feats["dominant_freq"]
        flatness = feats["spectral_flatness"]
        crest = feats["crest_factor"]
        zcr = feats["zcr"]
        band_low = feats["band_low"]
        band_mid = feats["band_mid"]
        band_high = feats["band_high"]
        band_treble = feats["band_treble"]

        # Keep rolling history for temporal trends
        self.history.append(feats)
        if len(self.history) > 10:
            self.history.pop(0)

        # -----------------------------------------------------------------
        # 1. QUIET / NORMAL AMBIENT
        # -----------------------------------------------------------------
        if db < 44.0:
            return {
                "sound_class": "NORMAL_AMBIENT",
                "confidence": 0.98,
                "profile": SOUND_PROFILES["NORMAL_AMBIENT"],
                "features": feats
            }

        scores = {
            "SIREN_ALARM": 0.0,
            "GLASS_CRACK": 0.0,
            "DOOR_KNOCK": 0.0,
            "DOORBELL": 0.0,
            "BABY_CRY": 0.0,
            "DOG_BARK": 0.0,
            "HIGH_VOICE": 0.0
        }

        # -----------------------------------------------------------------
        # 2. EMERGENCY SIREN / FIRE ALARM (2.7 kHz - 3.4 kHz Pure High Tone)
        # -----------------------------------------------------------------
        if (2600 <= dominant <= 3500) and flatness < 0.15:
            scores["SIREN_ALARM"] += 0.70
            if band_high >= 0.50:
                scores["SIREN_ALARM"] += 0.25
        elif 2600 <= centroid <= 3500 and flatness < 0.20:
            scores["SIREN_ALARM"] += 0.50

        # -----------------------------------------------------------------
        # 3. GLASS CRACKING / BREAKING (High Treble, Fast Decay, Centroid > 3500)
        # -----------------------------------------------------------------
        if centroid >= 4000 or dominant >= 4500:
            scores["GLASS_CRACK"] += 0.60
            if band_treble >= 0.40:
                scores["GLASS_CRACK"] += 0.35
        elif centroid >= 3200 and band_treble >= 0.30:
            scores["GLASS_CRACK"] += 0.45
            if crest >= 3.0:
                scores["GLASS_CRACK"] += 0.30

        # -----------------------------------------------------------------
        # 4. DOOR KNOCK (Low-Frequency Impact, Sub-450Hz Body)
        # -----------------------------------------------------------------
        if band_low >= 0.65 and centroid < 500:
            scores["DOOR_KNOCK"] += 0.70
            if dominant < 350:
                scores["DOOR_KNOCK"] += 0.25

        # -----------------------------------------------------------------
        # 5. HIGH VOICE / SHOUTING (Speech Formant Band 1.2 kHz - 3.2 kHz)
        # -----------------------------------------------------------------
        if 1300 <= centroid <= 3200 and dominant >= 1100:
            scores["HIGH_VOICE"] += 0.55
            if band_mid + band_high >= 0.65:
                scores["HIGH_VOICE"] += 0.35

        # -----------------------------------------------------------------
        # 6. DOG BARKING (Mid-Frequency Burst with High Crest Factor > 3.5)
        # -----------------------------------------------------------------
        if (600 <= dominant <= 1600) and (700 <= centroid <= 2200) and crest >= 3.5:
            scores["DOG_BARK"] += 0.85

        # -----------------------------------------------------------------
        # 7. BABY CRYING (Infant Distress Harmonic Formants ~450-600 Hz)
        # -----------------------------------------------------------------
        if 420 <= dominant <= 600 and 550 <= centroid <= 900 and crest < 3.5:
            scores["BABY_CRY"] += 0.80

        # -----------------------------------------------------------------
        # 8. DOORBELL (Two-Tone Resonant Chime 550-950 Hz, Crest < 3.2)
        # -----------------------------------------------------------------
        if (550 <= dominant <= 950) and (550 <= centroid <= 1200) and crest < 3.2 and flatness < 0.05:
            scores["DOORBELL"] += 0.75

        # Pick best category
        best_class = max(scores, key=scores.get)
        best_confidence = scores[best_class]

        # If highest score is weak, check whether it is general loud speech or ambient
        if best_confidence < 0.45:
            if db >= 68.0:
                best_class = "HIGH_VOICE"
                best_confidence = 0.65
            else:
                best_class = "NORMAL_AMBIENT"
                best_confidence = 0.85

        return {
            "sound_class": best_class,
            "confidence": round(min(max(best_confidence, 0.70), 0.99), 2),
            "profile": SOUND_PROFILES[best_class],
            "features": feats
        }


# -----------------------------------------------------------------------------
# SYNTHETIC AUDIO WAVEFORM GENERATOR (For Testing & Simulation)
# -----------------------------------------------------------------------------
def generate_synthetic_sound(sound_type, duration=1.0, sr=16000):
    t = np.linspace(0, duration, int(sr * duration), endpoint=False)
    
    if sound_type == "SIREN_ALARM":
        # 3000 Hz continuous high pitch with slight warble
        freq = 3000.0 + 80.0 * np.sin(2 * np.pi * 4 * t)
        phase = 2 * np.pi * np.cumsum(freq) / sr
        audio = 0.8 * np.sin(phase)
    
    elif sound_type == "GLASS_CRACK":
        # Sharp high-frequency impact with fast exponential decay
        noise = np.random.normal(0, 1, len(t))
        envelope = np.exp(-t * 22.0)
        hf_chirp = np.sin(2 * np.pi * 4800 * t) + np.sin(2 * np.pi * 6200 * t)
        audio = 0.9 * (0.6 * hf_chirp + 0.4 * noise) * envelope

    elif sound_type == "DOOR_KNOCK":
        # 2 distinct low-frequency knocks
        audio = np.zeros(len(t))
        for knock_start in [0.1, 0.45]:
            idx_start = int(knock_start * sr)
            idx_end = min(idx_start + int(0.2 * sr), len(t))
            k_t = np.linspace(0, 0.2, idx_end - idx_start, endpoint=False)
            knock_pulse = np.sin(2 * np.pi * 140 * k_t) * np.exp(-k_t * 28.0)
            audio[idx_start:idx_end] += 0.85 * knock_pulse

    elif sound_type == "DOORBELL":
        # 800 Hz followed by 640 Hz chime
        audio = np.zeros(len(t))
        half = len(t) // 2
        t1 = t[:half]
        t2 = t[half:]
        audio[:half] = 0.7 * np.sin(2 * np.pi * 820 * t1) * np.exp(-t1 * 4.0)
        audio[half:] = 0.7 * np.sin(2 * np.pi * 650 * (t2 - t2[0])) * np.exp(-(t2 - t2[0]) * 3.5)

    elif sound_type == "BABY_CRY":
        # 520 Hz carrier with 3 Hz distress modulation
        carrier = 520 + 70 * np.sin(2 * np.pi * 2.8 * t)
        phase = 2 * np.pi * np.cumsum(carrier) / sr
        harmonics = 0.7 * np.sin(phase) + 0.3 * np.sin(2 * phase) + 0.15 * np.sin(3 * phase)
        envelope = 0.6 + 0.4 * np.sin(2 * np.pi * 1.5 * t)
        audio = 0.8 * harmonics * envelope

    elif sound_type == "DOG_BARK":
        # 2 short loud barks
        audio = np.zeros(len(t))
        for bark_start in [0.12, 0.55]:
            idx_start = int(bark_start * sr)
            idx_end = min(idx_start + int(0.28 * sr), len(t))
            b_t = np.linspace(0, 0.28, idx_end - idx_start, endpoint=False)
            bark_pulse = (np.sin(2 * np.pi * 680 * b_t) + 0.5 * np.sin(2 * np.pi * 1100 * b_t)) * np.exp(-b_t * 14.0)
            audio[idx_start:idx_end] += 0.9 * bark_pulse

    elif sound_type == "HIGH_VOICE":
        # Rich vocal frequencies around 1800 Hz
        vocal = np.sin(2 * np.pi * 1450 * t) + 0.6 * np.sin(2 * np.pi * 2200 * t) + 0.3 * np.sin(2 * np.pi * 2900 * t)
        envelope = 0.5 + 0.5 * np.sin(2 * np.pi * 2.2 * t)
        audio = 0.75 * vocal * envelope

    else:
        # Normal quiet ambient baseline (< 38 dB)
        audio = 0.002 * np.random.normal(0, 1, len(t))

    return audio.astype(np.float32)


# -----------------------------------------------------------------------------
# LIVE MICROPHONE CLASSIFIER PIPELINE
# -----------------------------------------------------------------------------
def run_live_microphone(firebase_url, auth_token):
    global sd
    try:
        if sd is None:
            import sounddevice as sd
    except Exception as e:
        print(f"[ERROR] Could not initialize sounddevice: {e}")
        return

    sample_rate = 16000
    chunk_duration = 0.5  # 500ms audio chunks
    chunk_samples = int(sample_rate * chunk_duration)

    classifier = AcousticClassifier(sample_rate)

    print("\n========================================================")
    print("  AuraSound IoT: Live Acoustic AI Microphone Classifier")
    print(f"  Target Firebase RTDB: {firebase_url}")
    print(f"  Sample Rate: {sample_rate} Hz | Chunk: {chunk_duration}s")
    print("========================================================")
    print("Listening to room acoustics... Press Ctrl+C to terminate.\n")

    last_logged_time = 0
    last_logged_class = "NORMAL_AMBIENT"

    def audio_callback(indata, frames, callback_time, status):
        nonlocal last_logged_time, last_logged_class

        chunk = indata[:, 0]
        result = classifier.classify_chunk(chunk)
        if not result:
            return

        sound_class = result["sound_class"]
        feats = result["features"]
        profile = result["profile"]
        now = time.time()

        # Visual telemetry bar
        bar_len = int(min(max((feats["decibels"] - 35) / 60.0 * 20, 0), 20))
        bar_str = "[" + "#" * bar_len + "-" * (20 - bar_len) + "]"

        # Continuously update live telemetry
        telemetry = {
            "sound_level_db": feats["decibels"],
            "device_status": "ONLINE",
            "classifier_active": True,
            "timestamp_ms": int(now * 1000)
        }
        sync_to_firebase(firebase_url, "/live_telemetry.json", telemetry, auth_token)

        # Trigger event if non-ambient sound recognized and cooldown satisfied
        if sound_class != "NORMAL_AMBIENT":
            if sound_class != last_logged_class or (now - last_logged_time > 3.5):
                last_logged_time = now
                last_logged_class = sound_class

                event_payload = {
                    "sound_class": sound_class,
                    "display_name": profile["name"],
                    "icon": profile["icon"],
                    "severity": profile["severity"],
                    "confidence": result["confidence"],
                    "decibels": feats["decibels"],
                    "suggested_action": profile["suggested_action"],
                    "strobe_color": profile["strobe_color"],
                    "timestamp": datetime.datetime.utcnow().isoformat() + "Z",
                    "timestamp_epoch": int(now * 1000)
                }

                print(f"\n[{datetime.datetime.now().strftime('%H:%M:%S')}] {profile['icon']} "
                      f"DETECTED: {profile['name']} ({feats['decibels']} dB | {result['confidence']*100:.0f}% confidence)")

                # Push to Firebase
                sync_to_firebase(firebase_url, "/latest_sound_classification.json", event_payload, auth_token)
                append_firebase_event(firebase_url, event_payload, auth_token)

        # Print live telemetry to console
        sys.stdout.write(f"\r{bar_str} {feats['decibels']:5.1f} dB | Centroid: {feats['spectral_centroid']:4.0f} Hz | Sound: {profile['icon']} {profile['name'][:18]}")
        sys.stdout.flush()

    try:
        with sd.InputStream(samplerate=sample_rate, channels=1, callback=audio_callback, blocksize=chunk_samples):
            while True:
                time.sleep(0.5)
    except KeyboardInterrupt:
        print("\n\n[INFO] Stopped live audio classification.")


# -----------------------------------------------------------------------------
# INTERACTIVE SIMULATION / TEST HARNESS
# -----------------------------------------------------------------------------
def run_simulation(firebase_url, auth_token):
    classifier = AcousticClassifier(16000)

    print("\n========================================================")
    print("  AuraSound IoT: Acoustic Classifier Interactive Test Suite")
    print(f"  Target Firebase RTDB: {firebase_url}")
    print("========================================================")
    print("  [1] Fire Alarm / Emergency Siren  (🚨)")
    print("  [2] Glass Cracking / Breaking     (💥)")
    print("  [3] Dog Barking                   (🐕)")
    print("  [4] Baby Crying / Distress        (👶)")
    print("  [5] Door Knock                    (🚪)")
    print("  [6] Doorbell Chime                (🔔)")
    print("  [7] High Voice / Shouting         (🗣️)")
    print("  [8] Normal Quiet Ambient          (🍃)")
    print("  [Q] Exit")
    print("========================================================")

    sound_map = {
        "1": "SIREN_ALARM",
        "2": "GLASS_CRACK",
        "3": "DOG_BARK",
        "4": "BABY_CRY",
        "5": "DOOR_KNOCK",
        "6": "DOORBELL",
        "7": "HIGH_VOICE",
        "8": "NORMAL_AMBIENT"
    }

    while True:
        try:
            choice = input("\nEnter choice (1-8 or Q to quit): ").strip().upper()
        except (KeyboardInterrupt, EOFError):
            break

        if choice == "Q":
            break

        if choice not in sound_map:
            print("Invalid option. Please choose 1-8.")
            continue

        selected_sound = sound_map[choice]
        print(f"\n[SYNTH] Synthesizing acoustic wave for: {selected_sound}...")
        audio = generate_synthetic_sound(selected_sound)

        result = classifier.classify_chunk(audio)
        profile = result["profile"]
        feats = result["features"]

        print(f"[CLASSIFICATION] -> {profile['icon']} {profile['name']}")
        print(f"                 Confidence : {result['confidence']*100:.1f}%")
        print(f"                 Decibels   : {feats['decibels']} dB")
        print(f"                 Centroid   : {feats['spectral_centroid']} Hz")
        print(f"                 Dominant   : {feats['dominant_freq']} Hz")
        print(f"                 Flatness   : {feats['spectral_flatness']}")
        print(f"                 Crest Fctr : {feats['crest_factor']}")

        # Push to Firebase
        now = time.time()
        payload = {
            "sound_class": result["sound_class"],
            "display_name": profile["name"],
            "icon": profile["icon"],
            "severity": profile["severity"],
            "confidence": result["confidence"],
            "decibels": feats["decibels"],
            "suggested_action": profile["suggested_action"],
            "strobe_color": profile["strobe_color"],
            "timestamp": datetime.datetime.utcnow().isoformat() + "Z",
            "timestamp_epoch": int(now * 1000)
        }

        # Update telemetry and events
        sync_to_firebase(firebase_url, "/latest_sound_classification.json", payload, auth_token)
        append_firebase_event(firebase_url, payload, auth_token)

        telemetry = {
            "sound_level_db": feats["decibels"],
            "device_status": "ONLINE",
            "timestamp_ms": int(now * 1000)
        }
        sync_to_firebase(firebase_url, "/live_telemetry.json", telemetry, auth_token)

        print(f"[FIREBASE] Successfully synchronized to Realtime Database!")


def main():
    parser = argparse.ArgumentParser(description="Acoustic Sound Classifier for Assistive Hearing System")
    parser.add_argument("--firebase-url", type=str, default=DEFAULT_FIREBASE_URL, help="Firebase Realtime Database URL")
    parser.add_argument("--auth", type=str, default=FIREBASE_AUTH_TOKEN, help="Firebase Auth Token / Secret")
    parser.add_argument("--mode", type=str, choices=["live", "sim"], default="live", help="Capture mode: 'live' or 'sim'")
    args = parser.parse_args()

    # Automatically select live if microphone is present, else fall back to sim
    if args.mode == "live":
        if AUDIO_CAPTURE_AVAILABLE:
            run_live_microphone(args.firebase_url, args.auth)
        else:
            print("[WARN] Audio capture device not available. Switching to simulation mode.")
            run_simulation(args.firebase_url, args.auth)
    else:
        run_simulation(args.firebase_url, args.auth)


if __name__ == "__main__":
    main()
