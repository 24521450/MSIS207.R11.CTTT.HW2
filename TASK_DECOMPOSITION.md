# HW2: Drum Kit Engine

## Goal

Build a small, dependency-free drum kit with nine playable sounds, polyphonic audio, keyboard and pointer input, and a FIFO beat recorder that keeps each hit's offset from the recording start.

The architecture follows the HW2 requirements on pages 23–24 of the supplied Lab 1 document: commit the HTML `data-sound` contract before writing JavaScript, implement polyphonic playback independently, throttle held-key repeats, and record timestamped events in FIFO order. The live defense must be able to change a key binding in the HTML and explain the event path within three minutes.

**Implementation status: Complete after regression verification.** T-01 through T-11 were committed as separate milestones. The HTML-only contract commit `d8fdc7a` precedes the first JavaScript commit `6f32014` in local history. The later regression fixes are `a129ecf` (native Enter/Space repeat) and `7adcf1e` (Stop during free play); documentation for those checks is recorded after the original milestones.

## Contracts

- Each pad is a semantic `button` with a stable `data-pad-id`, one-character `data-key`, and local `data-sound` path.
- HTML is the only source of keyboard bindings. The controller reads the attributes at startup and updates the displayed key label from `data-key`.
- The audio engine accepts a sound path, creates an independent audio instance for every hit, and can stop all active instances. It does not read the DOM, keyboard state, or recorder state.
- Input sends pointer clicks and keyboard hits through one activation callback. Mapped `keydown` uses `event.key`, ignores `event.repeat`, modifiers, and editable controls. On pad buttons only, the controller cancels native Enter/Space click behavior and routes Enter on keydown and Space on keyup through that callback once per press.
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
- Stop is available while recording, replaying, or while any audio instance is active during free play. When idle with no active audio it is unavailable: it uses native disabled when unfocused; if it already has focus, `aria-disabled` keeps it unavailable without dropping focus until blur, when native disabled is applied. Audio-count changes do not run focus-management logic.
- Clearing is available while idle and resets the take and count.
- A short visual pad pulse follows a successful input. Status announcements cover state changes and errors, not every drum hit.
- Audio failures are reported without preventing other pads from working.

## Issues found and fixes

1. **Holding Enter/Space on a pad could create repeated hits.** The keyboard controller ignored repeated mapped-key `keydown` events, but the focused native button could still synthesize click events. The controller now handles Enter/Space on each pad, prevents that native default there only, guards each press, activates Enter on keydown and Space on keyup, and leaves pointer/assistive-technology click activation on the shared callback. Regression commit: `a129ecf` (`fix(input): prevent repeated native keyboard pad activation`).
2. **Stop was disabled during free play.** The old control state depended only on the app mode, so an idle app could not stop a Crash or another ringing sample. Stop now also depends on audio engine `activeCount`; `onActiveChange` updates only that button and does not redirect focus. The idle Stop handler stops audio and clears pad pulses while preserving the saved take. A focused Stop becomes `aria-disabled` until blur so the native disabled state does not discard current keyboard focus; this focus-preservation follow-up is `a5a4fe4`. Initial fix commit: `7adcf1e` (`fix(playback): enable stopping audio during free play`).

## Verification checklist

- [x] Nine default keys play their matching local WAV files; case-insensitive remapping from A to Q updates the visible and accessible label after reload, and A stops mapping.
- [x] Native browser keyboard repeats for A, Enter, and Space create one hit per press. Release/repress creates a new hit; one mouse click creates one hit. Ctrl/Alt, editable input, and an unmapped key create no sound.
- [x] Native `HTMLAudioElement` instances overlap for two hits on the same sample and for different samples.
- [x] A recording with an initial gap and different intervals replays in FIFO order at its stored offsets. Replaying twice leaves the take count unchanged.
- [x] Stopping replay cancels future hits. Stopping and immediately replaying produces only the new run's hits. Stopping while Crash is still ringing pauses the native element and resets its current time.
- [x] Idle/no-audio Stop is unavailable; it becomes available while recording, playing, or free-play audio is active. It stops free-play audio without changing the take, returns to disabled after natural audio completion, and audio failure does not leave the mode stuck. If Stop itself has focus at that transition, it retains focus as `aria-disabled` until blur, then uses native disabled.
- [x] Clear, empty recording, and a subsequent new take keep counts and disabled states correct.
- [x] Tab/Shift+Tab, visible focus, playback-disabled pads, and 375/768/1440px horizontal overflow were checked in the browser.
- [x] Ordinary browser flows have no console errors, page exceptions, or HTTP error responses. A deliberately blocked Kick request reports an error; Snare still plays.

### Test evidence and limits

- `npm test` ran Node's built-in runner on **2026-10-07**: **32 passed, 0 failed**. Node tests use `FakeAudio` for engine instance/error/count logic, fake timers for recorder/player scheduling and cancellation, and `FakeButton`/`FakeDocument` for input-controller logic. These mocks do not model a browser's native button default click; the Enter/Space checks below use a real browser.
- Browser checks ran on **Microsoft Edge 154.0.4258.53 (Chromium), 2026-10-07; final checks completed before 13:39 Asia/Saigon**, serving the app from `http://127.0.0.1:8000/`. Playwright sent keyboard down/up events to real HTML buttons; the repeat checks observed `event.repeat === true`. Audio instrumentation wrapped native `play()`/`pause()` only to observe instances and forwarded calls to the original methods.
- In one timing run, recording offsets were about **283/250/514 ms** and replay intervals about **292/251/507 ms**. These readings illustrate this browser run; they are not timing guarantees.
- No physical touch device or screen reader was available, so those two input paths remain unverified. The browser run checked native audio state and timing, not subjective sound quality through speakers/headphones. This pass did not rerun the WAV generator's two-run SHA-256 comparison.

`performance.now()` is monotonic, but `setTimeout`, the browser event loop, media buffering, and device load prevent sample-level timing accuracy.

## Defense walkthrough

Change a pad's `data-key` in `index.html`, reload, and demonstrate that the label and keyboard mapping are both derived from that attribute. Trace `keydown` → input controller → common activation callback → recorder timestamp and audio engine. Show the recorder's `{ padId, offsetMs }` queue and explain how playback schedules a copy by offset.
