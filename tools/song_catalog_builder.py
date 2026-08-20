#!/usr/bin/env python3
"""Build cross-reference CSV catalogs from ShowBuilder JavaScript show files.

The script reads one or more JavaScript files containing a ``SONGS`` array.
Each object in that array may contain:

    id: "segment-id"
    audio: "audio-file.mp3"
    startTime: "1:04"       # optional
    stopTime: "1:57"        # optional

It writes:

* ``audio_file_usage.csv`` -- every MP3 under the audio directory and the
  show configuration files that reference it.
* ``show_audio_segments.csv`` -- every show entry, including its segment ID,
  optional boundaries, and computed duration in seconds.

Only Python's standard library is required. ``ffprobe`` (normally installed
with FFmpeg) is used to measure MP3 duration for whole-file or open-ended
segments.

Run from the repo root directory:

The config files are not all in the same directory; the default config file is in docs/js and the others are in docs/configs. I put an alias to config.js in the configs directory.

python tools/song_catalog_builder.py \
  --audio-dir audio \
  --output-dir . \
  docs/configs/*.js

python tools/song_catalog_builder.py \
  --audio-dir audio \
  --output-dir catalogs \
  docs/js/config.js docs/configs/radio_show_full.js


"""

from __future__ import annotations

import argparse
import csv
import glob
import json
import re
import shutil
import subprocess
import sys
from collections import defaultdict
from dataclasses import dataclass
from pathlib import Path
from typing import Iterator, Sequence


MP3_SUFFIXES = {".mp3"}


@dataclass(frozen=True)
class Token:
    kind: str
    value: str
    line: int


@dataclass
class ShowEntry:
    show_path: Path
    segment_id: str
    audio_reference: str
    start_time: str | float | int | None
    stop_time: str | float | int | None
    source_line: int
    audio_path: Path | None = None


class CatalogError(Exception):
    """An error that should be reported cleanly to the command-line user."""


def decode_js_string(raw: str, quote: str) -> str:
    """Decode common JavaScript escapes without evaluating JavaScript."""
    result: list[str] = []
    i = 0
    simple_escapes = {
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
        "`": "`",
    }
    while i < len(raw):
        char = raw[i]
        if char != "\\":
            result.append(char)
            i += 1
            continue

        i += 1
        if i >= len(raw):
            result.append("\\")
            break
        escaped = raw[i]
        if escaped in simple_escapes:
            result.append(simple_escapes[escaped])
            i += 1
        elif escaped in "\n\r":
            if escaped == "\r" and i + 1 < len(raw) and raw[i + 1] == "\n":
                i += 1
            i += 1
        elif escaped == "x" and i + 2 < len(raw):
            digits = raw[i + 1 : i + 3]
            try:
                result.append(chr(int(digits, 16)))
                i += 3
            except ValueError:
                result.extend(("\\", escaped))
                i += 1
        elif escaped == "u" and i + 4 < len(raw):
            digits = raw[i + 1 : i + 5]
            try:
                result.append(chr(int(digits, 16)))
                i += 5
            except ValueError:
                result.extend(("\\", escaped))
                i += 1
        else:
            # JavaScript permits escaping some otherwise ordinary characters.
            result.append(escaped)
            i += 1
    return "".join(result)


def tokenize_javascript(text: str, source: Path) -> Iterator[Token]:
    """Tokenize enough JavaScript to safely inspect literal SONGS objects."""
    i = 0
    line = 1
    length = len(text)
    punctuation = set("{}[]():,;=.")

    while i < length:
        char = text[i]
        if char.isspace():
            if char == "\n":
                line += 1
            i += 1
            continue

        if text.startswith("//", i):
            newline = text.find("\n", i + 2)
            if newline < 0:
                break
            i = newline
            continue

        if text.startswith("/*", i):
            end = text.find("*/", i + 2)
            if end < 0:
                raise CatalogError(f"{source}:{line}: unterminated block comment")
            line += text.count("\n", i, end + 2)
            i = end + 2
            continue

        if char in "'\"`":
            quote = char
            string_line = line
            i += 1
            start = i
            raw_parts: list[str] = []
            while i < length:
                if text[i] == "\\":
                    raw_parts.append(text[start:i])
                    if i + 1 >= length:
                        raise CatalogError(
                            f"{source}:{string_line}: unterminated string literal"
                        )
                    raw_parts.append(text[i : i + 2])
                    if text[i + 1] == "\n":
                        line += 1
                    i += 2
                    start = i
                    continue
                if text[i] == quote:
                    raw_parts.append(text[start:i])
                    i += 1
                    yield Token(
                        "STRING", decode_js_string("".join(raw_parts), quote), string_line
                    )
                    break
                if text[i] == "\n":
                    if quote != "`":
                        raise CatalogError(
                            f"{source}:{string_line}: unterminated string literal"
                        )
                    line += 1
                i += 1
            else:
                raise CatalogError(f"{source}:{string_line}: unterminated string literal")
            continue

        if char.isalpha() or char in "_$":
            start = i
            i += 1
            while i < length and (text[i].isalnum() or text[i] in "_$"):
                i += 1
            yield Token("IDENT", text[start:i], line)
            continue

        if char.isdigit() or (
            char in "+-" and i + 1 < length and (text[i + 1].isdigit() or text[i + 1] == ".")
        ):
            match = re.match(r"[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?", text[i:])
            if match:
                value = match.group(0)
                yield Token("NUMBER", value, line)
                i += len(value)
                continue

        if char in punctuation:
            yield Token("PUNCT", char, line)
        i += 1


