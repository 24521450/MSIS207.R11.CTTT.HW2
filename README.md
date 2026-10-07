# Drum Kit Engine — HW2

A contract-first, browser-only drum kit for the Web Application Development assignment. The finished app will provide nine sounds, overlapping playback, keyboard and pointer controls, and a timestamped FIFO beat recorder.

## Project status

Implementation is being delivered in atomic milestones. The required HTML data contract is committed before JavaScript. See [TASK_DECOMPOSITION.md](TASK_DECOMPOSITION.md) for the contracts, milestones, acceptance checklist, and live-defense walkthrough; see [project-rules.md](project-rules.md) for implementation constraints.

## Planned controls

The default pads use `A S D F G H J K L`. The actual binding and local sample path will be read from each pad's `data-key` and `data-sound` attributes in `index.html`.

## Audio samples

Nine short mono WAV samples are generated with Python's standard library. To recreate them from the checked-in synthesizer, run `python scripts/generate_samples.py` from the project directory.
