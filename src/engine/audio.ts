// 肃穆悲怆的合成音景：无打击乐。
// 环境 = 寒风 + 低音持续音（D-A 空五度）；事件 = 丧钟式深钟 / 远处 rumble / 暖垫 / 水声 / 风啸 /  distant 号角。
// 所有声音慢起慢落并送入生成式混响，营造空旷、哀悼的距离感。
import type { EventType } from '../data';

export class SolemnAudio {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private bus: GainNode | null = null;
  private windGain: GainNode | null = null;
  private droneGain: GainNode | null = null;
  enabled = true;
  started = false;

  init(): void {
    if (this.ctx) { void this.ctx.resume(); return; }
    const AC: typeof AudioContext | undefined = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AC) { this.enabled = false; return; }
    const ctx = new AC();
    this.ctx = ctx;
    this.master = ctx.createGain();
    this.master.gain.value = this.enabled ? 0.4 : 0;
    this.master.connect(ctx.destination);

    // 生成式混响（空旷山谷感）
    const irLen = Math.floor(ctx.sampleRate * 2.8);
    const ir = ctx.createBuffer(2, irLen, ctx.sampleRate);
    for (let ch = 0; ch < 2; ch++) {
      const d = ir.getChannelData(ch);
      for (let i = 0; i < irLen; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / irLen, 2.6);
    }
    const conv = ctx.createConvolver();
    conv.buffer = ir;
    const wet = ctx.createGain();
    wet.gain.value = 0.55;
    conv.connect(wet).connect(this.master);
    this.bus = ctx.createGain();
    this.bus.gain.value = 1;
    this.bus.connect(this.master);
    this.bus.connect(conv);

    // 寒风
    const wind = this.noiseSource(ctx, 4);
    const wf = ctx.createBiquadFilter();
    wf.type = 'lowpass'; wf.frequency.value = 400; wf.Q.value = 0.7;
    this.windGain = ctx.createGain();
    this.windGain.gain.value = 0.03;
    wind.connect(wf).connect(this.windGain).connect(this.bus);
    const wLfo = ctx.createOscillator(); wLfo.frequency.value = 0.07;
    const wLfoG = ctx.createGain(); wLfoG.gain.value = 140;
    wLfo.connect(wLfoG).connect(wf.frequency);
    wLfo.start(); wind.start();

