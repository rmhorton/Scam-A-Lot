#!/usr/bin/env python3
"""Export a ShowRunner SONGS configuration as an ordered MP3 playlist.

Complete audio files are copied byte-for-byte. Entries with startTime and/or
stopTime are extracted with the ffmpeg command-line executable and encoded as
new MP3 files.


python tools/export_radio_playlist.py \
  docs/configs/radio_show_full.js \
  --audio-dir audio \
  --output-dir playlist

"""

from __future__ import annotations

import argparse
import json
import os
from pathlib import Path
import re
import shutil
import subprocess
import sys
import tempfile
from typing import Any


class ConfigError(ValueError):
    """Raised when the JavaScript configuration is malformed or unsupported."""


class JavaScriptDataParser:
    """Parse the data-only JavaScript subset used by ShowRunner configs."""

    def __init__(self, text: str, start: int = 0) -> None:
        self.text = text
        self.pos = start

    def error(self, message: str) -> ConfigError:
        line = self.text.count("\n", 0, self.pos) + 1
        last_newline = self.text.rfind("\n", 0, self.pos)
        column = self.pos - last_newline
        return ConfigError(f"{message} at line {line}, column {column}")

    def skip_space_and_comments(self) -> None:
        while self.pos < len(self.text):
            if self.text[self.pos].isspace():
                self.pos += 1
            elif self.text.startswith("//", self.pos):
                newline = self.text.find("\n", self.pos + 2)
                self.pos = len(self.text) if newline < 0 else newline + 1
            elif self.text.startswith("/*", self.pos):
                end = self.text.find("*/", self.pos + 2)
                if end < 0:
                    raise self.error("Unterminated block comment")
                self.pos = end + 2
            else:
                return

    def parse(self) -> Any:
        self.skip_space_and_comments()
        if self.pos >= len(self.text):
            raise self.error("Expected a value")

        char = self.text[self.pos]
        if char == "[":
            return self.parse_array()
        if char == "{":
            return self.parse_object()
        if char in {'"', "'"}:
            return self.parse_string()
        if char.isdigit() or char in "+-.":
            return self.parse_number()
        if char.isalpha() or char in "_$":
            word = self.parse_identifier()
            constants = {"true": True, "false": False, "null": None}
            if word in constants:
                return constants[word]
            raise self.error(f"Unsupported JavaScript value {word!r}")
        raise self.error(f"Unexpected character {char!r}")

    def parse_array(self) -> list[Any]:
        self.pos += 1
        result: list[Any] = []
        self.skip_space_and_comments()
        if self._consume("]"):
            return result

        while True:
            result.append(self.parse())
            self.skip_space_and_comments()
            if self._consume("]"):
                return result
            if not self._consume(","):
                raise self.error("Expected ',' or ']' in array")
            self.skip_space_and_comments()
            if self._consume("]"):
                return result

    def parse_object(self) -> dict[str, Any]:
        self.pos += 1
        result: dict[str, Any] = {}
        self.skip_space_and_comments()
        if self._consume("}"):
            return result

        while True:
            self.skip_space_and_comments()
            if self.pos < len(self.text) and self.text[self.pos] in {'"', "'"}:
                key = self.parse_string()
            else:
                key = self.parse_identifier()
            self.skip_space_and_comments()
            if not self._consume(":"):
                raise self.error("Expected ':' after object key")
            if key in result:
                raise self.error(f"Duplicate object key {key!r}")
            result[key] = self.parse()
            self.skip_space_and_comments()
            if self._consume("}"):
                return result
            if not self._consume(","):
                raise self.error("Expected ',' or '}' in object")
            self.skip_space_and_comments()
            if self._consume("}"):
                return result

    def parse_identifier(self) -> str:
        match = re.match(r"[A-Za-z_$][A-Za-z0-9_$]*", self.text[self.pos :])
        if not match:
            raise self.error("Expected an identifier")
        self.pos += len(match.group(0))
        return match.group(0)

    def parse_string(self) -> str:
        quote = self.text[self.pos]
        self.pos += 1
        pieces: list[str] = []
        escapes = {
            "b": "\b",
            "f": "\f",
            "n": "\n",
            "r": "\r",
            "t": "\t",
            "v": "\v",
            "0": "\0",
            "\\": "\\",
            "'": "'",
            '"': '"',
        }

        while self.pos < len(self.text):
            char = self.text[self.pos]
            self.pos += 1
            if char == quote:
                return "".join(pieces)
            if char in "\r\n":
                raise self.error("Unterminated string")
            if char != "\\":
                pieces.append(char)
                continue
            if self.pos >= len(self.text):
                raise self.error("Unterminated string escape")
            escaped = self.text[self.pos]
            self.pos += 1
            if escaped in escapes:
                pieces.append(escapes[escaped])
            elif escaped == "u":
                pieces.append(self._parse_hex_escape(4))
            elif escaped == "x":
                pieces.append(self._parse_hex_escape(2))
            elif escaped in "\r\n":
                if escaped == "\r" and self.pos < len(self.text) and self.text[self.pos] == "\n":
                    self.pos += 1
            else:
                pieces.append(escaped)
        raise self.error("Unterminated string")

    def _parse_hex_escape(self, digits: int) -> str:
        value = self.text[self.pos : self.pos + digits]
        if len(value) != digits or not re.fullmatch(r"[0-9A-Fa-f]+", value):
            raise self.error("Invalid hexadecimal string escape")
        self.pos += digits
        return chr(int(value, 16))

    def parse_number(self) -> int | float:
        match = re.match(
            r"[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?",
            self.text[self.pos :],
        )
        if not match:
            raise self.error("Invalid number")
        token = match.group(0)
        self.pos += len(token)
        return float(token) if any(char in token for char in ".eE") else int(token)

    def _consume(self, token: str) -> bool:
        if self.text.startswith(token, self.pos):
            self.pos += len(token)
            return True
        return False


