(function () {
  const display = document.getElementById("timerDisplay");
  const overlay = document.getElementById("timerOverlay");
  const overlayDisplay = document.getElementById("timerOverlayDisplay");
  const startBtn = document.getElementById("timerStartBtn");
  const pauseBtn = document.getElementById("timerPauseBtn");
  const resetBtn = document.getElementById("timerResetBtn");
  const fullscreenBtn = document.getElementById("timerFullscreenBtn");
  const exitFullscreenBtn = document.getElementById("exitFullscreenBtn");
  const soundToggle = document.getElementById("timerSoundToggle");
  const customMinutes = document.getElementById("customMinutes");
  const customSeconds = document.getElementById("customSeconds");
  const setCustomTimeBtn = document.getElementById("setCustomTimeBtn");

  let totalSeconds = 5 * 60;
  let remainingSeconds = totalSeconds;
  let intervalId = null;

  function format(seconds) {
    const m = Math.floor(seconds / 60)
      .toString()
      .padStart(2, "0");
    const s = Math.floor(seconds % 60)
      .toString()
      .padStart(2, "0");
    return m + ":" + s;
  }

  function render() {
    const text = format(remainingSeconds);
    display.textContent = text;
    overlayDisplay.textContent = text;
  }

  function setSeconds(seconds) {
    stop();
    totalSeconds = seconds;
    remainingSeconds = seconds;
    render();
  }

  function stop() {
    if (intervalId) {
      clearInterval(intervalId);
      intervalId = null;
    }
  }

  function playBeep() {
    try {
      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      const now = ctx.currentTime;
      for (let i = 0; i < 3; i++) {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = "sine";
        osc.frequency.value = 880;
        gain.gain.setValueAtTime(0, now + i * 0.5);
        gain.gain.linearRampToValueAtTime(0.3, now + i * 0.5 + 0.02);
        gain.gain.linearRampToValueAtTime(0, now + i * 0.5 + 0.35);
        osc.connect(gain).connect(ctx.destination);
        osc.start(now + i * 0.5);
        osc.stop(now + i * 0.5 + 0.4);
      }
      setTimeout(() => ctx.close(), 2000);
    } catch (e) {
      console.error(e);
    }
  }

  function tick() {
    remainingSeconds -= 1;
    if (remainingSeconds <= 0) {
      remainingSeconds = 0;
      render();
      stop();
      if (soundToggle.checked) playBeep();
      return;
    }
    render();
  }

  startBtn.addEventListener("click", () => {
    if (intervalId || remainingSeconds <= 0) return;
    intervalId = setInterval(tick, 1000);
  });

  pauseBtn.addEventListener("click", stop);

  resetBtn.addEventListener("click", () => {
    setSeconds(totalSeconds);
  });

  document.querySelectorAll(".timer-presets button").forEach((btn) => {
    btn.addEventListener("click", () => {
      const minutes = parseInt(btn.dataset.min, 10);
      setSeconds(minutes * 60);
    });
  });

  setCustomTimeBtn.addEventListener("click", () => {
    const min = parseInt(customMinutes.value, 10) || 0;
    const sec = parseInt(customSeconds.value, 10) || 0;
    if (min === 0 && sec === 0) return;
    setSeconds(min * 60 + sec);
  });

  fullscreenBtn.addEventListener("click", () => {
    overlay.hidden = false;
    if (overlay.requestFullscreen) {
      overlay.requestFullscreen().catch(() => {});
    }
  });

  function closeOverlay() {
    overlay.hidden = true;
    if (document.fullscreenElement) {
      document.exitFullscreen().catch(() => {});
    }
  }

  exitFullscreenBtn.addEventListener("click", closeOverlay);
  document.addEventListener("fullscreenchange", () => {
    if (!document.fullscreenElement && !overlay.hidden) {
      overlay.hidden = true;
    }
  });

  render();
})();
