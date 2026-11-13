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
    window.ClassAudio.release("timer");
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

  // 타이머 종료 알림음: '시작' 클릭 때 미리 열어 둔 공용 AudioContext 를 재사용합니다.
  // (예전 코드는 종료 순간에 새 AudioContext 를 만들어 브라우저가 자동재생으로 차단했습니다.)
  function playBeep() {
    const ctx = window.ClassAudio.getContext();
    if (!ctx) return;
    const done = () => {
      const seconds = window.ClassAudio.chime(ctx, { times: 3, freq: 880, gap: 0.5 });
      setTimeout(() => window.ClassAudio.release("timer"), seconds * 1000 + 200);
    };
    if (ctx.state === "running") done();
    else ctx.resume().then(done, (e) => console.error(e));
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
    // 클릭(사용자 제스처) 시점에 오디오 잠금 해제 → 종료 시 알림음이 확실히 울림
    if (soundToggle.checked) window.ClassAudio.unlock("timer");
    intervalId = setInterval(tick, 1000);
  });

  pauseBtn.addEventListener("click", () => {
    stop();
    window.ClassAudio.release("timer");
  });

  soundToggle.addEventListener("change", () => {
    if (!soundToggle.checked) window.ClassAudio.release("timer");
    else if (intervalId) window.ClassAudio.unlock("timer");
  });

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
