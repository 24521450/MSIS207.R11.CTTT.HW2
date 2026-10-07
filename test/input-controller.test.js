import assert from "node:assert/strict";
import test from "node:test";

import { createInputController } from "../src/input-controller.js";

class FakeButton {
  constructor({ id = "kick", key = "a", sound = "audio/kick.wav", name = "Kick", disabled = false } = {}) {
    this.dataset = { padId: id, key, sound };
    this.disabled = disabled;
    this.name = { textContent: name };
    this.keyLabel = { textContent: key.toUpperCase() };
    this.attributes = {};
    this.listeners = new Map();
  }

  querySelector(selector) {
    return selector === ".pad__name" ? this.name : this.keyLabel;
  }

  setAttribute(name, value) {
    this.attributes[name] = value;
  }

  contains(target) {
    return target === this;
  }

  addEventListener(type, listener) {
    const listeners = this.listeners.get(type) ?? new Set();
    listeners.add(listener);
    this.listeners.set(type, listeners);
  }

  removeEventListener(type, listener) {
    this.listeners.get(type)?.delete(listener);
  }

  emit(type, event = {}) {
    for (const listener of [...(this.listeners.get(type) ?? [])]) listener(event);
  }
}

function keyEvent(key, options = {}) {
  let prevented = false;
  const event = {
    key,
    repeat: false,
    target: null,
    ...options,
    preventDefault() {
      prevented = true;
    },
  };
  Object.defineProperty(event, "defaultPrevented", { get: () => prevented });
  return event;
}

function sendPadKeyDown(document, button, key, options = {}) {
  const event = keyEvent(key, { target: button, ...options });
  button.emit("keydown", event);
  document.emit("keydown", event);
  return event;
}

function sendKeyUp(document, key, target, options = {}) {
  const event = keyEvent(key, { target, ...options });
  document.emit("keyup", event);
  return event;
}

class FakeDocument {
  constructor(buttons) {
    this.buttons = buttons;
    this.listeners = new Map();
  }

  querySelectorAll() {
    return this.buttons;
  }

  addEventListener(type, listener) {
    const listeners = this.listeners.get(type) ?? new Set();
    listeners.add(listener);
    this.listeners.set(type, listeners);
  }

  removeEventListener(type, listener) {
    this.listeners.get(type)?.delete(listener);
  }

  emit(type, event = {}) {
    for (const listener of [...(this.listeners.get(type) ?? [])]) listener(event);
  }
}

function setup(buttons = [new FakeButton()]) {
  const document = new FakeDocument(buttons);
  const activations = [];
  const configErrors = [];
  const controller = createInputController({
    document,
    onActivate: (activation) => activations.push(activation),
    onConfigError: (errors) => configErrors.push(...errors),
  });
  return { document, buttons, activations, configErrors, controller };
}

test("reads a changed data-key and refreshes its visible and accessible label", () => {
  const button = new FakeButton({ key: "q" });
  const { document, activations, controller } = setup([button]);

  assert.equal(button.keyLabel.textContent, "Q");
  assert.equal(button.attributes["aria-label"], "Kick, phím Q");
  document.emit("keydown", { key: "a" });
  document.emit("keydown", { key: "Q" });

  assert.equal(activations.length, 1);
  assert.equal(activations[0].padId, "kick");
  assert.equal(activations[0].inputMethod, "keyboard");
  controller.destroy();
});

test("routes button activation through the same callback as keyboard input", () => {
  const { buttons, document, activations } = setup();

  buttons[0].emit("click");
  document.emit("keydown", { key: "A" });

  assert.deepEqual(activations.map(({ padId }) => padId), ["kick", "kick"]);
  assert.deepEqual(activations.map(({ inputMethod }) => inputMethod), ["button", "keyboard"]);
});

test("maps every default pad key to its matching stable pad ID", () => {
  const bindings = [
    ["kick", "a"], ["snare", "s"], ["closed-hat", "d"],
    ["open-hat", "f"], ["clap", "g"], ["low-tom", "h"],
    ["mid-tom", "j"], ["high-tom", "k"], ["crash", "l"],
  ];
  const buttons = bindings.map(([id, key]) => new FakeButton({ id, key, sound: `audio/${id}.wav` }));
  const { document, activations } = setup(buttons);

  for (const [padId, key] of bindings) document.emit("keydown", { key: key.toUpperCase() });

  assert.deepEqual(activations.map(({ padId }) => padId), bindings.map(([padId]) => padId));
  assert.ok(activations.every(({ inputMethod }) => inputMethod === "keyboard"));
});

