"""
================================================================================
AuraSound IoT: Automated Cloud Emergency Voice Caller (Twilio Voice Engine)
================================================================================
This script enables genuine outbound automated voice calling for deaf residents.

HOW IT WORKS:
1. When triggered, this script uses Twilio Voice API to place an outbound phone
   call to the specified emergency number (e.g. Police 112, Neighbour, Fire, etc.).
2. The resident's computer/phone makes ZERO sound.
3. The cloud telephony system dials the responder's phone.
4. The moment the responder/officer PICKS UP THE CALL, the cloud synthesizer
   reads the automated emergency distress message directly into their ear
   over the telephone connection:
   "Emergency! Emergency! This is an urgent automated voice call from a deaf 
    resident who cannot speak on a phone call. Assistance is urgently required 
    at [Address]..."
5. Once the message finishes or is acknowledged, the call ends cleanly.

USAGE:
  python automated_emergency_call.py --to +919876543210 --category police --address "Hostel Block B, Room 204"
================================================================================
"""

import sys
import os
import argparse
import json

# Try importing twilio (optional dependency)
try:
    from twilio.rest import Client
    from twilio.twiml.voice_response import VoiceResponse, Say
    TWILIO_AVAILABLE = True
except ImportError:
    TWILIO_AVAILABLE = False

# Configuration (can be populated via environment variables or direct config)
TWILIO_ACCOUNT_SID = os.environ.get("TWILIO_ACCOUNT_SID", "YOUR_TWILIO_ACCOUNT_SID")
TWILIO_AUTH_TOKEN  = os.environ.get("TWILIO_AUTH_TOKEN", "YOUR_TWILIO_AUTH_TOKEN")
TWILIO_FROM_PHONE  = os.environ.get("TWILIO_FROM_PHONE", "+1234567890")

EMERGENCY_MESSAGES = {
    "police": (
        "Emergency! Emergency! This is an urgent automated voice call on behalf of a deaf resident "
        "who cannot speak on a phone call. Police assistance is urgently required at {address}. "
        "The resident is in danger and unable to vocalize. Please dispatch emergency officers to {address} immediately!"
    ),
    "women": (
        "Emergency distress call! This is an urgent automated voice call on behalf of a deaf woman "
        "who cannot speak on a phone call. Immediate safety assistance is required at {address}. "
        "Please send immediate emergency help to {address}!"
    ),
    "fire": (
        "Fire emergency! Fire emergency! This is an automated distress call from a deaf resident "
        "who cannot speak on a phone call. Fire brigade assistance is urgently needed at {address}. "
        "Please dispatch a fire unit to {address} immediately!"
    ),
    "ambulance": (
        "Medical emergency! Medical emergency! This is an automated voice call from a deaf resident "
        "who cannot speak. Medical help and an ambulance are urgently required at {address}. "
        "Please dispatch an ambulance to {address} immediately!"
    ),
    "neighbour": (
        "Emergency alert! This call is from your deaf neighbor at {address}. "
        "I cannot speak on a voice call and require your immediate assistance. "
        "Please come over to my room at {address} right now!"
    )
}

def generate_twiml_voice_response(category, address):
    template = EMERGENCY_MESSAGES.get(category.lower(), EMERGENCY_MESSAGES["neighbour"])
    spoken_text = template.format(address=address)
    
    twiml = f"""<?xml version="1.0" encoding="UTF-8"?>
<Response>
    <Pause length="1"/>
    <Say voice="Polly.Aditi" language="en-IN">
        {spoken_text}
    </Say>
    <Pause length="2"/>
    <Say voice="Polly.Aditi" language="en-IN">
        Repeating: {spoken_text}
    </Say>
</Response>"""
    return twiml, spoken_text

def place_cloud_emergency_call(to_phone, category, address):
    twiml, text = generate_twiml_voice_response(category, address)
    
    print("\n" + "="*70)
    print(f"[*] [AuraSound IoT] Automated Cloud Emergency Caller")
    print(f"Target Recipient: {to_phone} ({category.upper()})")
    print(f"Resident Address: {address}")
    print(f"Resident Device Audio: Completely SILENT (0 dB)")
    print(f"Audio Path: Spoken directly to responder upon call pickup")
    print("="*70)
    print(f"\n[Spoken Message on Call Pickup]:\n\"{text}\"\n")
    
    if not TWILIO_AVAILABLE:
        print("[!] NOTE: Twilio SDK not installed in current Python environment.")
        print("To make live cloud telephone calls, run: pip install twilio")
        print("Then configure TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, and TWILIO_FROM_PHONE.")
        print("="*70 + "\n")
        return False

    if "YOUR_TWILIO" in TWILIO_ACCOUNT_SID:
        print("[!] NOTE: Twilio credentials not set. Set TWILIO_ACCOUNT_SID and TWILIO_AUTH_TOKEN to dispatch live calls.")
        print("="*70 + "\n")
        return False

    try:
        client = Client(TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN)
        call = client.calls.create(
            twiml=twiml,
            to=to_phone,
            from_=TWILIO_FROM_PHONE
        )
        print(f"✓ Outbound call dispatched! Call SID: {call.sid}")
        print("✓ Telephony cloud will speak message to responder when answered.")
        return True
    except Exception as e:
        print(f"✗ Failed to dispatch Twilio call: {e}")
        return False

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="AuraSound IoT Cloud Emergency Voice Caller")
    parser.add_argument("--to", default="+919876543210", help="Recipient phone number")
    parser.add_argument("--category", default="police", choices=["police", "women", "fire", "ambulance", "neighbour"])
    parser.add_argument("--address", default="Hostel Block B, Room 204", help="Resident address")
    args = parser.parse_args()

    place_cloud_emergency_call(args.to, args.category, args.address)
