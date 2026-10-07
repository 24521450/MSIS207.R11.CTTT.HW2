import assert from "node:assert/strict";
import test from "node:test";

import { createBeatPlayer } from "../src/beat-player.js";

function fakeTimers() {
  let now = 0;
  let nextId = 1;
  const timers = new Map();
  return {
    now: () => now,
    setTimeout(callback, delay) {
      const id = nextId++;
      timers.set(id, { id, at: now + Math.max(0, delay), callback });
      return id;
    },
    clearTimeout(id) {
      timers.delete(id);
    },
    advanceTo(target) {
      while (true) {
        const next = [...timers.values()]
          .filter((timer) => timer.at <= target)
          .sort((left, right) => left.at - right.at || left.id - right.id)[0];
        if (!next) break;
        timers.delete(next.id);
        now = next.at;
        next.callback();
      }
      now = target;
    },
    get pendingCount() {
      return timers.size;
    },
  };
}

function createHarness({ whenIdle = () => Promise.resolve() } = {}) {
  const time = fakeTimers();
  const hits = [];
  let stopCount = 0;
  const player = createBeatPlayer({
    onHit: (padId, event) => hits.push({ padId, offsetMs: event.offsetMs, actualAt: time.now() }),
    whenIdle,
    stopAll: () => { stopCount += 1; },
    clock: time.now,
    scheduleTimer: time.setTimeout,
    clearScheduledTimer: time.clearTimeout,
  });
  return { player, time, hits, get stopCount() { return stopCount; } };
}

test("replays FIFO order at timestamp offsets, including equal timestamps", async () => {
  const { player, time, hits } = createHarness();
  const take = [
    { padId: "kick", offsetMs: 100 },
    { padId: "snare", offsetMs: 250 },
    { padId: "crash", offsetMs: 250 },
  ];
  const original = structuredClone(take);
  const playback = player.play(take);

  assert.deepEqual(hits, []);
  time.advanceTo(99);
  assert.deepEqual(hits, []);
  time.advanceTo(100);
  assert.deepEqual(hits.map(({ padId }) => padId), ["kick"]);
  time.advanceTo(249);
  assert.deepEqual(hits.map(({ padId }) => padId), ["kick"]);
  time.advanceTo(250);
  assert.deepEqual(hits.map(({ padId }) => padId), ["kick", "snare", "crash"]);

  assert.deepEqual(await playback.done, { status: "completed" });
  assert.deepEqual(take, original);
  assert.deepEqual(hits.map(({ actualAt }) => actualAt), [100, 250, 250]);
  assert.equal(player.isPlaying, false);
});

test("preserves the initial silent gap before the first event", () => {
  const { player, time, hits } = createHarness();
  player.play([{ padId: "snare", offsetMs: 375 }]);

  time.advanceTo(374);
  assert.equal(hits.length, 0);
  time.advanceTo(375);
  assert.equal(hits[0].actualAt, 375);
});

test("cancel removes pending beats and stops currently playing audio", async () => {
  const harness = createHarness();
  const { player, time, hits } = harness;
  const playback = player.play([
    { padId: "kick", offsetMs: 0 },
    { padId: "snare", offsetMs: 100 },
  ]);
  time.advanceTo(1);
  assert.deepEqual(hits.map(({ padId }) => padId), ["kick"]);

  assert.equal(playback.cancel(), true);
  assert.deepEqual(await playback.done, { status: "cancelled" });
  assert.equal(player.isPlaying, false);
  assert.equal(harness.stopCount, 1);
  time.advanceTo(500);
  assert.deepEqual(hits.map(({ padId }) => padId), ["kick"]);
});

test("cancellation also wins while waiting for the final sound to finish", async () => {
  let resolveAudioIdle;
  const { player, time } = createHarness({ whenIdle: () => new Promise((resolve) => { resolveAudioIdle = resolve; }) });
  const playback = player.play([{ padId: "kick", offsetMs: 0 }]);
  time.advanceTo(1);
  await Promise.resolve();
  assert.equal(typeof resolveAudioIdle, "function");

  playback.cancel();
  resolveAudioIdle();
  assert.deepEqual(await playback.done, { status: "cancelled" });
  assert.equal(player.isPlaying, false);
});

test("empty takes do not schedule playback", () => {
  const { player, time, hits } = createHarness();

  assert.equal(player.play([]), null);
  assert.equal(time.pendingCount, 0);
  assert.deepEqual(hits, []);
});

test("rejects non-FIFO or invalid offsets instead of silently reordering them", () => {
  const { player } = createHarness();

  assert.throws(() => player.play([
    { padId: "snare", offsetMs: 20 },
    { padId: "kick", offsetMs: 10 },
  ]), /out-of-order/);
  assert.throws(() => player.play([{ padId: "kick", offsetMs: -1 }]), /invalid/);
});
