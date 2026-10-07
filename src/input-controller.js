const EDITABLE_TAGS = new Set(["input", "textarea", "select"]);

function isEditableTarget(target) {
  if (!target) return false;
  if (target.isContentEditable) return true;
  if (EDITABLE_TAGS.has(target.tagName?.toLowerCase())) return true;
  return Boolean(target.closest?.('[contenteditable]:not([contenteditable="false"])'));
}

function getButtonActivationKey(event) {
  if (event.key === "Enter") return "enter";
  if (event.key === " " || event.key === "Spacebar") return "space";
  return null;
}

function hasActivationModifier(event) {
  return Boolean(
    event.ctrlKey
    || event.altKey
    || event.metaKey
    || event.shiftKey
    || event.isComposing,
  );
}

function isWithin(button, target) {
  return target === button || Boolean(button.contains?.(target));
}

/** Read pad identity, key, and sample path directly from the HTML contract. */
export function createInputController({
  document: documentRef = globalThis.document,
  onActivate = () => {},
  onConfigError = () => {},
} = {}) {
  if (!documentRef) throw new Error("An HTML document is required to initialize drum input.");

  const buttons = [...documentRef.querySelectorAll("button[data-pad-id]")];
  const records = [];
  const keyMap = new Map();
  const conflictedKeys = new Set();
  const seenPadIds = new Set();
  const configErrors = [];
  let enabled = true;

  for (const button of buttons) {
    const padId = button.dataset.padId?.trim();
    const source = button.dataset.sound?.trim();
    const rawKey = button.dataset.key?.trim() ?? "";
    const key = rawKey.toLowerCase();
    const name = button.querySelector(".pad__name")?.textContent?.trim() || padId || "Trống";
    const keyLabel = button.querySelector(".pad__key");

    if (keyLabel) keyLabel.textContent = rawKey ? rawKey.toUpperCase() : "?";

    if (!padId || !source) {
      configErrors.push("Mỗi pad cần có data-pad-id và data-sound.");
      continue;
    }
    if (seenPadIds.has(padId)) {
      configErrors.push(`Mã pad bị trùng: ${padId}.`);
      continue;
    }
    seenPadIds.add(padId);

    const record = {
      padId,
      source,
      key,
      button,
      initiallyDisabled: button.disabled,
      enterPressed: false,
      spacePressed: false,
    };
    records.push(record);
    button.setAttribute("aria-label", rawKey ? `${name}, phím ${rawKey.toUpperCase()}` : `${name}, chưa có phím hợp lệ`);

    if (!/^[a-z0-9]$/.test(key)) {
      configErrors.push(`Phím của pad ${name} cần là một chữ cái hoặc chữ số.`);
      continue;
    }
    if (conflictedKeys.has(key)) continue;
    if (keyMap.has(key)) {
      keyMap.delete(key);
      conflictedKeys.add(key);
      configErrors.push(`Phím ${rawKey.toUpperCase()} đang được gán cho nhiều pad.`);
      continue;
    }
    keyMap.set(key, record);
  }

  function activate(record, inputMethod) {
    if (!enabled || record.button.disabled) return;
    onActivate({
      padId: record.padId,
      source: record.source,
      button: record.button,
      inputMethod,
    });
  }

  function onKeyDown(event) {
    if (
      !enabled
      || event.repeat
      || event.ctrlKey
      || event.altKey
      || event.metaKey
      || event.isComposing
      || event.defaultPrevented
      || isEditableTarget(event.target)
    ) return;

    const key = typeof event.key === "string" ? event.key.toLowerCase() : "";
    if (key.length !== 1) return;
    const record = keyMap.get(key);
    if (record) activate(record, "keyboard");
  }

  function onPadKeyDown(event, record) {
    const activationKey = getButtonActivationKey(event);
    if (!activationKey) return;

    // Native buttons synthesize click events for Enter and Space. Cancel that
    // default only on drum pads, then route the real key press through activate().
    const wasDefaultPrevented = event.defaultPrevented;
    event.preventDefault();
    if (
      wasDefaultPrevented
      || hasActivationModifier(event)
      || !enabled
      || record.button.disabled
    ) return;

    const pressedProperty = activationKey === "enter" ? "enterPressed" : "spacePressed";
    if (event.repeat || record[pressedProperty]) return;
    record[pressedProperty] = true;

    // Enter activates on keydown. Space is activated once on keyup, matching
    // the usual native-button interaction while suppressing its native click.
    if (activationKey === "enter") activate(record, "keyboard");
  }

  function onKeyUp(event) {
    const activationKey = getButtonActivationKey(event);
    if (!activationKey) return;

    const pressedProperty = activationKey === "enter" ? "enterPressed" : "spacePressed";
    for (const record of records) {
      if (!record[pressedProperty]) continue;
      record[pressedProperty] = false;

      if (activationKey !== "space" || !isWithin(record.button, event.target)) continue;
      const wasDefaultPrevented = event.defaultPrevented;
      event.preventDefault();
      if (
        !wasDefaultPrevented
        && enabled
        && !record.button.disabled
        && !hasActivationModifier(event)
      ) activate(record, "keyboard");
    }
  }

  for (const record of records) {
    record.onClick = () => activate(record, "button");
    record.onKeyDown = (event) => onPadKeyDown(event, record);
    record.button.addEventListener("keydown", record.onKeyDown);
    record.button.addEventListener("click", record.onClick);
  }
  documentRef.addEventListener("keydown", onKeyDown);
  documentRef.addEventListener("keyup", onKeyUp);

  if (configErrors.length > 0) onConfigError([...configErrors]);

  return {
    setEnabled(nextEnabled) {
      enabled = Boolean(nextEnabled);
      for (const record of records) {
        record.enterPressed = false;
        record.spacePressed = false;
        record.button.disabled = !enabled || record.initiallyDisabled;
      }
    },
    destroy() {
      documentRef.removeEventListener("keydown", onKeyDown);
      documentRef.removeEventListener("keyup", onKeyUp);
      for (const record of records) {
        record.button.removeEventListener("keydown", record.onKeyDown);
        record.button.removeEventListener("click", record.onClick);
      }
    },
    get configErrors() {
      return [...configErrors];
    },
  };
}
