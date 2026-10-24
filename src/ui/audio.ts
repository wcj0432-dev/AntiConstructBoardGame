/** Original score fragments and procedural Foley. No runtime downloads, autoplay or game-state mutation. */
export type MusicTheme =
  "menu" | "governance" | "construction" | "crisis" | "ending";
export type SoundCue =
  | "click"
  | "panel"
  | "document"
  | "command"
  | "blocked"
  | "appoint"
  | "complete"
  | "reform"
  | "turn"
  | "crisis"
  | "victory";
export interface AudioSettings {
  master: number;
  music: number;
  effects: number;
  muted: boolean;
  musicMuted: boolean;
  effectsMuted: boolean;
  dynamic: boolean;
  quiet: boolean;
}
export const defaultAudio: AudioSettings = {
  master: 0.55,
  music: 0.35,
  effects: 0.5,
  muted: false,
  musicMuted: false,
  effectsMuted: false,
  dynamic: true,
  quiet: false,
};
export function readAudio(): AudioSettings {
  try {
    return normalizeAudio(
      JSON.parse(localStorage.getItem("federation-audio") || "{}"),
    );
  } catch {
    return { ...defaultAudio };
  }
}
export function normalizeAudio(p: Partial<AudioSettings>): AudioSettings {
  const v = { ...defaultAudio, ...p };
  for (const k of ["master", "music", "effects"] as const)
    v[k] =
      typeof v[k] === "number" && Number.isFinite(v[k])
        ? Math.max(0, Math.min(1, v[k]))
        : defaultAudio[k];
  for (const k of [
    "muted",
    "musicMuted",
    "effectsMuted",
    "dynamic",
    "quiet",
  ] as const)
    v[k] = typeof v[k] === "boolean" ? v[k] : defaultAudio[k];
  return v;
}
const scores: Record<MusicTheme, number[]> = {
  menu: [50, 57, 60, 62, 57, 65, 64, 60, 53, 60, 62, 65, 64, 60, 57, 50],
  governance: [48, 55, 60, 62, 64, 62, 60, 55, 53, 57, 60, 62, 60, 57, 55, 48],
  construction: [
    50, 57, 62, 66, 69, 66, 64, 62, 55, 62, 66, 69, 71, 69, 66, 62,
  ],
  crisis: [45, 52, 53, 57, 56, 52, 48, 45, 46, 53, 57, 58, 56, 53, 52, 45],
  ending: [48, 55, 60, 64, 67, 64, 62, 60, 53, 60, 65, 69, 67, 64, 60, 48],
};
const cueNotes: Record<SoundCue, number[]> = {
  click: [74],
  panel: [57, 62],
  document: [65, 60],
  command: [50, 62, 69],
  blocked: [43, 42],
  appoint: [60, 67, 72],
  complete: [50, 57, 62, 69],
  reform: [48, 55, 60],
  turn: [55, 50],
  crisis: [45, 46, 45],
  victory: [60, 64, 67, 72],
};
export class GameAudio {
  settings = readAudio();
  context: AudioContext | null = null;
  private musicGain: GainNode | null = null;
  private fxGain: GainNode | null = null;
  private current: AudioBufferSourceNode | null = null;
  private fading: AudioBufferSourceNode | null = null;
  private theme: MusicTheme | null = null;
  private pending: MusicTheme | null = null;
  private timer: ReturnType<typeof setTimeout> | null = null;
  private changed = 0;
  private lastCue = 0;
  private cueTimes: Partial<Record<SoundCue, number>> = {};
  private desired: MusicTheme = "menu";
  failed = false;
  async unlock() {
    try {
      if (!this.context) {
        this.context = new AudioContext();
        this.musicGain = this.context.createGain();
        this.fxGain = this.context.createGain();
        this.musicGain.connect(this.context.destination);
        this.fxGain.connect(this.context.destination);
        this.update(this.settings, false);
      }
      if (this.context.state === "suspended") await this.context.resume();
      if (!this.current) this.switchTheme(this.desired);
    } catch {
      this.failed = true;
    }
  }
  update(s: AudioSettings, persist = true) {
    this.settings = normalizeAudio(s);
    if (persist)
      try {
        localStorage.setItem("federation-audio", JSON.stringify(this.settings));
      } catch {
        /* Session preferences remain usable. */
      }
    const v = this.settings,
      t = this.context?.currentTime ?? 0;
    if (this.musicGain)
      this.musicGain.gain.setTargetAtTime(
        v.muted || v.musicMuted ? 0 : v.master * v.music,
        t,
        0.05,
      );
    if (this.fxGain)
      this.fxGain.gain.setTargetAtTime(
        v.muted || v.effectsMuted ? 0 : v.master * v.effects,
        t,
        0.03,
      );
    if (!v.dynamic && this.desired !== "menu" && this.desired !== "ending")
      this.requestTheme("governance", true);
  }
  requestTheme(theme: MusicTheme, immediate = false) {
    this.desired = theme;
    const next =
      !this.settings.dynamic && theme !== "menu" && theme !== "ending"
        ? "governance"
        : theme;
    if (!this.context) return;
    if (next === this.theme) {
      if (this.timer) clearTimeout(this.timer);
      this.timer = null;
      this.pending = null;
      return;
    }
    if (this.theme && Date.now() - this.changed < 12000 && !immediate) {
      this.pending = next;
      if (!this.timer)
        this.timer = setTimeout(
          () => {
            this.timer = null;
            const p = this.pending;
            this.pending = null;
            if (p) this.switchTheme(p);
          },
          12000 - (Date.now() - this.changed),
        );
      return;
    }
    if (this.timer) clearTimeout(this.timer);
    this.timer = null;
    this.pending = null;
    this.switchTheme(next);
  }
  private switchTheme(theme: MusicTheme) {
    try {
      const c = this.context;
      if (!c || !this.musicGain) return;
      const sampleRate = 22050,
        step = theme === "crisis" ? 0.7 : 1.1,
        notes = scores[theme],
        length = Math.ceil(sampleRate * step * notes.length),
        buffer = c.createBuffer(1, length, sampleRate),
        out = buffer.getChannelData(0);
      for (let i = 0; i < out.length; i++) {
        const time = i / sampleRate,
          n = Math.floor(time / step),
          phase = time % step,
          freq = 440 * 2 ** ((notes[n] - 69) / 12),
          env = Math.sin((Math.PI * phase) / step) ** 2,
          drone = 440 * 2 ** ((notes[0] - 24 - 69) / 12);
        out[i] =
          (0.09 * Math.sin(time * freq * Math.PI * 2) +
            0.027 * Math.sin(time * freq * Math.PI * 4)) *
            env +
          0.035 *
            Math.sin(time * drone * Math.PI * 2) *
            (0.65 + 0.35 * Math.sin((Math.PI * time) / (step * notes.length)));
      }
      const source = c.createBufferSource(),
        gain = c.createGain();
      source.buffer = buffer;
      source.loop = true;
      source.connect(gain);
      gain.connect(this.musicGain);
      gain.gain.setValueAtTime(0, c.currentTime);
      gain.gain.linearRampToValueAtTime(1, c.currentTime + 1.2);
      if (this.fading) {
        try {
          this.fading.stop();
        } catch {}
        this.fading = null;
      }
      if (this.current) {
        this.fading = this.current;
        const oldGain = (
          this.current as AudioBufferSourceNode & { trackGain?: GainNode }
        ).trackGain;
        oldGain?.gain.setTargetAtTime(0, c.currentTime, 0.25);
        this.current.stop(c.currentTime + 1.5);
      }
      (source as AudioBufferSourceNode & { trackGain?: GainNode }).trackGain =
        gain;
      source.start();
      this.current = source;
      this.theme = theme;
      this.changed = Date.now();
    } catch {
      this.failed = true;
    }
  }
  effect(cue: SoundCue) {
    try {
      const c = this.context;
      if (
        !c ||
        !this.fxGain ||
        this.settings.muted ||
        this.settings.effectsMuted
      )
        return;
      const now = Date.now();
      if (
        (["click", "panel", "document"].includes(cue) &&
          now - this.lastCue < 70) ||
        now - (this.cueTimes[cue] ?? 0) <
          (["crisis", "victory"].includes(cue) ? 10000 : 100) ||
        (this.settings.quiet && ["click", "panel", "document"].includes(cue))
      )
        return;
      this.lastCue = now;
      this.cueTimes[cue] = now;
      cueNotes[cue].forEach((m, i) => {
        const osc = c.createOscillator(),
          gain = c.createGain(),
          start = c.currentTime + i * 0.065;
        osc.type = ["document", "click", "blocked"].includes(cue)
          ? "triangle"
          : "sine";
        osc.frequency.value = 440 * 2 ** ((m - 69) / 12);
        gain.gain.setValueAtTime(0, start);
        gain.gain.linearRampToValueAtTime(
          cue === "click" ? 0.055 : 0.13,
          start + 0.008,
        );
        gain.gain.exponentialRampToValueAtTime(0.001, start + 0.15);
        osc.connect(gain);
        gain.connect(this.fxGain!);
        osc.start(start);
        osc.stop(start + 0.17);
      });
    } catch {
      this.failed = true;
    }
  }
  diagnostics() {
    return {
      unlocked: !!this.context,
      contextState: this.context?.state ?? "locked",
      theme: this.theme,
      pending: this.pending,
      activeTracks: this.current ? 1 : 0,
      maxCrossfadeTracks: 2,
      failed: this.failed,
    };
  }
  destroy() {
    if (this.timer) clearTimeout(this.timer);
    try {
      this.current?.stop();
      this.fading?.stop();
      void this.context?.close();
    } catch {}
    this.current = null;
    this.fading = null;
    this.context = null;
  }
}
