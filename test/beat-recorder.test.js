import assert from "node:assert/strict";
import test from "node:test";

import { createBeatRecorder } from "../src/beat-recorder.js";

function fakeClock(startAt = 500) {
  let current = startAt;
  return {
    now: () => current,
    set: (next) => { current = next; },
    advance: (milliseconds) => { current += milliseconds; },
  };
}

test("records pad IDs as FIFO events with offsets from the start time", () => {
  const time = fakeClock(1_200);
  const recorder = createBeatRecorder({ clock: time.now });

  assert.equal(recorder.start(), true);
  assert.deepEqual(recorder.record("kick"), { padId: "kick", offsetMs: 0 });
  time.advance(125.5);
  recorder.record("snare");
  recorder.record("crash");
  time.advance(400);
  recorder.record("closed-hat");
  recorder.stop();

  assert.deepEqual(recorder.getEvents(), [
    { padId: "kick", offsetMs: 0 },
    { padId: "snare", offsetMs: 125.5 },
    { padId: "crash", offsetMs: 125.5 },
    { padId: "closed-hat", offsetMs: 525.5 },
  ]);
});

test("does not record before start or after stop, and keeps a stopped take", () => {
  const time = fakeClock();
  const recorder = createBeatRecorder({ clock: time.now });

  assert.equal(recorder.record("kick"), null);
  recorder.start();
  recorder.record("kick");
  const stopped = recorder.stop();
  time.advance(100);

  assert.deepEqual(stopped, [{ padId: "kick", offsetMs: 0 }]);
  assert.equal(recorder.record("snare"), null);
  assert.deepEqual(recorder.getEvents(), stopped);
});

test("starting a new take replaces the previous take, including with an empty take", () => {
  const time = fakeClock();
  const recorder = createBeatRecorder({ clock: time.now });

  recorder.start();
  recorder.record("kick");
  recorder.stop();
  time.advance(80);
  recorder.start();
  recorder.stop();

  assert.equal(recorder.length, 0);
  assert.deepEqual(recorder.getEvents(), []);
});

test("prevents callers from mutating its FIFO queue", () => {
  const time = fakeClock();
  const recorder = createBeatRecorder({ clock: time.now });
  recorder.start();
  recorder.record("kick");
  recorder.stop();

  const firstRead = recorder.getEvents();
  firstRead.push({ padId: "extra", offsetMs: 999 });
  assert.throws(() => { firstRead[0].padId = "changed"; }, TypeError);
  assert.deepEqual(recorder.getEvents(), [{ padId: "kick", offsetMs: 0 }]);
});

test("keeps offsets non-decreasing if the supplied clock moves backwards", () => {
  const time = fakeClock(100);
  const recorder = createBeatRecorder({ clock: time.now });
  recorder.start();
  time.set(140);
  recorder.record("kick");
  time.set(130);
  recorder.record("snare");

  assert.deepEqual(recorder.getEvents(), [
    { padId: "kick", offsetMs: 40 },
    { padId: "snare", offsetMs: 40 },
  ]);
});

test("clear resets an idle take but cannot clear while recording", () => {
  const time = fakeClock();
  const recorder = createBeatRecorder({ clock: time.now });
  recorder.start();
  recorder.record("kick");

  assert.equal(recorder.clear(), false);
  assert.equal(recorder.length, 1);
  recorder.stop();
  assert.equal(recorder.clear(), true);
  assert.equal(recorder.length, 0);
});
