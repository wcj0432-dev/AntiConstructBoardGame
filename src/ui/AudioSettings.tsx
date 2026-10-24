import type { AudioSettings as Settings } from "./audio";
export function AudioSettings({
  value,
  onChange,
  onTest,
}: {
  value: Settings;
  onChange: (s: Settings) => void;
  onTest: () => void;
}) {
  return (
    <section className="audio-settings">
      <h3>声音与无障碍</h3>
      {(
        [
          ["master", "总音量"],
          ["music", "音乐音量"],
          ["effects", "音效音量"],
        ] as const
      ).map(([key, label]) => (
        <label className="v2-field" key={key}>
          {label}
          <input
            aria-label={label}
            type="range"
            min="0"
            max="100"
            value={Math.round(value[key] * 100)}
            onChange={(e) =>
              onChange({ ...value, [key]: Number(e.target.value) / 100 })
            }
          />
          <output>{Math.round(value[key] * 100)}%</output>
        </label>
      ))}
      {(
        [
          ["muted", "全部静音"],
          ["musicMuted", "音乐静音"],
          ["effectsMuted", "音效静音"],
          ["dynamic", "动态音乐"],
          ["quiet", "减少频繁提示音"],
        ] as const
      ).map(([key, label]) => (
        <label className="v2-checkbox" key={key}>
          <input
            type="checkbox"
            checked={value[key]}
            onChange={(e) => onChange({ ...value, [key]: e.target.checked })}
          />
          {label}
        </label>
      ))}
      <button onClick={onTest}>试听政务音效</button>
      <p>
        五组原创合成主题与程序音效在本地生成。首次点击后启用；声音不可用时，所有操作与视觉提示仍可使用。
      </p>
    </section>
  );
}