def load_songs(config_path: Path) -> list[dict[str, Any]]:
    try:
        text = config_path.read_text(encoding="utf-8-sig")
    except OSError as exc:
        raise ConfigError(f"Cannot read config file {config_path}: {exc}") from exc

    declaration = re.search(r"\b(?:const|let|var)\s+SONGS\s*=", text)
    if not declaration:
        raise ConfigError("Could not find a 'const SONGS = [...]' declaration")

    parser = JavaScriptDataParser(text, declaration.end())
    songs = parser.parse()
    if not isinstance(songs, list):
        raise ConfigError("SONGS must be an array")
    if not all(isinstance(song, dict) for song in songs):
        raise ConfigError("Every SONGS entry must be an object")
    if not songs:
        raise ConfigError("SONGS is empty")
    return songs


def parse_time(value: Any, field_name: str, segment_id: str) -> float:
    if isinstance(value, (int, float)) and not isinstance(value, bool):
        seconds = float(value)
    elif isinstance(value, str):
        parts = value.strip().split(":")
        if not 1 <= len(parts) <= 3:
            raise ConfigError(
                f"Segment {segment_id!r} has invalid {field_name} value {value!r}"
            )
        try:
            numbers = [float(part) for part in parts]
        except ValueError as exc:
            raise ConfigError(
                f"Segment {segment_id!r} has invalid {field_name} value {value!r}"
            ) from exc
        if any(number < 0 for number in numbers):
            raise ConfigError(f"Segment {segment_id!r} has a negative {field_name}")
        seconds = 0.0
        for number in numbers:
            seconds = seconds * 60 + number
    else:
        raise ConfigError(
            f"Segment {segment_id!r} has non-numeric {field_name} value {value!r}"
        )

    if seconds < 0:
        raise ConfigError(f"Segment {segment_id!r} has a negative {field_name}")
    return seconds


def safe_segment_id(value: Any, index: int) -> str:
    if not isinstance(value, str) or not value:
        raise ConfigError(f"SONGS entry {index} must have a non-empty string id")
    if value in {".", ".."} or any(char in value for char in ("/", "\\", "\0")):
        raise ConfigError(
            f"Segment id {value!r} cannot be used as a filename without changing it"
        )
    return value


def source_path(audio_dir: Path, value: Any, segment_id: str) -> Path:
    if not isinstance(value, str) or not value:
        raise ConfigError(f"Segment {segment_id!r} must have a non-empty string audio field")
    path = Path(value)
    return path if path.is_absolute() else audio_dir / path


def locate_ffmpeg(requested: str | None) -> str | None:
    if requested:
        candidate = Path(requested).expanduser()
        if candidate.is_file() and os.access(candidate, os.X_OK):
            return str(candidate)
        found = shutil.which(requested)
        if found:
            return found
        raise ConfigError(f"ffmpeg executable not found at {requested!r}")
    return shutil.which("ffmpeg")