def parse_literal_object(tokens: Sequence[Token]) -> dict[str, object]:
    """Read top-level scalar properties from one JavaScript object literal."""
    values: dict[str, object] = {}
    nesting = 0
    i = 0
    while i < len(tokens):
        token = tokens[i]
        if token.kind == "PUNCT":
            if token.value in "{[(":
                nesting += 1
            elif token.value in "}])":
                nesting -= 1

        if (
            nesting == 0
            and token.kind in {"IDENT", "STRING"}
            and i + 2 < len(tokens)
            and tokens[i + 1].kind == "PUNCT"
            and tokens[i + 1].value == ":"
        ):
            value_token = tokens[i + 2]
            if value_token.kind == "STRING":
                values[token.value] = value_token.value
            elif value_token.kind == "NUMBER":
                values[token.value] = float(value_token.value)
            elif value_token.kind == "IDENT" and value_token.value in {
                "null",
                "undefined",
            }:
                values[token.value] = None
        i += 1
    return values


def parse_show_file(path: Path) -> tuple[list[ShowEntry], list[str]]:
    """Extract literal entries from every SONGS array assignment in a file."""
    try:
        text = path.read_text(encoding="utf-8-sig")
    except UnicodeDecodeError as exc:
        raise CatalogError(f"{path}: not valid UTF-8: {exc}") from exc

    tokens = list(tokenize_javascript(text, path))
    entries: list[ShowEntry] = []
    warnings: list[str] = []
    arrays_found = 0
    i = 0

    while i < len(tokens):
        if tokens[i].kind != "IDENT" or tokens[i].value != "SONGS":
            i += 1
            continue

        equals_index: int | None = None
        bracket_index: int | None = None
        for j in range(i + 1, min(i + 8, len(tokens))):
            if tokens[j].kind == "PUNCT" and tokens[j].value == "=":
                equals_index = j
            elif (
                equals_index is not None
                and tokens[j].kind == "PUNCT"
                and tokens[j].value == "["
            ):
                bracket_index = j
                break
            elif tokens[j].kind == "PUNCT" and tokens[j].value == ";":
                break
        if bracket_index is None:
            i += 1
            continue

        arrays_found += 1
        square_depth = 1
        j = bracket_index + 1
        while j < len(tokens) and square_depth:
            token = tokens[j]
            if token.kind == "PUNCT" and token.value == "[":
                square_depth += 1
            elif token.kind == "PUNCT" and token.value == "]":
                square_depth -= 1
                if square_depth == 0:
                    break
            elif token.kind == "PUNCT" and token.value == "{" and square_depth == 1:
                object_line = token.line
                brace_depth = 1
                end = j + 1
                while end < len(tokens) and brace_depth:
                    if tokens[end].kind == "PUNCT" and tokens[end].value == "{":
                        brace_depth += 1
                    elif tokens[end].kind == "PUNCT" and tokens[end].value == "}":
                        brace_depth -= 1
                    end += 1
                if brace_depth:
                    raise CatalogError(f"{path}:{object_line}: unterminated object literal")

                obj = parse_literal_object(tokens[j + 1 : end - 1])
                audio = obj.get("audio")
                if isinstance(audio, str) and audio:
                    raw_id = obj.get("id")
                    if isinstance(raw_id, str) and raw_id:
                        segment_id = raw_id
                    else:
                        segment_id = f"segment-at-line-{object_line}"
                        warnings.append(
                            f"{path}:{object_line}: audio entry has no literal id; "
                            f"using {segment_id!r}"
                        )
                    entries.append(
                        ShowEntry(
                            show_path=path,
                            segment_id=segment_id,
                            audio_reference=audio,
                            start_time=obj.get("startTime"),
                            stop_time=obj.get("stopTime"),
                            source_line=object_line,
                        )
                    )
                j = end - 1
            j += 1
        i = max(i + 1, j + 1)

    if arrays_found == 0:
        warnings.append(f"{path}: no literal SONGS array assignment found")
    return entries, warnings


