const EDITABLE_TAGS = new Set(["input", "textarea", "select"]);

function isEditableTarget(target) {
  if (!target) return false;
  if (target.isContentEditable) return true;
  if (EDITABLE_TAGS.has(target.tagName?.toLowerCase())) return true;
  return Boolean(target.closest?.('[contenteditable]:not([contenteditable="false"])'));
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

    const record = { padId, source, key, button, initiallyDisabled: button.disabled };
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

  for (const record of records) {
    record.onClick = () => activate(record, "button");
    record.button.addEventListener("click", record.onClick);
  }
  documentRef.addEventListener("keydown", onKeyDown);

  if (configErrors.length > 0) onConfigError([...configErrors]);

  return {
    setEnabled(nextEnabled) {
      enabled = Boolean(nextEnabled);
      for (const record of records) {
        record.button.disabled = !enabled || record.initiallyDisabled;
      }
    },
    destroy() {
      documentRef.removeEventListener("keydown", onKeyDown);
      for (const record of records) {
        record.button.removeEventListener("click", record.onClick);
      }
    },
    get configErrors() {
      return [...configErrors];
    },
  };
}
