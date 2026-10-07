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