def expand_show_paths(specifications: Sequence[str]) -> list[Path]:
    """Expand files, directories, and quoted glob patterns into JS files."""
    found: list[Path] = []
    for specification in specifications:
        matches = [Path(item) for item in glob.glob(specification, recursive=True)]
        if not matches:
            matches = [Path(specification)]
        for match in matches:
            if match.is_dir():
                found.extend(
                    path for path in match.rglob("*.js") if path.is_file()
                )
            elif match.is_file():
                found.append(match)
            else:
                raise CatalogError(f"show-file path does not exist: {specification}")

    unique = sorted({path.resolve() for path in found}, key=lambda path: str(path).casefold())
    if not unique:
        raise CatalogError("no JavaScript show files were found")
    return unique


def discover_audio_files(audio_dir: Path) -> list[Path]:
    files = sorted(
        (
            path.resolve()
            for path in audio_dir.rglob("*")
            if path.is_file() and path.suffix.casefold() in MP3_SUFFIXES
        ),
        key=lambda path: str(path).casefold(),
    )
    return files


def normalized_reference(value: str) -> str:
    value = value.replace("\\", "/")
    while value.startswith("./"):
        value = value[2:]
    return value.casefold()


def resolve_audio_references(
    entries: Sequence[ShowEntry], audio_dir: Path, audio_files: Sequence[Path]
) -> list[str]:
    """Resolve config references by relative path, then by unique basename."""
    by_relative: dict[str, list[Path]] = defaultdict(list)
    by_basename: dict[str, list[Path]] = defaultdict(list)
    for path in audio_files:
        relative = path.relative_to(audio_dir).as_posix()
        by_relative[normalized_reference(relative)].append(path)
        by_basename[path.name.casefold()].append(path)

    warnings: list[str] = []
    for entry in entries:
        normalized = normalized_reference(entry.audio_reference)
        candidates = by_relative.get(normalized, [])
        if not candidates:
            candidates = by_basename.get(Path(normalized).name.casefold(), [])
        if len(candidates) == 1:
            entry.audio_path = candidates[0]
        elif not candidates:
            warnings.append(
                f"{entry.show_path}:{entry.source_line}: referenced MP3 not found: "
                f"{entry.audio_reference}"
            )
        else:
            choices = ", ".join(
                candidate.relative_to(audio_dir).as_posix() for candidate in candidates
            )
            warnings.append(
                f"{entry.show_path}:{entry.source_line}: ambiguous MP3 reference "
                f"{entry.audio_reference!r}; matches {choices}"
            )
    return warnings


def shortest_unique_show_names(paths: Sequence[Path]) -> dict[Path, str]:
    """Return compact, unique path labels for configuration files."""
    unresolved = set(paths)
    labels: dict[Path, str] = {}
    max_parts = max(len(path.parts) for path in paths)
    for count in range(1, max_parts + 1):
        groups: dict[str, list[Path]] = defaultdict(list)
        for path in unresolved:
            groups[Path(*path.parts[-count:]).as_posix()].append(path)
        for label, members in groups.items():
            if len(members) == 1:
                labels[members[0]] = label
        unresolved -= set(labels)
        if not unresolved:
            break
    for path in unresolved:
        labels[path] = str(path)
    return labels


def parse_time_seconds(value: object, label: str) -> float | None:
    if value is None or value == "":
        return None
    if isinstance(value, (int, float)):
        if float(value) < 0:
            raise ValueError(f"{label} cannot be negative")
        return float(value)
    if not isinstance(value, str):
        raise ValueError(f"{label} must be a number or time string")

    parts = value.strip().split(":")
    if not 1 <= len(parts) <= 3:
        raise ValueError(f"invalid {label}: {value!r}")
    try:
        numbers = [float(part) for part in parts]
    except ValueError as exc:
        raise ValueError(f"invalid {label}: {value!r}") from exc
    if any(number < 0 for number in numbers):
        raise ValueError(f"{label} cannot be negative")
    if len(numbers) > 1 and any(number >= 60 for number in numbers[1:]):
        raise ValueError(f"minutes and seconds must be below 60 in {label}: {value!r}")
    seconds = 0.0
    for number in numbers:
        seconds = seconds * 60 + number
    return seconds


