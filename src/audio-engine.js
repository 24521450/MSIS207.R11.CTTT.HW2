export class AudioPlaybackError extends Error {
  constructor(source, cause) {
    super(`Could not play audio sample: ${source}`, { cause });
    this.name = "AudioPlaybackError";
    this.source = source;
  }
}

/**
 * Create an audio engine that gives each hit its own HTMLAudioElement.
 * This module intentionally has no DOM, keyboard, or recorder dependency.
 */
export function createAudioEngine({
  AudioConstructor = globalThis.Audio,
  onError = () => {},
  onActiveChange = () => {},
} = {}) {
  if (typeof AudioConstructor !== "function") {
    throw new Error("This browser does not provide HTML audio playback.");
  }

  const activeInstances = new Set();
  const idleWaiters = new Set();

  function notifyActiveChange() {
    try {
      onActiveChange(activeInstances.size);
    } catch {
      // UI callbacks must not prevent audio cleanup.
    }
  }

  function reportError(source, cause) {
    const error = new AudioPlaybackError(source, cause);
    try {
      onError(error);
    } catch {
      // An error reporter must not leave a rejected audio instance tracked.
    }
  }

  function resolveIdleWaiters() {
    if (activeInstances.size !== 0) return;
    for (const resolve of idleWaiters) resolve();
    idleWaiters.clear();
  }

  function release(entry) {
    if (!entry.active) return;
    entry.active = false;
    entry.audio.removeEventListener?.("ended", entry.onEnded);
    entry.audio.removeEventListener?.("error", entry.onError);
    activeInstances.delete(entry);
    notifyActiveChange();
    resolveIdleWaiters();
  }

  function fail(entry, cause) {
    if (!entry.active) return;
    release(entry);
    reportError(entry.source, cause);
  }

  function play(source) {
    if (typeof source !== "string" || source.trim() === "") {
      const cause = new TypeError("A non-empty audio source is required.");
      reportError(String(source), cause);
      return Promise.resolve(false);
    }

    let audio;
    try {
      audio = new AudioConstructor(source);
    } catch (cause) {
      reportError(source, cause);
      return Promise.resolve(false);
    }

    const entry = {
      active: true,
      audio,
      source,
      onEnded: () => release(entry),
      onError: (event) => fail(entry, audio.error || event),
    };

    activeInstances.add(entry);
    audio.preload = "auto";
    audio.addEventListener?.("ended", entry.onEnded, { once: true });
    audio.addEventListener?.("error", entry.onError, { once: true });
    notifyActiveChange();

    try {
      return Promise.resolve(audio.play()).then(
        () => entry.active,
        (cause) => {
          fail(entry, cause);
          return false;
        },
      );
    } catch (cause) {
      fail(entry, cause);
      return Promise.resolve(false);
    }
  }

  function stopAll() {
    for (const entry of [...activeInstances]) {
      try {
        entry.audio.pause();
      } catch {
        // Continue stopping the remaining instances.
      }
      try {
        entry.audio.currentTime = 0;
      } catch {
        // A not-yet-loaded media element may reject seeking.
      }
      release(entry);
    }
  }

  function whenIdle() {
    if (activeInstances.size === 0) return Promise.resolve();
    return new Promise((resolve) => idleWaiters.add(resolve));
  }

  return {
    play,
    stopAll,
    whenIdle,
    get activeCount() {
      return activeInstances.size;
    },
  };
}
