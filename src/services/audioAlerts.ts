// Web Audio API Sound Synthesizer for Weather Alerts

let audioCtx: AudioContext | null = null;

function getAudioContext(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  if (!audioCtx) {
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    if (AudioContextClass) {
      audioCtx = new AudioContextClass();
    }
  }
  if (audioCtx && audioCtx.state === 'suspended') {
    audioCtx.resume().catch(() => {});
  }
  return audioCtx;
}

export function playHumidityAlertSound(volume: number = 0.8) {
  try {
    const ctx = getAudioContext();
    if (!ctx) return;

    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'sine';
    // Two-tone rising chime indicating hygrometric warning
    osc.frequency.setValueAtTime(587.33, now); // D5
    osc.frequency.setValueAtTime(880, now + 0.15); // A5

    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(0.3 * volume, now + 0.03);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.6);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(now);
    osc.stop(now + 0.6);
  } catch (err) {
    console.error('Error playing humidity sound:', err);
  }
}

export function playLightningAlertSound(volume: number = 0.8, isSevere: boolean = false) {
  try {
    const ctx = getAudioContext();
    if (!ctx) return;

    const now = ctx.currentTime;
    
    // 1. High frequency warning ping
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = isSevere ? 'sawtooth' : 'triangle';
    osc.frequency.setValueAtTime(isSevere ? 1200 : 900, now);
    osc.frequency.exponentialRampToValueAtTime(300, now + 0.3);

    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime((isSevere ? 0.5 : 0.3) * volume, now + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.4);

    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.4);

    // 2. Low rumble simulation (brown noise filter)
    const bufferSize = ctx.sampleRate * 0.8;
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    let lastOut = 0.0;
    for (let i = 0; i < bufferSize; i++) {
      const white = Math.random() * 2 - 1;
      data[i] = (lastOut + 0.02 * white) / 1.02;
      lastOut = data[i];
      data[i] *= 3.5; // rumble gain
    }

    const noise = ctx.createBufferSource();
    noise.buffer = buffer;

    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(140, now);
    filter.frequency.linearRampToValueAtTime(60, now + 0.7);

    const noiseGain = ctx.createGain();
    noiseGain.gain.setValueAtTime(0, now);
    noiseGain.gain.linearRampToValueAtTime(0.4 * volume, now + 0.08);
    noiseGain.gain.exponentialRampToValueAtTime(0.001, now + 0.8);

    noise.connect(filter);
    filter.connect(noiseGain);
    noiseGain.connect(ctx.destination);

    noise.start(now + 0.05);
    noise.stop(now + 0.85);
  } catch (err) {
    console.error('Error playing lightning sound:', err);
  }
}

export function playTestChime(volume: number = 0.8) {
  try {
    const ctx = getAudioContext();
    if (!ctx) return;

    const notes = [523.25, 659.25, 783.99, 1046.5]; // C5, E5, G5, C6
    notes.forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      const startTime = ctx.currentTime + i * 0.09;

      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, startTime);

      gain.gain.setValueAtTime(0, startTime);
      gain.gain.linearRampToValueAtTime(0.25 * volume, startTime + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.001, startTime + 0.35);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(startTime);
      osc.stop(startTime + 0.35);
    });
  } catch (err) {
    console.error('Error playing test sound:', err);
  }
}

export function triggerVibration(pattern: number[] = [200, 100, 200]) {
  if (typeof window !== 'undefined' && 'navigator' in window && navigator.vibrate) {
    try {
      navigator.vibrate(pattern);
    } catch {
      // ignore
    }
  }
}