def probe_mp3_duration(path: Path, ffprobe: str) -> float:
    command = [
        ffprobe,
        "-v",
        "error",
        "-show_entries",
        "format=duration",
        "-of",
        "json",
        str(path),
    ]
    try:
        result = subprocess.run(
            command,
            check=True,
            capture_output=True,
            text=True,
            timeout=30,
        )
        payload = json.loads(result.stdout)
        duration = float(payload["format"]["duration"])
    except (subprocess.SubprocessError, json.JSONDecodeError, KeyError, ValueError) as exc:
        detail = getattr(exc, "stderr", "") or str(exc)
        raise CatalogError(f"could not read duration of {path}: {detail.strip()}") from exc
    if duration < 0:
        raise CatalogError(f"invalid negative duration reported for {path}")
    return duration


def format_time_value(value: object) -> str:
    if value is None:
        return ""
    if isinstance(value, float) and value.is_integer():
        return str(int(value))
    return str(value)


def format_seconds(value: float | None) -> str:
    if value is None:
        return ""
    return f"{value:.3f}"


def calculate_segment_lengths(
    entries: Sequence[ShowEntry], ffprobe: str
) -> tuple[dict[int, float | None], list[str]]:
    durations: dict[Path, float] = {}
    segment_lengths: dict[int, float | None] = {}
    warnings: list[str] = []

    for index, entry in enumerate(entries):
        try:
            start = parse_time_seconds(entry.start_time, "startTime") or 0.0
            stop = parse_time_seconds(entry.stop_time, "stopTime")
            if stop is None:
                if entry.audio_path is None:
                    segment_lengths[index] = None
                    continue
                if entry.audio_path not in durations:
                    durations[entry.audio_path] = probe_mp3_duration(entry.audio_path, ffprobe)
                stop = durations[entry.audio_path]
            if stop < start:
                raise ValueError(
                    f"stopTime ({format_time_value(entry.stop_time)}) precedes "
                    f"startTime ({format_time_value(entry.start_time)})"
                )
            segment_lengths[index] = stop - start
            if entry.audio_path is not None and entry.stop_time is not None:
                if entry.audio_path not in durations:
                    durations[entry.audio_path] = probe_mp3_duration(entry.audio_path, ffprobe)
                if stop > durations[entry.audio_path] + 0.05:
                    warnings.append(
                        f"{entry.show_path}:{entry.source_line}: stopTime exceeds MP3 "
                        f"duration by {stop - durations[entry.audio_path]:.3f} seconds"
                    )
        except (ValueError, CatalogError) as exc:
            warnings.append(f"{entry.show_path}:{entry.source_line}: {exc}")
            segment_lengths[index] = None
    return segment_lengths, warnings


def write_audio_usage_csv(
    output_path: Path,
    audio_dir: Path,
    audio_files: Sequence[Path],
    entries: Sequence[ShowEntry],
    show_names: dict[Path, str],
) -> None:
    usage: dict[Path, list[ShowEntry]] = defaultdict(list)
    for entry in entries:
        if entry.audio_path is not None:
            usage[entry.audio_path].append(entry)

    with output_path.open("w", encoding="utf-8-sig", newline="") as handle:
        writer = csv.DictWriter(
            handle,
            fieldnames=["audio_file_name", "configuration_files", "segment_count"],
        )
        writer.writeheader()
        for audio_path in audio_files:
            file_entries = usage.get(audio_path, [])
            configurations = sorted(
                {show_names[entry.show_path] for entry in file_entries}, key=str.casefold
            )
            writer.writerow(
                {
                    "audio_file_name": audio_path.relative_to(audio_dir).as_posix(),
                    "configuration_files": "; ".join(configurations),
                    "segment_count": len(file_entries),
                }
            )


