# Project rules

1. Use plain HTML, CSS, and JavaScript modules. Do not add a framework, package dependency, backend, or remote asset for this assignment.
2. Keep JavaScript out of the HTML contract commit. Every later milestone is a focused change with a useful commit message.
3. Keep pad identity, key binding, and sample path in HTML `data-pad-id`, `data-key`, and `data-sound` attributes. Do not duplicate the key map in JavaScript.
4. Keep the audio engine independent from DOM and input code. Every hit gets its own audio instance so polyphony includes repeated hits on one pad.
5. Send keyboard and pointer activation through one callback. Use `keydown`/`event.key`; ignore repeats, modifier shortcuts, and editable controls.
6. Keep recorder events immutable to callers and in FIFO order. Store the pad ID with a monotonic offset in milliseconds.
7. Keep replay cancellable. Stop must cancel timers and audio, and stale scheduled work must not run.
8. Use semantic controls, visible keyboard focus, accessible names, and restrained live-region announcements. Never use inline event-handler attributes.
9. Generate samples reproducibly with the checked-in script; do not require a separate audio tool or third-party package.
10. Record actual checks and known browser timing limits in the README. Do not claim checks that were not run.
