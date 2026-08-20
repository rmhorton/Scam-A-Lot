import base64
import json
import re
from pathlib import Path
import sys

import requests

# I swear this used to work at 127.0.0.1:42008
API_URL = "http://127.0.0.1:42010/api/v1/base/generate-with-prompt"

VOICES = {
    "DAVE": {
        "prompt_id": "cdb8ac21-b904-417d-84d7-e3f7166533f6",
        "instruct": "Professional radio host. Confident, authoritative, slightly smug.",
        },

    "FLOWER": {
        "prompt_id": "3097e86b-1f17-4768-9037-2b3822e03676",
        "instruct": "Warm pirate radio host. Intelligent, calm, slightly amused.",
    },

    "BILL": {
        # BILL: An ordinary small-town American man calling a late-night radio show. Shy, nervous, and increasingly uneasy as he 
        # describes something he cannot explain. Notable vocal tension, occasional hesitation, and a desire to be taken seriously. 
        # Sounds like a real person rather than a performer.
        "prompt_id":"912144ec-19a3-435e-9cd8-fa486ea1c28f",
        "instruct": "Ordinary citizen calling a radio show. Slightly nervous but sincere."
    }, 

    "ANNOUNCER": {
        # JOHN: An authoritative male announcer with the polished confidence of a government propaganda broadcast. Deep basso profundo voice, 
        # perfect diction, dramatic emphasis, and unwavering certainty. Sounds like a cross between a national radio announcer, a 
        # movie trailer narrator, and a patriotic newsreel presenter. Grand, reassuring, and slightly over-the-top. Every sentence 
        # sounds important, official, and unquestionably true. Mid-Atlantic accent.
        "prompt_id":"30b822de-3f2c-4cb2-a11d-bf356c9e66d6",
        "instruct": "Official state radio announcer. Absolute confidence, perfect diction, dramatic emphasis, and patriotic enthusiasm."
    },

    "SCOTT": {
        # Scott: A middle-aged male broadcast engineer with a practical, working-class voice. Natural American accent, slightly rough around the edges, 
        # clear but informal speech. Sounds competent, tired, and focused on solving technical problems rather than impressing anyone. Speaks plainly and 
        # directly, with occasional signs of stress or frustration when equipment starts failing. The voice of someone who keeps the station running 
        # while everyone else is making speeches.  Speed 0.5x.
        "prompt_id": "29884adf-110b-4999-970c-ead198626e87",
        "instruct": "Broadcast engineer. Practical, direct, and slightly stressed. Speak naturally and conversationally. Focused on solving technical problems, not performing for an audience." 
    },

    "CARL": {
        # Carl: A young male radio engineer in his late twenties or early thirties. Intelligent, practical, and moderately exasperated. Casual conversational 
        # voice with a hint of sarcasm. Sounds like the only adult in the room whenever something goes wrong.
        "prompt_id": "842464aa-cee7-4c9d-a8b2-e4a4fc8fdd44",
        "instruct": "Broadcast engineer. Practical, direct, and slightly stressed. Speak naturally and conversationally. Focused on solving technical problems, not performing for an audience." 
    },

    "ENGINEER": {
        # Carl
        "prompt_id": "842464aa-cee7-4c9d-a8b2-e4a4fc8fdd44",
        "instruct": "Broadcast engineer. Practical, direct, and slightly stressed. Speak naturally and conversationally. Focused on solving technical problems, not performing for an audience." 
    },

    "TRAVIS": {
        "prompt_id": "110a7e03-409f-46da-8d9c-432315d1b723",
        "instruct": "Shouting from the control room."
    },

    "CHIP":{
        "prompt_id": "Chip_Chopper",
        "instruct": "Speaks loudly over background noise." 
    },

    "JIM":{
        "prompt_id": "Announcer_Jim",
        "instruct": "News anchor talking in the studio." 
    },

    "DONALD":{
        "prompt_id": "Donald6",
        "instruct": "Speaks spontaneously with confidence." 
    },

    "DON_JUNIOR":{
        "prompt_id": "Donald11",
        "instruct": "Speaks spontaneously with confidence." 
    },

    "KING":{
        "prompt_id": "Donald6",
        "instruct": "Speaks spontaneously with confidence." 
    },

    "MARY": {
        "prompt_id": "afa957ee-52d8-48f7-adf1-b78e2da1c976",
        "instruct": "Feels it is her patriotic duty to point out problems"
    },

    "SARA": {
        "prompt_id": "05683383-bbba-4d45-8c1f-22083727ceea",
        "instruct": "Hesitant to criticize the government"
    },

    "CALLER1": {
        # BILL:
        "prompt_id":"912144ec-19a3-435e-9cd8-fa486ea1c28f",
        "instruct": "Ordinary citizen calling a radio show. Slightly nervous but sincere."
    }, 

    "CALLER2":{
        "prompt_id": "Chip_Chopper",
        "instruct": "Speaks loudly over background noise." 
    },

    "CALLER3":{
        # MARY
        "prompt_id": "afa957ee-52d8-48f7-adf1-b78e2da1c976",
         "instruct": "Feels it is her patriotic duty to point out problems. "
    },

    "CALLER4":{
        "prompt_id": "Announcer_Jim",
        "instruct": "News anchor talking in the studio." 
    },

    "CALLER5": {
        # Sara
        "prompt_id": "05683383-bbba-4d45-8c1f-22083727ceea",
        "instruct": "Hesitant to criticize the government"
     },

    "CALLER6": {
        # SCOTT
        "prompt_id": "29884adf-110b-4999-970c-ead198626e87",
        "instruct": "Broadcast engineer. Practical, direct, and slightly stressed. Speak naturally and conversationally. Focused on solving technical problems, not performing for an audience." 
    },

    "CASHWELL": {
        "prompt_id": "Cashwell",
        "instruct": " Southern hellfire and brimstone preacher. " 
    },

    "CHOIR": {
        # BILL
        "prompt_id":"912144ec-19a3-435e-9cd8-fa486ea1c28f",
        "instruct": "Ordinary citizen calling a radio show. Slightly nervous but sincere."
    }, 
}