def write_show_segments_csv(
    output_path: Path,
    audio_dir: Path,
    entries: Sequence[ShowEntry],
    segment_lengths: dict[int, float | None],
    show_names: dict[Path, str],
) -> None:
    with output_path.open("w", encoding="utf-8-sig", newline="") as handle:
        writer = csv.DictWriter(
            handle,
            fieldnames=[
                "configuration_file",
                "audio_file_name",
                "segment_identifier",
                "start_time",
                "stop_time",
                "segment_length_seconds",
            ],
        )
        writer.writeheader()
        for index, entry in enumerate(entries):
            if entry.audio_path is not None:
                audio_file_name = entry.audio_path.relative_to(audio_dir).as_posix()
            else:
                # Preserve an unresolved reference so the CSV remains useful for
                # finding and fixing a missing or ambiguous audio file.
                audio_file_name = entry.audio_reference
            writer.writerow(
                {
                    "configuration_file": show_names[entry.show_path],
                    "audio_file_name": audio_file_name,
                    "segment_identifier": entry.segment_id,
                    "start_time": format_time_value(entry.start_time),
                    "stop_time": format_time_value(entry.stop_time),
                    "segment_length_seconds": format_seconds(segment_lengths[index]),
                }
            )


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        description=(
            "Cross-reference MP3 files with ShowBuilder JavaScript SONGS arrays "
            "and calculate segment durations."
        )
    )
    parser.add_argument(
        "show_files",
        nargs="+",
        metavar="SHOW_FILE",
        help=(
            "JavaScript show file, directory, or glob pattern. Directories are "
            "searched recursively for *.js files."
        ),
    )
    parser.add_argument(
        "--audio-dir",
        required=True,
        type=Path,
        help="Directory searched recursively for MP3 files.",
    )
    parser.add_argument(
        "--output-dir",
        type=Path,
        default=Path.cwd(),
        help="Directory for the two CSV files (default: current directory).",
    )
    parser.add_argument(
        "--audio-usage-name",
        default="audio_file_usage.csv",
        help="Filename for the audio-to-show CSV.",
    )
    parser.add_argument(
        "--show-segments-name",
        default="show_audio_segments.csv",
        help="Filename for the show-to-audio-segments CSV.",
    )
    parser.add_argument(
        "--ffprobe",
        default="ffprobe",
        help="ffprobe executable or path (default: ffprobe).",
    )
    parser.add_argument(
        "--strict",
        action="store_true",
        help="Return a nonzero status if any warnings are produced.",
    )
    return parser


def main(argv: Sequence[str] | None = None) -> int:
    parser = build_parser()
    args = parser.parse_args(argv)

    try:
        show_paths = expand_show_paths(args.show_files)
        audio_dir = args.audio_dir.expanduser().resolve()
        if not audio_dir.is_dir():
            raise CatalogError(f"audio directory does not exist: {audio_dir}")
        audio_files = discover_audio_files(audio_dir)
        if not audio_files:
            raise CatalogError(f"no MP3 files found under: {audio_dir}")

        ffprobe = shutil.which(args.ffprobe)
        if ffprobe is None:
            explicit = Path(args.ffprobe).expanduser()
            if explicit.is_file():
                ffprobe = str(explicit.resolve())
            else:
                raise CatalogError(
                    "ffprobe was not found; install FFmpeg or pass --ffprobe PATH"
                )

        entries: list[ShowEntry] = []
        warnings: list[str] = []
        for show_path in show_paths:
            parsed, parse_warnings = parse_show_file(show_path)
            entries.extend(parsed)
            warnings.extend(parse_warnings)
        warnings.extend(resolve_audio_references(entries, audio_dir, audio_files))

        show_names = shortest_unique_show_names(show_paths)
        segment_lengths, duration_warnings = calculate_segment_lengths(entries, ffprobe)
        warnings.extend(duration_warnings)

        output_dir = args.output_dir.expanduser().resolve()
        output_dir.mkdir(parents=True, exist_ok=True)
        audio_usage_path = output_dir / args.audio_usage_name
        show_segments_path = output_dir / args.show_segments_name
        write_audio_usage_csv(
            audio_usage_path, audio_dir, audio_files, entries, show_names
        )
        write_show_segments_csv(
            show_segments_path, audio_dir, entries, segment_lengths, show_names
        )

        print(f"Wrote {audio_usage_path} ({len(audio_files)} audio files)")
        print(f"Wrote {show_segments_path} ({len(entries)} show segments)")
        if warnings:
            print(f"\nWarnings ({len(warnings)}):", file=sys.stderr)
            for warning in warnings:
                print(f"- {warning}", file=sys.stderr)
        return 2 if args.strict and warnings else 0
    except (CatalogError, OSError) as exc:
        parser.exit(1, f"error: {exc}\n")


if __name__ == "__main__":
    raise SystemExit(main())
