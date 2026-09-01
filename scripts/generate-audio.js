// scripts/generate-audio.js
const fs = require('fs');
const path = require('path');

const sampleRate = 22050; // 22kHz sample rate
const AUDIO_DIR = path.join(__dirname, '..', 'public', 'audio');

function generateWav(filename, durationSec, genFn) {
  const filepath = path.join(AUDIO_DIR, filename);
  const numSamples = Math.floor(sampleRate * durationSec);
  const buffer = Buffer.alloc(44 + numSamples * 2);

  // RIFF header
  buffer.write('RIFF', 0);
  buffer.writeUInt32LE(36 + numSamples * 2, 4);
  buffer.write('WAVE', 8);

  // fmt chunk
  buffer.write('fmt ', 12);
  buffer.writeUInt32LE(16, 16); // chunk size
  buffer.writeUInt16LE(1, 20); // audio format (PCM)
  buffer.writeUInt16LE(1, 22); // channels (mono)
  buffer.writeUInt32LE(sampleRate, 24); // sample rate
  buffer.writeUInt32LE(sampleRate * 2, 28); // byte rate (sampleRate * blockAlign)
  buffer.writeUInt16LE(2, 32); // block align (channels * bytes/sample)
  buffer.writeUInt16LE(16, 34); // bits per sample

  // data chunk
  buffer.write('data', 36);
  buffer.writeUInt32LE(numSamples * 2, 40);

  // Write PCM data
  let offset = 44;
  for (let i = 0; i < numSamples; i++) {
    const t = i / sampleRate;
    const sampleVal = genFn(t, durationSec);
    // clamp to 16-bit signed integer
    const intVal = Math.max(-32768, Math.min(32767, Math.floor(sampleVal * 32767)));
    buffer.writeInt16LE(intVal, offset);
    offset += 2;
  }

  // Ensure directory exists
  if (!fs.existsSync(AUDIO_DIR)) {
    fs.mkdirSync(AUDIO_DIR, { recursive: true });
  }
  fs.writeFileSync(filepath, buffer);
  console.log(`Generated audio: ${filename}`);
}

// 1. hover.wav - quick high tick
generateWav('hover.wav', 0.04, (t) => {
  return Math.sin(2 * Math.PI * 1500 * t) * Math.exp(-250 * t) * 0.15;
});

// 2. click.wav - typewriter key
generateWav('click.wav', 0.08, (t) => {
  const noise = Math.random() * 2 - 1;
  const clickWave = Math.sin(2 * Math.PI * 800 * t);
  return (noise * 0.15 + clickWave * 0.1) * Math.exp(-120 * t);
});

// 3. welcome.wav - beautiful retro arpeggio (C4 -> E4 -> G4 -> C5)
generateWav('welcome.wav', 0.7, (t, dur) => {
  let freq = 261.63; // C4
  if (t > 0.12) freq = 329.63; // E4
  if (t > 0.24) freq = 392.00; // G4
  if (t > 0.36) freq = 523.25; // C5
  
  const envelope = Math.max(0, 1 - t / dur);
  // Add minor modulation for a warmer synth feel
  const vibrato = 1 + 0.02 * Math.sin(2 * Math.PI * 6 * t);
  return Math.sin(2 * Math.PI * (freq * vibrato) * t) * envelope * 0.25;
});

// 4. success.wav - happy rising scale
generateWav('success.wav', 0.35, (t, dur) => {
  const freq = t < 0.15 ? 523.25 : 659.25; // C5 -> E5
  const envelope = Math.max(0, 1 - t / dur);
  return Math.sin(2 * Math.PI * freq * t) * envelope * 0.3;
});

// 5. error.wav - buzzer alert
generateWav('error.wav', 0.32, (t, dur) => {
  // double buzz sound
  if (t > 0.12 && t < 0.18) return 0;
  
  const freq = 110.00; // A2 low tone
  const sineVal = Math.sin(2 * Math.PI * freq * t);
  // convert sine to square-like buzz
  const buzzVal = sineVal > 0 ? 0.25 : -0.25;
  const envelope = Math.max(0, 1 - t / dur);
  return buzzVal * envelope;
});

console.log('🎉 Audio assets generation complete.');
