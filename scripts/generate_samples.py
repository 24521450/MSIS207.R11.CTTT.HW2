#!/usr/bin/env python3
"""Generate the local drum kit WAV files using only Python's standard library."""

from __future__ import annotations

import math
import random
import wave
from array import array
from pathlib import Path


SAMPLE_RATE = 22_050
OUTPUT_DIR = Path(__file__).resolve().parents[1] / "audio" / "samples"


def _noise(seed: int, count: int) -> list[float]:
    generator = random.Random(seed)
    return [generator.uniform(-1.0, 1.0) for _ in range(count)]


def _high_pass(source: list[float], amount: float = 0.92) -> list[float]:
    previous = 0.0
    result = []
    for sample in source:
        result.append(sample - amount * previous)
        previous = sample
    return result


def _tone_sweep(duration: float, start_hz: float, end_hz: float, decay: float, seed: int) -> list[float]:
    count = round(SAMPLE_RATE * duration)
    noise = _noise(seed, count)
    result = []
    sweep = 0.075
    for index in range(count):
        time = index / SAMPLE_RATE
        phase = 2 * math.pi * (end_hz * time + (start_hz - end_hz) * sweep * (1 - math.exp(-time / sweep)))
        envelope = math.exp(-decay * time)
        body = math.sin(phase) * envelope
        overtone = 0.16 * math.sin(phase * 2.01) * envelope
        transient = 0.12 * noise[index] * math.exp(-95 * time)
        result.append(body + overtone + transient)
    return result


def _kick() -> list[float]:
    count = round(SAMPLE_RATE * 0.62)
    result = []
    for index in range(count):
        time = index / SAMPLE_RATE
        frequency = 45 + 118 * math.exp(-time / 0.035)
        phase = 2 * math.pi * (45 * time + 118 * 0.035 * (1 - math.exp(-time / 0.035)))
        body = math.sin(phase) * math.exp(-7.4 * time)
        sub = 0.24 * math.sin(2 * math.pi * 42 * time) * math.exp(-5.7 * time)
        click = 0.18 * math.sin(2 * math.pi * (1_100 + frequency * 2) * time) * math.exp(-88 * time)
        result.append(body + sub + click)
    return result


def _snare() -> list[float]:
    duration = 0.38
    count = round(SAMPLE_RATE * duration)
    noise = _high_pass(_noise(202, count), 0.67)
    result = []
    for index in range(count):
        time = index / SAMPLE_RATE
        wire = 0.74 * noise[index] * math.exp(-13.5 * time)
        body = 0.42 * math.sin(2 * math.pi * 185 * time) * math.exp(-8.2 * time)
        snap = 0.18 * noise[index] * math.exp(-75 * time)
        result.append(wire + body + snap)
    return result


def _hat(duration: float, seed: int, decay: float, ring_level: float) -> list[float]:
    count = round(SAMPLE_RATE * duration)
    raw = _noise(seed, count)
    noise = _high_pass(raw, 0.95)
    result = []
    for index in range(count):
        time = index / SAMPLE_RATE
        metallic = (
            math.sin(2 * math.pi * 5_620 * time)
            + 0.6 * math.sin(2 * math.pi * 7_410 * time)
            + 0.3 * math.sin(2 * math.pi * 9_180 * time)
        )
        envelope = math.exp(-decay * time)
        result.append((0.84 * noise[index] + ring_level * metallic) * envelope)
    return result


def _clap() -> list[float]:
    duration = 0.34
    count = round(SAMPLE_RATE * duration)
    noise = _high_pass(_noise(405, count), 0.7)
    result = []
    for index in range(count):
        time = index / SAMPLE_RATE
        bursts = sum(math.exp(-((time - pulse) / 0.0065) ** 2) for pulse in (0.0, 0.018, 0.039))
        tail = 0.22 * math.exp(-11 * max(0.0, time - 0.055)) if time >= 0.055 else 0.0
        result.append(noise[index] * (0.68 * bursts + tail))
    return result


def _crash() -> list[float]:
    duration = 1.35
    count = round(SAMPLE_RATE * duration)
    noise = _high_pass(_noise(909, count), 0.96)
    partials = (3_080, 4_670, 6_220, 7_940, 9_750)
    weights = (0.18, 0.13, 0.11, 0.09, 0.065)
    result = []
    for index in range(count):
        time = index / SAMPLE_RATE
        envelope = math.exp(-3.35 * time)
        shimmer = sum(weight * math.sin(2 * math.pi * hz * time) for hz, weight in zip(partials, weights))
        result.append((0.58 * noise[index] + shimmer) * envelope)
    return result


def _write_wav(path: Path, samples: list[float]) -> None:
    peak = max(max(abs(value) for value in samples), 1e-9)
    gain = 0.88 / peak
    pcm = array("h", (round(max(-1.0, min(1.0, sample * gain)) * 32_767) for sample in samples))
    if pcm.itemsize != 2:
        raise RuntimeError("This Python build does not provide 16-bit signed shorts.")
    if array("h").itemsize == 2 and __import__("sys").byteorder != "little":
        pcm.byteswap()
    with wave.open(str(path), "wb") as output:
        output.setnchannels(1)
        output.setsampwidth(2)
        output.setframerate(SAMPLE_RATE)
        output.writeframes(pcm.tobytes())


def main() -> None:
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    sounds = {
        "kick.wav": _kick,
        "snare.wav": _snare,
        "closed-hat.wav": lambda: _hat(0.16, 303, 34.0, 0.045),
        "open-hat.wav": lambda: _hat(0.82, 304, 5.2, 0.075),
        "clap.wav": _clap,
        "low-tom.wav": lambda: _tone_sweep(0.52, 148, 72, 6.7, 606),
        "mid-tom.wav": lambda: _tone_sweep(0.46, 205, 105, 7.2, 707),
        "high-tom.wav": lambda: _tone_sweep(0.4, 278, 146, 7.8, 808),
        "crash.wav": _crash,
    }
    for filename, render in sounds.items():
        destination = OUTPUT_DIR / filename
        _write_wav(destination, render())
        print(f"Generated {destination.relative_to(OUTPUT_DIR.parents[1])}")


if __name__ == "__main__":
    main()