def clip_audio(
    ffmpeg: str,
    source: Path,
    destination: Path,
    start: float,
    stop: float | None,
) -> None:
    destination.parent.mkdir(parents=True, exist_ok=True)
    file_descriptor, temporary_name = tempfile.mkstemp(
        prefix=f".{destination.stem}_", suffix=".mp3", dir=destination.parent
    )
    os.close(file_descriptor)
    temporary = Path(temporary_name)
    try:
        command = [
            ffmpeg,
            "-hide_banner",
            "-loglevel",
            "error",
            "-nostdin",
            "-y",
            "-i",
            str(source),
            "-ss",
            f"{start:.6f}",
        ]
        if stop is not None:
            command.extend(["-t", f"{stop - start:.6f}"])
        command.extend(
            [
                "-map",
                "0:a:0",
                "-vn",
                "-c:a",
                "libmp3lame",
                "-q:a",
                "2",
                "-map_metadata",
                "-1",
                str(temporary),
            ]
        )
        completed = subprocess.run(command, text=True, capture_output=True, check=False)
        if completed.returncode != 0:
            detail = completed.stderr.strip() or "unknown ffmpeg error"
            raise RuntimeError(f"ffmpeg failed for {source.name}: {detail}")
        os.replace(temporary, destination)
    finally:
        temporary.unlink(missing_ok=True)


def build_export_plan(
    songs: list[dict[str, Any]], audio_dir: Path, output_dir: Path
) -> list[dict[str, Any]]:
    width = max(3, len(str(len(songs))))
    plan: list[dict[str, Any]] = []

    for index, song in enumerate(songs, start=1):
        segment_id = safe_segment_id(song.get("id"), index)
        source = source_path(audio_dir, song.get("audio"), segment_id)
        destination = output_dir / f"{index:0{width}d}_{segment_id}.mp3"
        is_clip = "startTime" in song or "stopTime" in song
        start = parse_time(song.get("startTime", 0), "startTime", segment_id)
        stop = (
            parse_time(song["stopTime"], "stopTime", segment_id)
            if "stopTime" in song
            else None
        )
        if stop is not None and stop <= start:
            raise ConfigError(
                f"Segment {segment_id!r} stopTime must be later than startTime"
            )
        plan.append(
            {
                "id": segment_id,
                "source": source,
                "destination": destination,
                "is_clip": is_clip,
                "start": start,
                "stop": stop,
            }
        )
    return plan


def parse_arguments() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description=(
            "Create an ordered directory of MP3 files from a ShowRunner "
            "JavaScript SONGS configuration."
        )
    )
    parser.add_argument("config", type=Path, help="JavaScript config containing const SONGS")
    parser.add_argument("--audio-dir", type=Path, required=True, help="Directory containing source MP3 files")
    parser.add_argument("--output-dir", type=Path, required=True, help="Directory for generated playlist MP3 files")
    parser.add_argument("--ffmpeg", help="Path or command name for the ffmpeg executable")
    parser.add_argument("--overwrite", action="store_true", help="Replace playlist files that already exist")
    parser.add_argument("--dry-run", action="store_true", help="Validate and display the export plan without writing files")
    return parser.parse_args()


def main() -> int:
    args = parse_arguments()
    try:
        songs = load_songs(args.config)
        plan = build_export_plan(songs, args.audio_dir, args.output_dir)

        missing = [item["source"] for item in plan if not item["source"].is_file()]
        if missing:
            formatted = "\n".join(f"  {path}" for path in sorted(set(missing)))
            raise ConfigError(f"Source audio files not found:\n{formatted}")

        existing = [item["destination"] for item in plan if item["destination"].exists()]
        if existing and not args.overwrite:
            formatted = "\n".join(f"  {path}" for path in existing)
            raise ConfigError(
                "Output files already exist (use --overwrite to replace them):\n"
                f"{formatted}"
            )

        needs_ffmpeg = any(item["is_clip"] for item in plan)
        ffmpeg = locate_ffmpeg(args.ffmpeg) if needs_ffmpeg else None
        if needs_ffmpeg and ffmpeg is None:
            raise ConfigError(
                "Timed segments require the ffmpeg command-line executable. "
                "The similarly named Python package does not provide it."
            )

        if args.dry_run:
            for item in plan:
                operation = "CLIP" if item["is_clip"] else "COPY"
                print(f"{operation:4} {item['source']} -> {item['destination']}")
            print(f"\nValidated {len(plan)} playlist segments; no files written.")
            return 0

        args.output_dir.mkdir(parents=True, exist_ok=True)
        copied = 0
        clipped = 0
        for item in plan:
            destination: Path = item["destination"]
            if item["is_clip"]:
                assert ffmpeg is not None
                clip_audio(
                    ffmpeg,
                    item["source"],
                    destination,
                    item["start"],
                    item["stop"],
                )
                clipped += 1
                operation = "clipped"
            else:
                shutil.copy2(item["source"], destination)
                copied += 1
                operation = "copied"
            print(f"{destination.name} ({operation} from {item['source'].name})")

        print(
            f"\nCreated {len(plan)} playlist files in {args.output_dir} "
            f"({copied} copied, {clipped} clipped)."
        )
        return 0
    except (ConfigError, OSError, RuntimeError) as exc:
        print(f"error: {exc}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
