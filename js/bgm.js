(function () {
  const toggleBtn = document.getElementById("bgmToggleBtn");
  const presetSelect = document.getElementById("bgmPresetSelect");
  const volumeSlider = document.getElementById("bgmVolumeSlider");
  const statusEl = document.getElementById("audioStatus");
  const testBtn = document.getElementById("soundTestBtn");

  const SCALE = [261.63, 293.66, 329.63, 392.0, 440.0, 523.25, 587.33, 659.25]; // C 장조 기반 음계, C4~E5

  let ctx = null;
  let masterGain = null;
  let isPlaying = false;
  let timers = [];
  let session = null; // { bus, nodes:Set } — 프리셋 1회 재생 단위

  function setStatus(text, isError) {
    if (!statusEl) return;
    statusEl.textContent = text;
    statusEl.classList.toggle("error", !!isError);
  }

  // 슬라이더(0~100)를 사람 귀에 자연스러운 곡선으로 변환
  function sliderToGain() {
    const x = volumeSlider.value / 100;
    return x * x;
  }

  function ensureMaster() {
    if (!masterGain) {
      masterGain = ctx.createGain();
      masterGain.gain.value = sliderToGain();
      masterGain.connect(ctx.destination);
    }
  }

  function track(node) {
    session.nodes.add(node);
    if ("onended" in node) {
      node.onended = () => session && session.nodes.delete(node);
    }
    return node;
  }

  function clearTimers() {
    timers.forEach((t) => clearTimeout(t));
    timers = [];
  }

  // 현재 세션을 0.3초 동안 페이드아웃한 뒤 모든 노드를 정리 (딜레이 잔향이 남지 않도록)
  function endSession() {
    if (!session) return;
    const old = session;
    session = null;
    const now = ctx.currentTime;
    old.bus.gain.cancelScheduledValues(now);
    old.bus.gain.setValueAtTime(old.bus.gain.value, now);
    old.bus.gain.linearRampToValueAtTime(0, now + 0.3);
    setTimeout(() => {
      old.nodes.forEach((n) => {
        try {
          if (n.stop) n.stop();
        } catch (e) {}
        try {
          n.disconnect();
        } catch (e) {}
      });
      old.bus.disconnect();
    }, 400);
  }

  function beginSession() {
    const bus = ctx.createGain();
    bus.gain.setValueAtTime(0, ctx.currentTime);
    bus.gain.linearRampToValueAtTime(1, ctx.currentTime + 1.5); // 부드럽게 시작
    bus.connect(masterGain);
    session = { bus, nodes: new Set() };
  }

  function makeSharedFX() {
    const filter = track(ctx.createBiquadFilter());
    filter.type = "lowpass";
    filter.frequency.value = 1400;
    filter.Q.value = 0.5;

    const delay = track(ctx.createDelay(2));
    delay.delayTime.value = 0.35;
    const feedback = track(ctx.createGain());
    feedback.gain.value = 0.32;
    const wet = track(ctx.createGain());
    wet.gain.value = 0.25;

    filter.connect(delay);
    delay.connect(feedback);
    feedback.connect(delay);
    delay.connect(wet);
    wet.connect(session.bus);
    filter.connect(session.bus);

    // 필터 컷오프를 천천히 흔들어 자연스러운 움직임 부여
    const lfo = track(ctx.createOscillator());
    lfo.frequency.value = 0.05;
    const lfoGain = track(ctx.createGain());
    lfoGain.gain.value = 400;
    lfo.connect(lfoGain);
    lfoGain.connect(filter.frequency);
    lfo.start();

    return filter;
  }

  function playPadNote(destination, freq, duration, level) {
    const osc1 = track(ctx.createOscillator());
    const osc2 = track(ctx.createOscillator());
    osc1.type = "sine";
    osc2.type = "triangle";
    osc1.frequency.value = freq;
    osc2.frequency.value = freq;
    osc2.detune.value = 6;

    const gain = track(ctx.createGain());
    const now = ctx.currentTime;
    const attack = duration * 0.35;
    const release = duration * 0.5;
    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(level, now + attack);
    gain.gain.setValueAtTime(level, now + duration - release);
    gain.gain.linearRampToValueAtTime(0, now + duration);

    osc1.connect(gain);
    osc2.connect(gain);
    gain.connect(destination);

    osc1.start(now);
    osc2.start(now);
    osc1.stop(now + duration + 0.1);
    osc2.stop(now + duration + 0.1);
    // 오실레이터가 끝나면 gain 노드도 정리
    osc2.addEventListener("ended", () => {
      try {
        gain.disconnect();
      } catch (e) {}
      if (session) session.nodes.delete(gain);
    });
  }

  function schedulePad(destination, level) {
    if (!session) return;
    const duration = 5 + Math.random() * 4;
    const note = SCALE[Math.floor(Math.random() * SCALE.length)];
    playPadNote(destination, note, duration, level);
    // 60% 확률로 한 옥타브 아래 화음 추가
    if (Math.random() < 0.6) {
      const harmonyIndex = Math.floor(Math.random() * SCALE.length);
      playPadNote(destination, SCALE[harmonyIndex] * 0.5, duration, level);
    }
    const nextIn = (2.5 + Math.random() * 3) * 1000;
    timers.push(setTimeout(() => schedulePad(destination, level), nextIn));
  }

  function startPadPreset() {
    schedulePad(makeSharedFX(), 0.2);
  }

  function startRainPreset() {
    const bufferSize = ctx.sampleRate * 4;
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = Math.random() * 2 - 1;
    }
    const noise = track(ctx.createBufferSource());
    noise.buffer = buffer;
    noise.loop = true;

    const bandpass = track(ctx.createBiquadFilter());
    bandpass.type = "bandpass";
    bandpass.frequency.value = 1500;
    bandpass.Q.value = 0.6;

    const lowpass = track(ctx.createBiquadFilter());
    lowpass.type = "lowpass";
    lowpass.frequency.value = 3000;

    const gain = track(ctx.createGain());
    gain.gain.value = 0.5;

    const lfo = track(ctx.createOscillator());
    lfo.frequency.value = 0.08;
    const lfoGain = track(ctx.createGain());
    lfoGain.gain.value = 0.08;
    lfo.connect(lfoGain);
    lfoGain.connect(gain.gain);
    lfo.start();

    noise.connect(bandpass);
    bandpass.connect(lowpass);
    lowpass.connect(gain);
    gain.connect(session.bus);
    noise.start();
  }

  function startLofiPreset() {
    const destination = makeSharedFX();
    schedulePad(destination, 0.15); // 아래에 깔리는 조용한 패드

    function pluck() {
      if (!session) return;
      const note = SCALE[Math.floor(Math.random() * SCALE.length)] * 2;
      const osc = track(ctx.createOscillator());
      osc.type = "sine";
      osc.frequency.value = note;
      const gain = ctx.createGain();
      const now = ctx.currentTime;
      gain.gain.setValueAtTime(0, now);
      gain.gain.linearRampToValueAtTime(0.2, now + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.8);
      osc.connect(gain);
      gain.connect(destination);
      osc.addEventListener("ended", () => {
        try {
          gain.disconnect();
        } catch (e) {}
      });
      osc.start(now);
      osc.stop(now + 0.9);

      const rest = Math.random() < 0.3;
      const nextIn = (rest ? 900 : 450) + Math.random() * 300;
      timers.push(setTimeout(pluck, nextIn));
    }
    pluck();
  }

  function startPreset(preset) {
    clearTimers();
    endSession();
    beginSession();
    if (preset === "rain") startRainPreset();
    else if (preset === "lofi") startLofiPreset();
    else startPadPreset();
  }

  function failMessage() {
    if (window.ClassAudio.state() === "unsupported") {
      return "이 브라우저는 Web Audio 를 지원하지 않아요. 크롬/사파리/엣지 최신 버전을 사용해주세요.";
    }
    return "소리를 켜지 못했어요. 버튼을 한 번 더 눌러주세요. (기기 음량·무음 모드·블루투스 연결도 확인)";
  }

  async function play() {
    // 클릭 이벤트 안에서 바로 호출되어야 잠금이 풀립니다.
    ctx = await window.ClassAudio.unlock("bgm");
    if (!ctx) {
      window.ClassAudio.release("bgm");
      setStatus(failMessage(), true);
      return;
    }
    ensureMaster();
    startPreset(presetSelect.value);
    isPlaying = true;
    toggleBtn.textContent = "⏸ 정지";
    setStatus("재생 중 · 소리가 작으면 볼륨 바와 기기 음량을 올려주세요.");
  }

  function stop() {
    clearTimers();
    if (ctx) endSession();
    window.ClassAudio.release("bgm");
    isPlaying = false;
    toggleBtn.textContent = "▶ 재생";
    setStatus("");
  }

  toggleBtn.addEventListener("click", () => {
    if (isPlaying) stop();
    else play();
  });

  presetSelect.addEventListener("change", () => {
    if (isPlaying) startPreset(presetSelect.value);
  });

  volumeSlider.addEventListener("input", () => {
    if (masterGain) masterGain.gain.setTargetAtTime(sliderToGain(), ctx.currentTime, 0.05);
  });

  if (testBtn) {
    testBtn.addEventListener("click", async () => {
      const c = await window.ClassAudio.unlock();
      if (!c) {
        setStatus(failMessage(), true);
        return;
      }
      window.ClassAudio.chime(c, { times: 2, freq: 660, gap: 0.3 });
      setStatus("딩동 소리가 들리면 정상이에요. 안 들리면 기기 음량·무음 스위치·출력 장치를 확인해주세요.");
    });
  }

  // 다른 탭에 갔다 오거나 iOS 에서 화면이 꺼졌다 켜지면 컨텍스트가 멈출 수 있어 다시 깨웁니다.
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible" && isPlaying && ctx && ctx.state !== "running") {
      ctx.resume().catch(() => {});
    }
  });
})();
