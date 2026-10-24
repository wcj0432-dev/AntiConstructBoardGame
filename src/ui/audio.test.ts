import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { GameAudio, defaultAudio, normalizeAudio, readAudio } from "./audio";
class Param {
  value = 0;
  setTargetAtTime(v: number) {
    this.value = v;
  }
  setValueAtTime(v: number) {
    this.value = v;
  }
  linearRampToValueAtTime(v: number) {
    this.value = v;
  }
  exponentialRampToValueAtTime(v: number) {
    this.value = v;
  }
}
class Node {
  gain = new Param();
  frequency = { value: 0 };
  connect() {}
  disconnect() {}
  start = vi.fn();
  stop = vi.fn();
  buffer: unknown;
  loop = false;
  type = "";
}
class Context {
  static instances: Context[] = [];
  state = "suspended";
  currentTime = 0;
  destination = {};
  sources: Node[] = [];
  gains: Node[] = [];
  constructor() {
    Context.instances.push(this);
  }
  resume = vi.fn(async () => {
    this.state = "running";
  });
  close = vi.fn(async () => {
    this.state = "closed";
  });
  createGain() {
    const n = new Node();
    this.gains.push(n);
    return n;
  }
  createBuffer(_channels: number, length: number) {
    const a = new Float32Array(length);
    return { getChannelData: () => a };
  }
  createBufferSource() {
    const n = new Node();
    this.sources.push(n);
    return n;
  }
  createOscillator() {
    return new Node();
  }
}
let storage: Map<string, string>;
beforeEach(() => {
  storage = new Map();
  Context.instances = [];
  vi.stubGlobal("localStorage", {
    getItem: (k: string) => storage.get(k) ?? null,
    setItem: (k: string, v: string) => storage.set(k, v),
  });
  vi.stubGlobal("AudioContext", Context);
  vi.useFakeTimers();
  vi.setSystemTime(50000);
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});
describe("v0.7 统一音频：安全解锁、混音、持久化和失效退路", () => {
  it("用户交互前不创建音频上下文，同一场景不重复启动多条音轨", async () => {
    const a = new GameAudio();
    a.requestTheme("crisis");
    expect(Context.instances).toHaveLength(0);
    await a.unlock();
    expect(Context.instances).toHaveLength(1);
    expect(Context.instances[0].resume).toHaveBeenCalledOnce();
    for (let i = 0; i < 10; i++) a.requestTheme("crisis");
    expect(Context.instances[0].sources).toHaveLength(1);
    expect(a.diagnostics().theme).toBe("crisis");
    a.destroy();
  });
  it("总量和独立静音作用于实际混音通道，并正确保存", async () => {
    const a = new GameAudio();
    await a.unlock();
    a.update({ ...defaultAudio, master: 0.8, music: 0.5, effects: 0.25 });
    const c = Context.instances[0];
    expect(c.gains[0].gain.value).toBe(0.4);
    expect(c.gains[1].gain.value).toBe(0.2);
    a.update({ ...a.settings, musicMuted: true });
    expect(c.gains[0].gain.value).toBe(0);
    expect(c.gains[1].gain.value).toBe(0.2);
    a.update({ ...a.settings, muted: true });
    expect(c.gains[1].gain.value).toBe(0);
    expect(readAudio()).toEqual(a.settings);
    a.destroy();
  });
  it("快速小事件合并音乐切换；返回原场景取消旧的待播请求", async () => {
    const a = new GameAudio();
    await a.unlock();
    a.requestTheme("crisis");
    expect(a.diagnostics().pending).toBe("crisis");
    a.requestTheme("menu");
    await vi.advanceTimersByTimeAsync(13000);
    expect(a.diagnostics().theme).toBe("menu");
    expect(Context.instances[0].sources).toHaveLength(1);
    a.requestTheme("construction");
    expect(a.diagnostics().theme).toBe("construction");
    expect(Context.instances[0].sources[0].stop).toHaveBeenCalled();
    expect(a.diagnostics().maxCrossfadeTracks).toBe(2);
    a.destroy();
  });
  it("关闭动态音乐保留菜单和终局，中间阶段使用统一治理曲", async () => {
    const a = new GameAudio();
    a.update({ ...defaultAudio, dynamic: false });
    await a.unlock();
    a.requestTheme("crisis", true);
    expect(a.diagnostics().theme).toBe("governance");
    a.requestTheme("ending", true);
    expect(a.diagnostics().theme).toBe("ending");
    a.destroy();
  });
  it("音频缺失、拒绝解锁或存储失败不会向游戏操作抛错", async () => {
    vi.stubGlobal(
      "AudioContext",
      class {
        constructor() {
          throw Error("audio unavailable");
        }
      },
    );
    const a = new GameAudio();
    await expect(a.unlock()).resolves.toBeUndefined();
    expect(() => a.effect("command")).not.toThrow();
    expect(a.diagnostics().failed).toBe(true);
    vi.stubGlobal("localStorage", {
      getItem() {
        throw Error("blocked");
      },
      setItem() {
        throw Error("blocked");
      },
    });
    expect(() => a.update(defaultAudio)).not.toThrow();
    expect(new GameAudio().settings).toEqual(defaultAudio);
    a.destroy();
  });
  it("损坏或越界音量回落或限幅，不能出现无效AudioParam", () => {
    expect(
      normalizeAudio({ master: 100, music: -2, effects: NaN }),
    ).toMatchObject({ master: 1, music: 0, effects: defaultAudio.effects });
    storage.set("federation-audio", "{bad-json");
    expect(readAudio()).toEqual(defaultAudio);
  });
});