    // 低音持续音（哀悼的底噪）
    this.droneGain = ctx.createGain();
    this.droneGain.gain.value = 0.045;
    const df = ctx.createBiquadFilter(); df.type = 'lowpass'; df.frequency.value = 320;
    df.connect(this.droneGain).connect(this.bus);
    for (const [f, type, g] of [[73.42, 'sine', 1], [110, 'sine', 0.7], [146.83, 'triangle', 0.28]] as [number, OscillatorType, number][]) {
      const o = ctx.createOscillator(); o.type = type; o.frequency.value = f;
      const og = ctx.createGain(); og.gain.value = g;
      o.connect(og).connect(df); o.start();
    }
    const dLfo = ctx.createOscillator(); dLfo.frequency.value = 0.05;
    const dLfoG = ctx.createGain(); dLfoG.gain.value = 0.016;
    dLfo.connect(dLfoG).connect(this.droneGain.gain);
    dLfo.start();
    this.started = true;
  }

  private noiseSource(ctx: AudioContext, seconds: number): AudioBufferSourceNode {
    const len = Math.floor(ctx.sampleRate * seconds);
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = buf.getChannelData(0);
    let last = 0;
    for (let i = 0; i < len; i++) {
      const white = Math.random() * 2 - 1;
      last = (last + 0.02 * white) / 1.02;
      d[i] = last * 3.2;
    }
    const src = ctx.createBufferSource();
    src.buffer = buf; src.loop = true;
    return src;
  }

  private noiseBurst(seconds: number): AudioBufferSourceNode | null {
    if (!this.ctx) return null;
    const ctx = this.ctx;
    const len = Math.floor(ctx.sampleRate * seconds);
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = buf.getChannelData(0);
    let last = 0;
    for (let i = 0; i < len; i++) {
      const white = Math.random() * 2 - 1;
      last = (last + 0.03 * white) / 1.03;
      d[i] = last * 3.0;
    }
    const src = ctx.createBufferSource();
    src.buffer = buf;
    return src;
  }

  private env(g: GainNode, t0: number, attack: number, peak: number, decay: number): void {
    const p = g.gain;
    p.setValueAtTime(0.0001, t0);
    p.linearRampToValueAtTime(peak, t0 + attack);
    p.exponentialRampToValueAtTime(0.0001, t0 + attack + decay);
  }

  setEnabled(v: boolean): void {
    this.enabled = v;
    if (this.ctx && this.master) this.master.gain.setTargetAtTime(v ? 0.4 : 0, this.ctx.currentTime, 0.25);
  }

  setWind(level: number): void {
    if (this.ctx && this.windGain) this.windGain.gain.setTargetAtTime(0.018 + level * 0.07, this.ctx.currentTime, 0.9);
  }

  // 丧钟式深钟：非谐波泛音 + 长衰减，哀悼而非敲击
  private bell(f0: number, dur = 5, peak = 0.3): void {
    if (!this.ctx || !this.bus || !this.enabled) return;
    const ctx = this.ctx, t0 = ctx.currentTime;
    const ratios = [1, 2.0, 2.98, 4.2, 5.4];
    const gains = [1, 0.45, 0.28, 0.16, 0.09];
    ratios.forEach((r, i) => {
      const o = ctx.createOscillator();
      o.type = 'sine'; o.frequency.value = f0 * r;
      o.detune.value = (i - 2) * 3;
      const g = ctx.createGain();
      this.env(g, t0, 0.02, peak * gains[i], dur * (1 - i * 0.12));
      o.connect(g).connect(this.bus!);
      o.start(t0); o.stop(t0 + dur + 0.5);
    });
  }

  // 远处闷雷 / 炮声余响：慢起慢落，无敲击感
  private rumble(dur = 3.2, peak = 0.2): void {
    if (!this.ctx || !this.bus || !this.enabled) return;
    const ctx = this.ctx, t0 = ctx.currentTime;
    const src = this.noiseBurst(dur + 1);
    if (!src) return;
    const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 130;
    const g = ctx.createGain();
    this.env(g, t0, 1.1, peak, dur);
    src.connect(lp).connect(g).connect(this.bus);
    src.start(t0); src.stop(t0 + dur + 1.2);
  }

  // 暖垫：转折 / 结盟 / 会议的一点希望
  private pad(freqs: number[], dur = 4, peak = 0.06): void {
    if (!this.ctx || !this.bus || !this.enabled) return;
    const ctx = this.ctx, t0 = ctx.currentTime;
    const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 1100;
    lp.connect(this.bus);
    for (const f of freqs) {
      const o = ctx.createOscillator(); o.type = 'triangle'; o.frequency.value = f;
      const g = ctx.createGain();
      this.env(g, t0, 1.3, peak, dur);
      o.connect(g).connect(lp);
      o.start(t0); o.stop(t0 + dur + 1.6);
    }
  }

  private water(dur = 2.6): void {
    if (!this.ctx || !this.bus || !this.enabled) return;
    const ctx = this.ctx, t0 = ctx.currentTime;
    const src = this.noiseBurst(dur + 0.6);
    if (!src) return;
    const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.Q.value = 1.1;
    bp.frequency.setValueAtTime(480, t0);
    bp.frequency.linearRampToValueAtTime(1300, t0 + dur * 0.7);
    const g = ctx.createGain();
    this.env(g, t0, 0.5, 0.1, dur);
    src.connect(bp).connect(g).connect(this.bus);
    src.start(t0); src.stop(t0 + dur + 0.8);
  }

  private gust(dur = 3): void {
    if (!this.ctx || !this.bus || !this.enabled) return;
    const ctx = this.ctx, t0 = ctx.currentTime;
    const src = this.noiseBurst(dur + 0.6);
    if (!src) return;
    const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 650; bp.Q.value = 0.5;
    const g = ctx.createGain();
    this.env(g, t0, 1.2, 0.13, dur);
    src.connect(bp).connect(g).connect(this.bus);
    src.start(t0); src.stop(t0 + dur + 0.8);
    const o = ctx.createOscillator(); o.type = 'sine'; o.frequency.value = 1150;
    const vib = ctx.createOscillator(); vib.frequency.value = 5;
    const vibG = ctx.createGain(); vibG.gain.value = 8;
    vib.connect(vibG).connect(o.frequency);
    const og = ctx.createGain();
    this.env(og, t0, 0.8, 0.015, dur);
    o.connect(og).connect(this.bus);
    o.start(t0); o.stop(t0 + dur + 1); vib.start(t0); vib.stop(t0 + dur + 1);
  }

  // 远处号角（会师）：缓慢、低沉、带混响
  private bugle(): void {
    if (!this.ctx || !this.bus || !this.enabled) return;
    const ctx = this.ctx, t0 = ctx.currentTime;
    const notes = [220, 293.66, 349.23, 440];
    notes.forEach((f, i) => {
      const t = t0 + i * 0.45;
      const o = ctx.createOscillator(); o.type = 'sawtooth'; o.frequency.value = f;
      const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 950;
      const g = ctx.createGain();
      this.env(g, t, 0.1, 0.075, i === notes.length - 1 ? 2.4 : 1.4);
      o.connect(lp).connect(g).connect(this.bus!);
      o.start(t); o.stop(t + 3);
    });
  }

  forEvent(type: EventType): void {
    if (!this.started || !this.enabled) return;
    switch (type) {
      case 'battle': this.bell(98, 5.5, 0.3); this.rumble(3.4, 0.18); break;
      case 'meeting': this.pad([174.61, 220, 261.63], 4.2, 0.055); break;
      case 'crossing': this.water(2.8); break;
      case 'mountain': this.gust(3.2); break;
      case 'join': this.bugle(); this.bell(146.83, 6, 0.22); break;
      case 'alliance': this.pad([196, 246.94, 293.66], 4, 0.05); break;
      default: this.bell(73.42, 6, 0.24); break;
    }
  }

  dispose(): void {
    if (this.ctx) { void this.ctx.close(); this.ctx = null; }
    this.started = false;
    this.master = this.bus = this.windGain = this.droneGain = null;
  }
}