(function () {
  const toggleBtn = document.getElementById("bgmToggleBtn");
  const presetSelect = document.getElementById("bgmPresetSelect");
  const volumeSlider = document.getElementById("bgmVolumeSlider");

  const SCALE = [261.63, 293.66, 329.63, 392.0, 440.0, 523.25, 587.33, 659.25]; // C major pentatonic, C4~E5

  let ctx = null;
  let masterGain = null;
  let isPlaying = false;
  let timers = [];
  let activeNodes = [];

  function ensureContext() {
    if (!ctx) {
      ctx = new (window.AudioContext || window.webkitAudioContext)();
      masterGain = ctx.createGain();
      masterGain.gain.value = volumeSlider.value / 100;
      masterGain.connect(ctx.destination);
    }
    if (ctx.state === "suspended") ctx.resume();
  }

  function clearTimers() {
    timers.forEach((t) => clearTimeout(t));
    timers = [];
  }

  function stopActiveNodes() {
    activeNodes.forEach((node) => {
      try {
        if (node.stop) node.stop();
        node.disconnect();
      } catch (e) {}
    });
    activeNodes = [];
  }

  function makeSharedFX() {
    const filter = ctx.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.value = 1200;
    filter.Q.value = 0.5;

    const delay = ctx.createDelay(2);
    delay.delayTime.value = 0.35;
    const feedback = ctx.createGain();
    feedback.gain.value = 0.32;
    const wet = ctx.createGain();
    wet.gain.value = 0.25;

    filter.connect(delay);
    delay.connect(feedback);
    feedback.connect(delay);
    delay.connect(wet);
    wet.connect(masterGain);
    filter.connect(masterGain);

    // slow LFO modulating filter cutoff for gentle movement
    const lfo = ctx.createOscillator();
    lfo.frequency.value = 0.05;
    const lfoGain = ctx.createGain();
    lfoGain.gain.value = 400;
    lfo.connect(lfoGain);
    lfoGain.connect(filter.frequency);
    lfo.start();
    activeNodes.push(lfo);

    return filter;
  }

  function playPadNote(destination, freq, duration) {
    const osc1 = ctx.createOscillator();
    const osc2 = ctx.createOscillator();
    osc1.type = "sine";
    osc2.type = "triangle";
    osc1.frequency.value = freq;
    osc2.frequency.value = freq;
    osc2.detune.value = 6;

    const gain = ctx.createGain();
    const now = ctx.currentTime;
    const attack = duration * 0.35;
    const release = duration * 0.5;
    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(0.12, now + attack);
    gain.gain.setValueAtTime(0.12, now + duration - release);
    gain.gain.linearRampToValueAtTime(0, now + duration);

    osc1.connect(gain);
    osc2.connect(gain);
    gain.connect(destination);

    osc1.start(now);
    osc2.start(now);
    osc1.stop(now + duration + 0.1);
    osc2.stop(now + duration + 0.1);

    activeNodes.push(osc1, osc2);
  }

  function schedulePad(destination) {
    const duration = 5 + Math.random() * 4;
    const note = SCALE[Math.floor(Math.random() * SCALE.length)];
    playPadNote(destination, note, duration);
    // sometimes add a harmony note for a chord-like feel
    if (Math.random() < 0.6) {
      const harmonyIndex = Math.floor(Math.random() * SCALE.length);
      playPadNote(destination, SCALE[harmonyIndex] * 0.5, duration);
    }
    const nextIn = (2.5 + Math.random() * 3) * 1000;
    timers.push(setTimeout(() => schedulePad(destination), nextIn));
  }

  function startPadPreset() {
    const destination = makeSharedFX();
    schedulePad(destination);
  }

  function startRainPreset() {
    const bufferSize = ctx.sampleRate * 4;
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = Math.random() * 2 - 1;
    }
    const noise = ctx.createBufferSource();
    noise.buffer = buffer;
    noise.loop = true;

    const bandpass = ctx.createBiquadFilter();
    bandpass.type = "bandpass";
    bandpass.frequency.value = 1500;
    bandpass.Q.value = 0.6;

    const lowpass = ctx.createBiquadFilter();
    lowpass.type = "lowpass";
    lowpass.frequency.value = 3000;

    const gain = ctx.createGain();
    gain.gain.value = 0.15;

    const lfo = ctx.createOscillator();
    lfo.frequency.value = 0.08;
    const lfoGain = ctx.createGain();
    lfoGain.gain.value = 0.05;
    lfo.connect(lfoGain);
    lfoGain.connect(gain.gain);
    lfo.start();

    noise.connect(bandpass).connect(lowpass).connect(gain).connect(masterGain);
    noise.start();

    activeNodes.push(noise, lfo);
  }

  function startLofiPreset() {
    const destination = makeSharedFX();
    // soft slow pad underneath, quieter
    schedulePad(destination);

    function pluck() {
      const note = SCALE[Math.floor(Math.random() * SCALE.length)] * 2;
      const osc = ctx.createOscillator();
      osc.type = "sine";
      osc.frequency.value = note;
      const gain = ctx.createGain();
      const now = ctx.currentTime;
      gain.gain.setValueAtTime(0, now);
      gain.gain.linearRampToValueAtTime(0.08, now + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.8);
      osc.connect(gain);
      gain.connect(destination);
      osc.start(now);
      osc.stop(now + 0.9);
      activeNodes.push(osc);

      const rest = Math.random() < 0.3;
      const nextIn = (rest ? 900 : 450) + Math.random() * 300;
      timers.push(setTimeout(pluck, nextIn));
    }
    pluck();
  }

  function start(preset) {
    ensureContext();
    stopActiveNodes();
    clearTimers();
    if (preset === "rain") startRainPreset();
    else if (preset === "lofi") startLofiPreset();
    else startPadPreset();
  }

  function stop() {
    clearTimers();
    stopActiveNodes();
  }

  toggleBtn.addEventListener("click", () => {
    if (isPlaying) {
      stop();
      isPlaying = false;
      toggleBtn.textContent = "▶ 재생";
    } else {
      start(presetSelect.value);
      isPlaying = true;
      toggleBtn.textContent = "⏸ 정지";
    }
  });

  presetSelect.addEventListener("change", () => {
    if (isPlaying) start(presetSelect.value);
  });

  volumeSlider.addEventListener("input", () => {
    if (masterGain) masterGain.gain.value = volumeSlider.value / 100;
  });
})();
