import assert from "node:assert/strict";
import test from "node:test";

import { createAudioEngine } from "../src/audio-engine.js";

class FakeAudio {
  static instances = [];

  constructor(source) {
    this.source = source;
    this.listeners = new Map();
    this.currentTime = 0;
    this.paused = false;
    FakeAudio.instances.push(this);
  }

  addEventListener(type, listener) {
    const listeners = this.listeners.get(type) ?? new Set();
    listeners.add(listener);
    this.listeners.set(type, listeners);
  }

  removeEventListener(type, listener) {
    this.listeners.get(type)?.delete(listener);
  }

  play() {
    this.paused = false;
    return Promise.resolve();
  }

  pause() {
    this.paused = true;
  }

  emit(type, event = {}) {
    for (const listener of [...(this.listeners.get(type) ?? [])]) listener(event);
  }
}

function createHarness(AudioConstructor = FakeAudio) {
  FakeAudio.instances = [];
  const errors = [];
  const activeCounts = [];
  const engine = createAudioEngine({
    AudioConstructor,
    onError: (error) => errors.push(error),
    onActiveChange: (count) => activeCounts.push(count),
  });
  return { engine, errors, activeCounts };
}

test("creates a separate instance for every hit, including the same sample", async () => {
  const { engine, activeCounts } = createHarness();

  const first = engine.play("audio/samples/kick.wav");
  const second = engine.play("audio/samples/kick.wav");

  assert.equal(await first, true);
  assert.equal(await second, true);
  assert.equal(FakeAudio.instances.length, 2);
  assert.notEqual(FakeAudio.instances[0], FakeAudio.instances[1]);
  assert.equal(engine.activeCount, 2);
  assert.deepEqual(activeCounts, [1, 2]);
});

test("waits for all active instances to end", async () => {
  const { engine, activeCounts } = createHarness();
  await engine.play("audio/samples/snare.wav");
  await engine.play("audio/samples/crash.wav");
  let idle = false;
  const idlePromise = engine.whenIdle().then(() => { idle = true; });

  FakeAudio.instances[0].emit("ended");
  await Promise.resolve();
  assert.equal(idle, false);
  FakeAudio.instances[1].emit("ended");
  await idlePromise;

  assert.equal(idle, true);
  assert.equal(engine.activeCount, 0);
  assert.deepEqual(activeCounts, [1, 2, 1, 0]);
});

test("reports rejected playback and removes the failed instance", async () => {
  class BlockedAudio extends FakeAudio {
    play() {
      return Promise.reject(new DOMException("Playback blocked", "NotAllowedError"));
    }
  }
  const { engine, errors, activeCounts } = createHarness(BlockedAudio);

  assert.equal(await engine.play("audio/samples/kick.wav"), false);
  assert.equal(engine.activeCount, 0);
  assert.equal(errors.length, 1);
  assert.equal(errors[0].source, "audio/samples/kick.wav");
  assert.equal(errors[0].cause.name, "NotAllowedError");
  assert.deepEqual(activeCounts, [1, 0]);
});

test("stopAll pauses and releases every tracked sound", async () => {
  const { engine, activeCounts } = createHarness();
  await engine.play("audio/samples/kick.wav");
  await engine.play("audio/samples/snare.wav");
  const idlePromise = engine.whenIdle();

  engine.stopAll();
  await idlePromise;

  assert.equal(engine.activeCount, 0);
  assert.ok(FakeAudio.instances.every((audio) => audio.paused && audio.currentTime === 0));
  assert.deepEqual(activeCounts, [1, 2, 1, 0]);
});
