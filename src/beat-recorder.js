function browserClock() {
  return globalThis.performance?.now?.() ?? Date.now();
}

/** Record an immutable FIFO queue of pad identities and offsets in milliseconds. */
export function createBeatRecorder({ clock = browserClock } = {}) {
  let events = [];
  let recording = false;
  let startedAt = null;
  let lastOffsetMs = 0;

  function readEvents() {
    return events.map(({ padId, offsetMs }) => Object.freeze({ padId, offsetMs }));
  }

  function start() {
    if (recording) return false;
    events = [];
    startedAt = clock();
    if (!Number.isFinite(startedAt)) throw new Error("Recorder clock must return a finite timestamp.");
    lastOffsetMs = 0;
    recording = true;
    return true;
  }

  function stop() {
    if (!recording) return false;
    recording = false;
    startedAt = null;
    return readEvents();
  }

  function record(padId) {
    if (!recording || typeof padId !== "string" || padId.trim() === "") return null;
    const currentTime = clock();
    if (!Number.isFinite(currentTime)) throw new Error("Recorder clock must return a finite timestamp.");
    const measuredOffset = Math.max(0, currentTime - startedAt);
    lastOffsetMs = Math.max(lastOffsetMs, measuredOffset);
    const event = Object.freeze({ padId, offsetMs: lastOffsetMs });
    events.push(event);
    return Object.freeze({ ...event });
  }

  function clear() {
    if (recording) return false;
    events = [];
    lastOffsetMs = 0;
    return true;
  }

  return {
    start,
    stop,
    record,
    clear,
    getEvents: readEvents,
    get state() {
      return recording ? "recording" : "idle";
    },
    get isRecording() {
      return recording;
    },
    get length() {
      return events.length;
    },
  };
}
