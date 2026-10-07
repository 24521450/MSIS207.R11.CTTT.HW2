function browserClock() {
  return globalThis.performance?.now?.() ?? Date.now();
}

function copyAndValidate(events) {
  if (!Array.isArray(events)) throw new TypeError("A beat recording must be an array.");
  let previousOffset = 0;
  return events.map((event, index) => {
    if (!event || typeof event.padId !== "string" || event.padId.trim() === "") {
      throw new TypeError(`Beat event ${index} has no padId.`);
    }
    if (!Number.isFinite(event.offsetMs) || event.offsetMs < 0 || event.offsetMs < previousOffset) {
      throw new TypeError(`Beat event ${index} has an invalid or out-of-order offsetMs.`);
    }
    previousOffset = event.offsetMs;
    return Object.freeze({ padId: event.padId, offsetMs: event.offsetMs });
  });
}

/** Schedule a FIFO recording by its original offsets and make each run cancellable. */
export function createBeatPlayer({
  onHit = () => {},
  whenIdle = () => Promise.resolve(),
  stopAll = () => {},
  clock = browserClock,
  scheduleTimer = globalThis.setTimeout.bind(globalThis),
  clearScheduledTimer = globalThis.clearTimeout.bind(globalThis),
} = {}) {
  let activeRun = null;

  function clearTimer(run) {
    if (run.timer === null) return;
    clearScheduledTimer(run.timer);
    run.timer = null;
  }

  function settle(run, result) {
    if (run.settled) return;
    run.settled = true;
    if (activeRun === run) activeRun = null;
    run.resolve(result);
  }

  function cancelRun(run) {
    if (activeRun !== run) return false;
    clearTimer(run);
    activeRun = null;
    try {
      stopAll();
    } catch {
      // Timer cancellation must still settle even if a media element fails to stop.
    }
    settle(run, { status: "cancelled" });
    return true;
  }

  function failRun(run, error) {
    if (activeRun !== run) return;
    clearTimer(run);
    activeRun = null;
    try {
      stopAll();
    } catch {
      // Preserve the playback error as the completion result.
    }
    settle(run, { status: "error", error });
  }

  function finishWhenAudioIsIdle(run) {
    Promise.resolve()
      .then(() => whenIdle())
      .then(
        () => {
          if (activeRun === run) settle(run, { status: "completed" });
        },
        (error) => failRun(run, error),
      );
  }

  function scheduleNext(run) {
    if (activeRun !== run) return;
    if (run.index >= run.events.length) {
      finishWhenAudioIsIdle(run);
      return;
    }

    const targetTime = run.startedAt + run.events[run.index].offsetMs;
    const remaining = targetTime - clock();
    run.timer = scheduleTimer(() => {
      run.timer = null;
      fireDueEvents(run);
    }, Math.max(1, remaining));
  }

  function fireDueEvents(run) {
    if (activeRun !== run) return;
    const now = clock();
    while (run.index < run.events.length) {
      const event = run.events[run.index];
      if (run.startedAt + event.offsetMs > now) break;
      run.index += 1;
      try {
        onHit(event.padId, event);
      } catch (error) {
        failRun(run, error);
        return;
      }
    }
    scheduleNext(run);
  }

  function play(events) {
    const snapshot = copyAndValidate(events);
    if (snapshot.length === 0) return null;
    if (activeRun) cancelRun(activeRun);

    const startedAt = clock();
    if (!Number.isFinite(startedAt)) throw new Error("Beat player clock must return a finite timestamp.");

    let resolve;
    const done = new Promise((complete) => { resolve = complete; });
    const run = {
      events: snapshot,
      index: 0,
      startedAt,
      timer: null,
      settled: false,
      resolve,
    };
    activeRun = run;
    scheduleNext(run);

    return {
      done,
      cancel: () => cancelRun(run),
      startedAt,
    };
  }

  return {
    play,
    cancel() {
      return activeRun ? cancelRun(activeRun) : false;
    },
    get isPlaying() {
      return activeRun !== null;
    },
  };
}
