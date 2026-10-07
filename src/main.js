import { createAudioEngine } from "./audio-engine.js";
import { createBeatPlayer } from "./beat-player.js";
import { createBeatRecorder } from "./beat-recorder.js";
import { createInputController } from "./input-controller.js";

const recordButton = document.querySelector("#record-button");
const stopButton = document.querySelector("#stop-button");
const playbackButton = document.querySelector("#playback-button");
const clearButton = document.querySelector("#clear-button");
const countLabel = document.querySelector("#recording-count");
const statusLabel = document.querySelector("#app-status");
const modeLabel = document.querySelector("#mode-label");

const padById = new Map(
  [...document.querySelectorAll("button[data-pad-id]")].map((button) => [
    button.dataset.padId,
    {
      padId: button.dataset.padId,
      source: button.dataset.sound,
      button,
      name: button.querySelector(".pad__name")?.textContent?.trim() || button.dataset.padId,
    },
  ]),
);
const padBySource = new Map([...padById.values()].map((pad) => [pad.source, pad]));
const pulseTimers = new Map();

const recorder = createBeatRecorder();
let state = "idle";
let playbackHandle = null;
let playbackHadAudioError = false;
let inputController;

function setStatus(message, kind = "normal") {
  statusLabel.textContent = message;
  statusLabel.dataset.kind = kind;
}

function updateCount() {
  const count = recorder.length;
  countLabel.textContent = `${count} nhịp trong bản ghi`;
}

function clearPadPulses() {
  for (const [button, timer] of pulseTimers) {
    clearTimeout(timer);
    button.classList.remove("is-active");
  }
  pulseTimers.clear();
}

function pulsePad(button) {
  const priorTimer = pulseTimers.get(button);
  if (priorTimer) clearTimeout(priorTimer);
  button.classList.add("is-active");
  const timer = setTimeout(() => {
    button.classList.remove("is-active");
    pulseTimers.delete(button);
  }, 150);
  pulseTimers.set(button, timer);
}

function updateStopButton(activeCount = audioEngine.activeCount) {
  const unavailable = state === "idle" && activeCount === 0;
  // A focused native disabled button loses focus; keep its disabled ARIA state
  // until blur, then apply the native disabled state without moving focus.
  const preserveFocus = unavailable && document.activeElement === stopButton;
  stopButton.setAttribute("aria-disabled", String(unavailable));
  stopButton.disabled = unavailable && !preserveFocus;
  stopButton.tabIndex = unavailable && !preserveFocus ? -1 : 0;
}

function updateControls() {
  const activeElement = document.activeElement;
  recordButton.disabled = state !== "idle";
  updateStopButton();
  playbackButton.disabled = state !== "idle" || recorder.length === 0;
  clearButton.disabled = state !== "idle" || recorder.length === 0;
  inputController?.setEnabled(state !== "playing");

  modeLabel.textContent = state === "recording"
    ? "Đang ghi nhịp"
    : state === "playing"
      ? "Đang phát lại"
      : "Sẵn sàng chơi";

  if (activeElement instanceof HTMLButtonElement && activeElement.disabled) {
    const nextControl = state === "idle" ? recordButton : stopButton;
    nextControl.focus({ preventScroll: true });
  }
}

function reportAudioError(error) {
  const pad = padBySource.get(error.source);
  const name = pad?.name || "âm thanh";
  setStatus(`Không phát được ${name}. Kiểm tra tệp mẫu âm thanh.`, "error");
  if (state === "playing") playbackHadAudioError = true;
}

const audioEngine = createAudioEngine({
  onError: reportAudioError,
  onActiveChange(activeCount) {
    // Keep this update local: audio ending or starting should not move focus.
    updateStopButton(activeCount);
  },
});

function dispatchPadHit(pad, { recordHit = false } = {}) {
  if (recordHit && state === "playing") return false;
  if (recordHit && state === "recording") {
    recorder.record(pad.padId);
    updateCount();
  }
  pulsePad(pad.button);
  void audioEngine.play(pad.source);
  return true;
}