test("ignores repeats, modifiers, composition, and editable controls", () => {
  const { document, activations } = setup();
  const base = { key: "a", repeat: false };

  document.emit("keydown", { ...base, repeat: true });
  document.emit("keydown", { ...base, ctrlKey: true });
  document.emit("keydown", { ...base, altKey: true });
  document.emit("keydown", { ...base, metaKey: true });
  document.emit("keydown", { ...base, isComposing: true });
  document.emit("keydown", { ...base, target: { tagName: "INPUT" } });
  document.emit("keydown", { ...base, target: { isContentEditable: true } });

  assert.equal(activations.length, 0);
});

test("a mapped key creates one hit when its held-key repeats arrive", () => {
  const { document, activations } = setup();

  document.emit("keydown", { key: "A", repeat: false });
  document.emit("keydown", { key: "A", repeat: true });
  document.emit("keydown", { key: "A", repeat: true });

  assert.equal(activations.length, 1);
  assert.equal(activations[0].padId, "kick");
});

test("Enter activates a focused pad once and cancels its native click", () => {
  const { document, buttons: [button], activations } = setup();

  assert.equal(sendPadKeyDown(document, button, "Enter").defaultPrevented, true);
  sendPadKeyDown(document, button, "Enter", { repeat: true });
  sendPadKeyDown(document, button, "Enter", { repeat: true });
  sendKeyUp(document, "Enter", button);

  assert.equal(activations.length, 1);
  assert.equal(activations[0].inputMethod, "keyboard");
});

test("Space activates a focused pad once on release and cancels its native click", () => {
  const { document, buttons: [button], activations } = setup();

  assert.equal(sendPadKeyDown(document, button, " ").defaultPrevented, true);
  sendPadKeyDown(document, button, " ", { repeat: true });
  sendPadKeyDown(document, button, " ", { repeat: true });
  assert.equal(activations.length, 0);

  assert.equal(sendKeyUp(document, " ", button).defaultPrevented, true);
  assert.equal(activations.length, 1);
  assert.equal(activations[0].inputMethod, "keyboard");
});

test("releasing and pressing Enter or Space again creates a new hit", () => {
  const { document, buttons: [button], activations } = setup();

  for (let index = 0; index < 2; index += 1) {
    sendPadKeyDown(document, button, "Enter");
    sendKeyUp(document, "Enter", button);
  }
  for (let index = 0; index < 2; index += 1) {
    sendPadKeyDown(document, button, " ");
    sendKeyUp(document, " ", button);
  }

  assert.equal(activations.length, 4);
});

test("one pointer click creates one activation", () => {
  const { buttons: [button], activations } = setup();

  button.emit("click");

  assert.equal(activations.length, 1);
  assert.equal(activations[0].inputMethod, "button");
});

test("recording receives one event while Enter is held", async () => {
  const { createBeatRecorder } = await import("../src/beat-recorder.js");
  const recorder = createBeatRecorder({ clock: () => 10 });
  const button = new FakeButton();
  const document = new FakeDocument([button]);
  const controller = createInputController({
    document,
    onActivate: ({ padId }) => recorder.record(padId),
  });
  recorder.start();

  sendPadKeyDown(document, button, "Enter");
  sendPadKeyDown(document, button, "Enter", { repeat: true });
  sendPadKeyDown(document, button, "Enter", { repeat: true });
  sendKeyUp(document, "Enter", button);

  assert.deepEqual(recorder.getEvents(), [{ padId: "kick", offsetMs: 0 }]);
  controller.destroy();
});

test("rejects ambiguous duplicate key bindings", () => {
  const buttons = [new FakeButton({ id: "kick", key: "a" }), new FakeButton({ id: "snare", key: "A" })];
  const { document, activations, configErrors } = setup(buttons);

  document.emit("keydown", { key: "a" });

  assert.equal(activations.length, 0);
  assert.equal(configErrors.length, 1);
  assert.match(configErrors[0], /Phím A đang được gán cho nhiều pad/);
});

test("setEnabled prevents both keyboard and button input", () => {
  const { buttons, document, activations, controller } = setup();

  controller.setEnabled(false);
  buttons[0].emit("click");
  document.emit("keydown", { key: "a" });
  assert.equal(buttons[0].disabled, true);
  assert.equal(activations.length, 0);

  controller.setEnabled(true);
  buttons[0].emit("click");
  assert.equal(buttons[0].disabled, false);
  assert.equal(activations.length, 1);
});
