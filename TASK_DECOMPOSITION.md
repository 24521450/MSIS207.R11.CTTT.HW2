# HW2: Drum Kit Engine

## Goal

Build a small, dependency-free drum kit with nine playable sounds, polyphonic audio, keyboard and pointer input, and a FIFO beat recorder that keeps each hit's offset from the recording start.

The architecture follows the HW2 requirements on pages 23–24 of the supplied Lab 1 document: commit the HTML `data-sound` contract before writing JavaScript, implement polyphonic playback independently, throttle held-key repeats, and record timestamped events in FIFO order. The live defense must be able to change a key binding in the HTML and explain the event path within three minutes.

**Implementation status: Complete.** T-01 through T-11 were committed as separate milestones. The HTML-only contract commit `d8fdc7a` precedes the first JavaScript commit `6f32014` in local history.

## Contracts

- Each pad is a semantic `button` with a stable `data-pad-id`, one-character `data-key`, and local `data-sound` path.
- HTML is the only source of keyboard bindings. The controller reads the attributes at startup and updates the displayed key label from `data-key`.
- The audio engine accepts a sound path, creates an independent audio instance for every hit, and can stop all active instances. It does not read the DOM, keyboard state, or recorder state.
- Input sends pointer clicks and keyboard hits through one activation callback. `keydown` uses `event.key`, ignores `event.repeat`, modifiers, and editable controls.
- Recorder events have the shape `{ padId, offsetMs }`. `offsetMs` is measured from the recording start with a monotonic clock; array order preserves FIFO order when offsets match.
- Playback schedules a snapshot of the recording by its stored offsets. It does not append replayed hits to the recording.
- The coordinator owns application state and connects input, audio, recording, playback, and status updates.
- No inline event handlers, external libraries, remote assets, or backend are used.

## Atomic milestones

| ID | Work | Acceptance | Commit |
| --- | --- | --- | --- |
| T-01 | Record this decomposition, project rules, and initial project overview. | Contracts and staged work are written down. | `docs(spec): define drum kit contracts and tasks` |
| T-02 | Create semantic HTML and all nine pad data attributes. | HTML is reviewed and committed before any JavaScript file is created. | `feat(html): define drum pad data contracts` |
| T-03 | Add CSS reset and design tokens. | Colors, spacing, type, focus, and motion tokens are centralized. | `feat(css): define drum kit design tokens` |
| T-04 | Build responsive controls and pad grid. | Layout fits a 375px viewport; focus and active states are visible. | `feat(css): implement responsive drum pad layout` |
| T-05 | Add reproducible, generated WAV samples. | Nine local samples and their standard-library generator are committed. | `feat(audio): add synthesized drum samples` |
| T-06 | Implement the independent audio engine. | Separate playback instances can overlap; `stopAll()` cancels active audio. | `feat(js): implement polyphonic audio engine` |
| T-07 | Implement keyboard and pointer input. | Click and `keydown` share one callback; repeats/modifiers/editable controls are ignored. | `feat(js): bind drum controls with repeat protection` |
| T-08 | Implement the timestamped FIFO recorder. | Events retain pad identity, monotonic offsets, and order for equal timestamps. | `feat(js): record timestamped beat events` |
| T-09 | Implement replay, cancellation, and clearing. | Replay honors offsets, can be cancelled, and never mutates the source recording. | `feat(js): implement beat replay and cancellation` |
| T-10 | Review integrated behavior and fix observed issues. | Keyboard remapping, errors, state transitions, accessibility, and narrow layout are checked. | `fix: resolve drum kit interaction issues` |
| T-11 | Finish usage and verification documentation. | README explains running, controls, architecture, checks, and defense walkthrough. | `docs: document drum kit usage and verification` |

## Behavior and state

- App modes are `idle`, `recording`, and `playing`.
- Starting a recording clears the previous take. Stopping a recording keeps its events.
- An empty take cannot be replayed. Replay is repeatable and uses the original offsets, including an initial silent gap.
- Manual pad activation is disabled during replay. Stopping replay cancels pending callbacks and active audio while preserving the take.
- Clearing is available while idle and resets the take and count.
- A short visual pad pulse follows a successful input. Status announcements cover state changes and errors, not every drum hit.
- Audio failures are reported without preventing other pads from working.

## Verification checklist

- [x] All nine pads have unique keys and local sample paths; input tests map each configured key to its stable pad ID, and browser smoke checks cover pointer and keyboard activation.
- [x] Holding a key does not create auto-repeat hits; modifiers and text entry do not trigger pads.
- [x] The same sample and different samples can overlap.
- [x] Changing one HTML `data-key` at controller startup changes both the key label and active binding.
- [x] Recording stores FIFO `{ padId, offsetMs }` events using a monotonic timestamp.
- [x] Replay preserves recorded offsets and ordering, including equal offsets and initial silence.
- [x] Stop cancels pending replay events and all active sounds; stale callbacks cannot restart audio.
- [x] Replay does not mutate or duplicate the recording; clear and empty-recording states are correct.
- [x] Rejected audio is reported through the accessible status region.
- [x] Tab, Enter, and Space can operate controls; focus is visible and the 375px layout has no horizontal overflow.
- [x] Recorder and replay scheduling are covered with a fake clock; the interface and representative sounds were checked in a browser.

The final automated run uses Node's built-in test runner and has 25 passing checks. The browser smoke check at 375px found no console errors. Samples are reproducible from the checked-in generator.

## Defense walkthrough

Change a pad's `data-key` in `index.html`, reload, and demonstrate that the label and keyboard mapping are both derived from that attribute. Trace `keydown` → input controller → common activation callback → recorder timestamp and audio engine. Show the recorder's `{ padId, offsetMs }` queue and explain how playback schedules a copy by offset.