const beatPlayer = createBeatPlayer({
  onHit(padId) {
    const pad = padById.get(padId);
    if (!pad) throw new Error(`Không tìm thấy pad có mã ${padId}.`);
    dispatchPadHit(pad);
  },
  whenIdle: () => audioEngine.whenIdle(),
  stopAll: () => audioEngine.stopAll(),
});

inputController = createInputController({
  document,
  onActivate(activation) {
    if (state === "playing") return;
    dispatchPadHit({
      padId: activation.padId,
      source: activation.source,
      button: activation.button,
    }, { recordHit: true });
  },
  onConfigError(errors) {
    setStatus(`Cấu hình pad có lỗi: ${errors.join(" ")}`, "error");
  },
});

recordButton.addEventListener("click", () => {
  if (state !== "idle") return;
  try {
    recorder.start();
    state = "recording";
    playbackHadAudioError = false;
    updateCount();
    updateControls();
    setStatus("Đang ghi nhịp. Chơi pad để thêm nhịp.");
  } catch (error) {
    setStatus(`Không thể bắt đầu ghi: ${error.message}`, "error");
  }
});

stopButton.addEventListener("click", () => {
  if (state === "idle" && audioEngine.activeCount === 0) return;
  const previousState = state;
  if (previousState === "recording") recorder.stop();
  if (previousState === "playing" && playbackHandle) {
    const handle = playbackHandle;
    playbackHandle = null;
    handle.cancel();
  }
  audioEngine.stopAll();
  clearPadPulses();
  state = "idle";
  updateCount();
  updateControls();
  if (previousState === "recording") {
    setStatus(`Đã dừng ghi. Đã lưu ${recorder.length} nhịp.`);
  } else if (previousState === "playing") {
    setStatus("Đã dừng phát lại. Bản ghi vẫn được giữ.");
  } else {
    setStatus("Đã dừng âm thanh đang phát. Bản ghi vẫn được giữ.");
  }
});

stopButton.addEventListener("blur", () => {
  if (state === "idle" && audioEngine.activeCount === 0) {
    stopButton.disabled = true;
    stopButton.tabIndex = -1;
  }
});

playbackButton.addEventListener("click", () => {
  if (state !== "idle") return;
  const events = recorder.getEvents();
  if (events.length === 0) {
    setStatus("Bản ghi đang trống. Hãy ghi một nhịp trước khi phát lại.");
    return;
  }

  audioEngine.stopAll();
  clearPadPulses();
  state = "playing";
  playbackHadAudioError = false;
  updateControls();
  setStatus("Đang phát lại các nhịp đã ghi.");

  try {
    const handle = beatPlayer.play(events);
    if (!handle) {
      state = "idle";
      updateControls();
      setStatus("Không có nhịp nào để phát lại.");
      return;
    }
    playbackHandle = handle;
    handle.done.then((result) => {
      if (playbackHandle !== handle) return;
      playbackHandle = null;
      if (state !== "playing") return;
      state = "idle";
      updateControls();
      if (result.status === "error") {
        setStatus(`Không thể hoàn tất phát lại: ${result.error.message}`, "error");
      } else if (playbackHadAudioError) {
        setStatus("Phát lại xong nhưng một số mẫu âm thanh gặp lỗi.", "error");
      } else {
        setStatus("Phát lại hoàn tất. Bạn có thể nghe lại hoặc ghi nhịp mới.");
      }
    });
  } catch (error) {
    state = "idle";
    playbackHandle = null;
    updateControls();
    setStatus(`Không thể phát lại: ${error.message}`, "error");
  }
});

clearButton.addEventListener("click", () => {
  if (state !== "idle" || !recorder.clear()) return;
  updateCount();
  updateControls();
  setStatus("Đã xóa bản ghi.");
});

updateCount();
updateControls();
