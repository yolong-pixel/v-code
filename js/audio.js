// 공용 오디오 관리자 (BGM, 타이머 알림음이 함께 사용)
//
// 소리가 안 나던 원인과 대응:
// 1) 브라우저 자동재생 정책: AudioContext 는 사용자 클릭(제스처) 안에서 만들거나
//    resume() 해야 소리가 납니다. 예전 타이머는 시간이 끝나는 순간(클릭이 아닌 시점)에
//    새 AudioContext 를 만들어 Safari/iOS 등에서 무음이었습니다.
//    → 클릭 시점에 하나의 AudioContext 를 만들어 두고 계속 재사용합니다.
// 2) iPhone/iPad 무음 스위치: Web Audio 는 무음 스위치를 따르기 때문에 소리가 꺼집니다.
//    → navigator.audioSession.type = "playback" (Safari 16.4+) 을 지정하고,
//      지원하지 않는 기기를 위해 무음 <audio> 를 함께 재생해 '미디어 재생'으로 분류되게 합니다.
(function () {
  const AC = window.AudioContext || window.webkitAudioContext;
  let ctx = null;
  let silentEl = null;
  const holds = new Set();

  // 0.5초 길이의 무음 WAV 를 코드로 생성 (외부 파일 불필요)
  function makeSilentWavUrl() {
    const sampleRate = 8000;
    const numSamples = sampleRate / 2;
    const dataSize = numSamples * 2; // 16-bit mono
    const buf = new ArrayBuffer(44 + dataSize);
    const v = new DataView(buf);
    const writeStr = (off, s) => {
      for (let i = 0; i < s.length; i++) v.setUint8(off + i, s.charCodeAt(i));
    };
    writeStr(0, "RIFF");
    v.setUint32(4, 36 + dataSize, true);
    writeStr(8, "WAVE");
    writeStr(12, "fmt ");
    v.setUint32(16, 16, true); // fmt chunk size
    v.setUint16(20, 1, true); // PCM
    v.setUint16(22, 1, true); // mono
    v.setUint32(24, sampleRate, true);
    v.setUint32(28, sampleRate * 2, true); // byte rate
    v.setUint16(32, 2, true); // block align
    v.setUint16(34, 16, true); // bits per sample
    writeStr(36, "data");
    v.setUint32(40, dataSize, true);
    // 샘플 값은 ArrayBuffer 기본값 0 → 무음
    return URL.createObjectURL(new Blob([buf], { type: "audio/wav" }));
  }

  function getContext() {
    if (!AC) return null;
    if (!ctx) ctx = new AC();
    return ctx;
  }

  function playSilentElement() {
    try {
      if (!silentEl) {
        silentEl = new Audio(makeSilentWavUrl());
        silentEl.loop = true;
        silentEl.setAttribute("playsinline", "");
      }
      const p = silentEl.play();
      if (p && p.catch) p.catch(() => {});
    } catch (e) {
      // 무음 엘리먼트 실패는 치명적이지 않으므로 무시
    }
  }

  // 반드시 클릭/터치 이벤트 핸들러 안에서 호출하세요.
  // 성공하면 실행 중인 AudioContext, 실패하면 null 을 돌려줍니다.
  async function unlock(holdKey) {
    const c = getContext();
    if (!c) return null;

    if (navigator.audioSession) {
      try {
        navigator.audioSession.type = "playback";
      } catch (e) {}
    }

    if (holdKey) hold(holdKey);

    // 일부 iOS 버전은 제스처 안에서 실제 버퍼를 한 번 재생해야 잠금이 풀립니다.
    try {
      const src = c.createBufferSource();
      src.buffer = c.createBuffer(1, 1, c.sampleRate);
      src.connect(c.destination);
      src.start(0);
    } catch (e) {}

    if (c.state !== "running") {
      try {
        await c.resume();
      } catch (e) {
        console.error("AudioContext resume 실패:", e);
      }
    }
    return c.state === "running" ? c : null;
  }

  // BGM 재생 중 / 타이머 진행 중에만 무음 엘리먼트를 유지합니다.
  function hold(key) {
    holds.add(key);
    playSilentElement();
  }

  function release(key) {
    holds.delete(key);
    if (holds.size === 0 && silentEl) silentEl.pause();
  }

  function state() {
    if (!AC) return "unsupported";
    return ctx ? ctx.state : "not-created";
  }

  // 짧은 차임: 소리 테스트 / 타이머 종료 알림에 사용
  function chime(c, { times = 1, freq = 880, gap = 0.5, level = 0.35 } = {}) {
    const now = c.currentTime + 0.05;
    for (let i = 0; i < times; i++) {
      const t = now + i * gap;
      const osc = c.createOscillator();
      const gain = c.createGain();
      osc.type = "sine";
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0, t);
      gain.gain.linearRampToValueAtTime(level, t + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.4);
      osc.connect(gain);
      gain.connect(c.destination);
      osc.start(t);
      osc.stop(t + 0.45);
    }
    return (times - 1) * gap + 0.5; // 재생 길이(초)
  }

  window.ClassAudio = { getContext, unlock, hold, release, state, chime };
})();
