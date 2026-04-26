"use client";

import { Share_Tech_Mono } from "next/font/google";

const lcd = Share_Tech_Mono({
  weight: "400",
  subsets: ["latin"],
});

export type RadioFaceProps = {
  poweredOn: boolean;
  onPowerChange: (on: boolean) => void;
  powerDisabled?: boolean;
  /** 0–1 */
  volume: number;
  onVolumeChange: (volume: number) => void;
  onSkip: () => void;
  skipDisabled?: boolean;
  /** Spotify music phase: true when playback is paused. */
  transportPaused: boolean;
  onTransportToggle: () => void;
  transportDisabled: boolean;
  nowPlaying: { name: string; artists: string } | null;
  radioPhase: "music" | "station_id";
  blockProgress: number;
  blockTarget: number | null;
  onOpenMixer: () => void;
  statusLine?: string | null;
  error?: string | null;
  /** Shown when not in error state and no track title (default: "— standby —"). */
  standbyMessage?: string;
};

export function RadioFace({
  poweredOn,
  onPowerChange,
  powerDisabled,
  volume,
  onVolumeChange,
  onSkip,
  skipDisabled,
  transportPaused,
  onTransportToggle,
  transportDisabled,
  nowPlaying,
  radioPhase,
  blockProgress,
  blockTarget,
  onOpenMixer,
  statusLine,
  error,
  standbyMessage = "— standby —",
}: RadioFaceProps) {
  const pct = Math.round(volume * 100);

  return (
    <div className="relative w-full max-w-md select-none">
      <button
        type="button"
        onClick={onOpenMixer}
        className="absolute -right-1 -top-1 z-10 flex h-12 w-12 min-h-[48px] min-w-[48px] items-center justify-center rounded-full bg-zinc-800 text-zinc-200 shadow-lg ring-2 ring-amber-950/50 transition hover:bg-zinc-700 active:scale-95"
        aria-label="Open mixer settings"
      >
        <span className="text-lg leading-none" aria-hidden>
          ≡
        </span>
      </button>

      <div
        className="rounded-[2rem] p-6 shadow-[inset_0_2px_12px_rgba(0,0,0,0.45),0_24px_48px_rgba(0,0,0,0.35)]"
        style={{
          background:
            "linear-gradient(165deg, #5c4033 0%, #3d2918 18%, #2a1a0f 50%, #1f140c 100%)",
        }}
      >
        <div className="rounded-2xl border border-amber-950/60 bg-black/25 p-5 shadow-inner">
          <div className="mb-5 flex items-start justify-between gap-4">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.35em] text-amber-200/50">
                FM Stereo
              </p>
              <p className="mt-0.5 max-w-[11rem] font-serif text-base italic leading-tight text-amber-100/90 sm:max-w-none sm:text-lg">
                105.1 Resurrected
              </p>
            </div>
            <div className="flex flex-col items-end gap-1">
              <span className="text-[9px] uppercase tracking-wider text-amber-200/40">
                Power
              </span>
              <button
                type="button"
                role="switch"
                aria-checked={poweredOn}
                disabled={powerDisabled}
                onClick={() => onPowerChange(!poweredOn)}
                className="flex min-h-[48px] min-w-[48px] items-center justify-center rounded-full p-2 ring-2 ring-transparent transition hover:ring-amber-900/30 disabled:opacity-40"
                aria-label={poweredOn ? "Turn power off" : "Turn power on"}
              >
                <span className="relative h-14 w-8 rounded-full bg-gradient-to-b from-zinc-700 to-zinc-900 shadow-[inset_0_2px_4px_rgba(255,255,255,0.12),0_4px_8px_rgba(0,0,0,0.5)] ring-2 ring-black/40">
                  <span
                    className={`absolute left-1/2 top-1 h-6 w-6 -translate-x-1/2 rounded-full bg-gradient-to-b shadow-md transition-all duration-200 ${
                      poweredOn
                        ? "top-1 from-emerald-400 to-emerald-700 shadow-emerald-900/50"
                        : "top-7 from-zinc-300 to-zinc-500 shadow-black/40"
                    }`}
                  />
                </span>
              </button>
            </div>
          </div>

          <div
            className={`mb-5 rounded-lg border-2 px-3 py-3 shadow-[inset_0_0_20px_rgba(0,0,0,0.85)] ${lcd.className} ${
              radioPhase === "station_id"
                ? "border-amber-700/50 bg-[#1a1510]"
                : "border-emerald-900/40 bg-[#0c1812]"
            }`}
          >
            <p className="text-[9px] uppercase tracking-[0.2em] text-emerald-500/70">
              Now playing
            </p>
            {error ? (
              <p className="mt-1 line-clamp-3 text-sm leading-snug text-red-400/90">{error}</p>
            ) : nowPlaying ? (
              <p className="mt-1 line-clamp-3 text-base leading-snug tracking-wide text-emerald-400/95">
                <span className="text-emerald-300">{nowPlaying.name}</span>
                <span className="block text-sm text-emerald-600/90">{nowPlaying.artists}</span>
              </p>
            ) : (
              <p className="mt-1 text-sm text-emerald-700/80">{standbyMessage}</p>
            )}
            {statusLine ? (
              <p className="mt-2 border-t border-emerald-900/30 pt-2 text-[11px] text-emerald-600/80">
                {statusLine}
              </p>
            ) : null}
          </div>

          <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div className="min-h-[44px] min-w-0 flex-1 py-1">
              <label className="mb-1.5 flex items-center justify-between text-[10px] font-semibold uppercase tracking-wider text-amber-200/45">
                <span>Volume</span>
                <span className={lcd.className}>{pct}</span>
              </label>
              <input
                type="range"
                min={0}
                max={100}
                value={pct}
                onChange={(e) => onVolumeChange(Number(e.target.value) / 100)}
                className="h-4 w-full cursor-pointer appearance-none rounded-full bg-black/50 accent-amber-500"
              />
            </div>
            <div className="flex shrink-0 flex-wrap items-end justify-end gap-2">
              <button
                type="button"
                onClick={onTransportToggle}
                disabled={transportDisabled}
                className={`min-h-12 min-w-[5.5rem] rounded-xl px-4 py-3 text-sm font-bold uppercase tracking-wider shadow-lg transition ${
                  transportDisabled
                    ? "bg-zinc-800/50 text-zinc-600"
                    : "bg-gradient-to-b from-zinc-600 to-zinc-800 text-zinc-100 shadow-black/40 hover:from-zinc-500 hover:to-zinc-700 active:scale-[0.98]"
                }`}
                aria-label={transportPaused ? "Play Spotify" : "Pause Spotify"}
              >
                {transportPaused ? "Play" : "Pause"}
              </button>
              <button
                type="button"
                onClick={onSkip}
                disabled={skipDisabled}
                className={`min-h-12 min-w-[48px] rounded-xl px-6 py-3 text-sm font-bold uppercase tracking-widest shadow-lg transition ${
                  skipDisabled
                    ? "bg-zinc-800/50 text-zinc-600"
                    : "bg-gradient-to-b from-amber-700 to-amber-900 text-amber-100 shadow-amber-950/50 hover:from-amber-600 hover:to-amber-800 active:scale-[0.98]"
                }`}
              >
                Skip
              </button>
            </div>
          </div>

          <div className="mt-5 flex justify-center gap-2 opacity-40" aria-hidden>
            {Array.from({ length: 5 }).map((_, i) => (
              <div
                key={i}
                className="h-2 w-2 rounded-full bg-amber-900 shadow-inner"
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