def parse_script(path: Path):
    speeches = []

    current_speaker = None
    current_direction = None
    current_text = []

    header_re = re.compile(
        r"^([A-Z][A-Z0-9_ ]+)(?:\s*\[(.*?)\])?:\s*(.*)$"
    )

    def save_current():
        if current_speaker and current_text:
            text = " ".join(line.strip() for line in current_text if line.strip())
            if text:
                speeches.append((current_speaker, current_direction, text))

    for raw in path.read_text().splitlines():
        line = raw.strip()

        if not line:
            continue

        # Ignore production notes:
        # [SFX: Duck quack]
        # [MUSIC: Theme fades]
        # [PAUSE: 2s]
        if line.startswith("[") or line.startswith('#') or line.startswith(' '):
            continue

        match = header_re.match(line)

        if match:
            save_current()
        
            current_speaker = match.group(1).strip()
            current_direction = match.group(2).strip() if match.group(2) else None
        
            inline_text = match.group(3).strip()
            current_text = [inline_text] if inline_text else []
        else:
            if current_speaker:
                current_text.append(line)

    save_current()
    return speeches

def save_audio_response(response, out_path: Path):
    content_type = response.headers.get("content-type", "")

    # Case 1: API returns raw WAV/audio bytes
    if "audio" in content_type or response.content[:4] == b"RIFF":
        out_path.write_bytes(response.content)
        return

    # Case 2: API returns JSON containing base64 audio or URL/path
    data = response.json()

    for key in ["audio", "audio_base64", "wav", "data"]:
        if key in data and isinstance(data[key], str):
            try:
                out_path.write_bytes(base64.b64decode(data[key]))
                return
            except Exception:
                pass

    # Helpful debug if the format is different
    raise RuntimeError(f"Unknown API response format:\n{json.dumps(data, indent=2)[:2000]}")

def generate_line(speaker, direction, text, index, output_dir):
  
    config = VOICES[speaker]
    
    if direction:
        instruct = f"{config['instruct']} For this line: {direction}."
    else:
        instruct = config["instruct"]
        
    payload = {
      "prompt_id": config["prompt_id"],
      "text": text,
      "language": "English",
      "instruct": instruct,
      "speed": 1,
      "response_format": "base64",
    }
    response = requests.post(API_URL, json=payload, timeout=300)

    if response.status_code != 200:
        raise RuntimeError(
            f"API error {response.status_code} for line {index}:\n{response.text}"
        )

    out_path = output_dir / f"{index:03d}_{speaker.lower()}.wav"
    save_audio_response(response, out_path)
    print(f"Saved {out_path}")

def main():

    if len(sys.argv) < 2:
        print("Usage:")
        print("    python perform_scene.py <dialog_file>")
        sys.exit(1)
    
    script_path = Path(sys.argv[1])

    output_dir = script_path.with_suffix("")
    output_dir = output_dir.parent / f"{output_dir.name}_audio"

    output_dir.mkdir(exist_ok=True)

    lines = parse_script(script_path)

    for i, (speaker, direction, text) in enumerate(lines, start=1):
        if speaker not in VOICES:
            raise ValueError(f"No voice configured for speaker: {speaker}")

        print(f"{i:03d} {speaker}: {text[:60]}...")
        generate_line(speaker, direction, text, i, output_dir)

if __name__ == "__main__":
    main()



# TO DO: 
#   * Support processing multiple input files in a single run (e.g., python qwen_dialog_reader.py scene1.txt scene2.txt) to simplify batch generation. 
#   * Use a configuration file for voice assignments and prompt IDs so characters can be added or modified without editing the Python code. 
#   * Add optional dialog validation by transcribing the generated audio with Whisper (or another speech-to-text model) and comparing the transcript to the original text, flagging omitted or altered words for review. 

