"use client";

import Script from "next/script";
import { useSearchParams } from "next/navigation";
import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import { useRadio } from "@/hooks/useRadio";
import { Mixer } from "@/components/Mixer";
import { RadioFace } from "@/components/RadioFace";
import {
  DEFAULT_CROSSOVER_PLAYLIST_WEB_URL,
  resolvedSpotifyPlaylistId,
} from "@/lib/spotifyPlaylist";
import { readResponseJson } from "@/lib/jsonResponse";

type SettingsPayload = {
  spotifyPlaylistId: string | null;
  currentSongCount: number;
  stationBreakTarget: number | null;
  hasAuthToken: boolean;
};

type NowPlaying = { name: string; artists: string };

/** Web Playback SDK sometimes surfaces low-level JSON parse strings that are confusing in the UI. */
function humanizeSpotifySdkMessage(message: string): string {
  const m = message.trim();
  if (
    m.includes("Unexpected non-whitespace character after JSON") ||
    m.includes("Unexpected end of JSON input") ||
    m.includes("is not valid JSON")
  ) {
    return "Spotify reported a brief data glitch for this song. If playback sounds OK, ignore this; otherwise try Skip or toggle the radio off and on.";
  }
  return message;
}

async function readSettings(): Promise<SettingsPayload> {
  const res = await fetch("/api/settings");
  const data = (await readResponseJson(res)) as SettingsPayload & { error?: string };
  if (!res.ok) throw new Error(data.error ?? "Failed to load settings");
  return data;
}

export function SpotifyPlaybackPanel() {
  const searchParams = useSearchParams();
  const [settings, setSettings] = useState<SettingsPayload | null>(null);
  const [settingsError, setSettingsError] = useState<string | null>(null);
  const [sdkReady, setSdkReady] = useState(false);
  const [deviceId, setDeviceId] = useState<string | null>(null);
  const [playerHandle, setPlayerHandle] = useState<Spotify.Player | null>(null);
  const [nowPlaying, setNowPlaying] = useState<NowPlaying | null>(null);
  const [panelError, setPanelError] = useState<string | null>(null);
  const [playlistDraft, setPlaylistDraft] = useState("");
  const [savingPlaylist, setSavingPlaylist] = useState(false);
  const [broadcastOn, setBroadcastOn] = useState(false);
  const [spotifyTransportPaused, setSpotifyTransportPaused] = useState(false);
  const [mixerOpen, setMixerOpen] = useState(false);
  const [uiVolume, setUiVolume] = useState(0.85);
  const stationAudioRef = useRef<HTMLAudioElement | null>(null);
  const radioPhaseRef = useRef<"music" | "station_id">("music");
  const lastSdkTrackIdRef = useRef<string | null>(null);
  const volumeRef = useRef(uiVolume);
  volumeRef.current = uiVolume;

  const refreshSettings = useCallback(() => {
    void readSettings()
      .then((s) => {
        setSettings(s);
        setSettingsError(null);
        const stored = s.spotifyPlaylistId?.trim();
        setPlaylistDraft(stored && stored !== "" ? stored : DEFAULT_CROSSOVER_PLAYLIST_WEB_URL);
      })
      .catch((e: unknown) => {
        setSettingsError(e instanceof Error ? e.message : "Settings error");
      });
  }, []);

  const applySettings = useCallback(async (patch: Record<string, unknown>) => {
    const res = await fetch("/api/settings", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    });
    const data = (await readResponseJson(res)) as SettingsPayload & { error?: string };
    if (!res.ok) throw new Error(data.error ?? "Settings update failed");
    setSettings(data);
    return data;
  }, []);

  const { phase: radioPhase, skipStationSegment } = useRadio({
    broadcastOn,
    deviceId,
    player: playerHandle,
    hasAuthToken: Boolean(settings?.hasAuthToken),
    playlistId: resolvedSpotifyPlaylistId(settings?.spotifyPlaylistId),
    settings: {
      currentSongCount: settings?.currentSongCount ?? 0,
      stationBreakTarget: settings?.stationBreakTarget ?? null,
    },
    applySettings,
    onStationNowPlaying: setNowPlaying,
    audioRef: stationAudioRef,
    stationVolumeRef: volumeRef,
  });

  useEffect(() => {
    radioPhaseRef.current = radioPhase;
  }, [radioPhase]);

  useEffect(() => {
    const a = stationAudioRef.current;
    if (a) a.volume = uiVolume;
  }, [uiVolume]);

  useEffect(() => {
    if (!playerHandle) return;
    void playerHandle.setVolume(uiVolume);
  }, [playerHandle, uiVolume]);

  useEffect(() => {
    refreshSettings();
  }, [refreshSettings]);

  useEffect(() => {
    const err = searchParams.get("spotify_error");
    if (err) setPanelError(err);
    if (searchParams.get("spotify") === "connected") {
      refreshSettings();
    }
  }, [searchParams, refreshSettings]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (window.Spotify) {
      setSdkReady(true);
      return;
    }
    window.onSpotifyWebPlaybackSDKReady = () => setSdkReady(true);
    return () => {
      Reflect.deleteProperty(window, "onSpotifyWebPlaybackSDKReady");
    };
  }, []);

  useEffect(() => {
    if (!sdkReady || !settings?.hasAuthToken) return;
    if (typeof window === "undefined" || !window.Spotify) return;

    const player = new window.Spotify.Player({
      name: "Radio Station Simulator",
      getOAuthToken: (cb) => {
        void fetch("/api/spotify/player-token")
          .then(async (res) => {
            const data = (await readResponseJson(res)) as { accessToken?: string; error?: string };
            if (!res.ok) {
              queueMicrotask(() =>
                setPanelError(data.error ?? `Spotify token request failed (${res.status})`),
              );
              cb("");
              return;
            }
            const token = data.accessToken?.trim() ?? "";
            if (!token) {
              queueMicrotask(() =>
                setPanelError(
                  "Spotify returned an empty token. Open the Mixer, disconnect, then connect again.",
                ),
              );
              cb("");
              return;
            }
            queueMicrotask(() => setPanelError(null));
            cb(token);
          })
          .catch((e: unknown) => {
            queueMicrotask(() =>
              setPanelError(
                e instanceof SyntaxError
                  ? "Could not read the Spotify token response. Try refreshing or reconnecting."
                  : e instanceof Error
                    ? e.message
                    : "Could not reach the server for a Spotify token.",
              ),
            );
            cb("");
          });
      },
      volume: volumeRef.current,
    });

    const onSdkMessage = ({ message }: { message: string }) => {
      setPanelError(humanizeSpotifySdkMessage(message));
    };
    const onPlaybackError = ({ message }: { message: string }) => {
      if (message.includes("no list was loaded")) return;
      setPanelError(humanizeSpotifySdkMessage(message));
    };

    const onReady = (ev: { device_id: string }) => {
      setDeviceId(ev.device_id);
      setPlayerHandle(player);
      setPanelError(null);
      void player.setVolume(volumeRef.current);
    };
    const onNotReady = () => {
      setDeviceId(null);
      setPlayerHandle(null);
    };
    const onState = (state: Spotify.PlaybackState | null) => {
      const inStation = radioPhaseRef.current === "station_id";
      if (!inStation) {
        const t = state?.track_window?.current_track;
        if (t) {
          if (lastSdkTrackIdRef.current !== t.id) {
            lastSdkTrackIdRef.current = t.id;
            setPanelError(null);
            setNowPlaying({
              name: t.name,
              artists: t.artists.map((a) => a.name).join(", "),
            });
          }
        }
      }
      if (state) {
        setSpotifyTransportPaused((prev) => (prev === state.paused ? prev : state.paused));
      }
    };

    player.addListener("ready", onReady);
    player.addListener("not_ready", onNotReady);
    player.addListener("player_state_changed", onState);
    player.addListener("initialization_error", onSdkMessage);
    player.addListener("authentication_error", onSdkMessage);
    player.addListener("account_error", onSdkMessage);
    player.addListener("playback_error", onPlaybackError);
    const onAutoplayFailed = () => {
      setPanelError(
        "Playback was blocked by the browser. Turn the radio power on (or click this page), then try again.",
      );
    };
    player.addListener("autoplay_failed", onAutoplayFailed);
    void player.connect();

    return () => {
      player.removeListener("ready", onReady);
      player.removeListener("not_ready", onNotReady);
      player.removeListener("player_state_changed", onState);
      player.removeListener("initialization_error", onSdkMessage);
      player.removeListener("authentication_error", onSdkMessage);
      player.removeListener("account_error", onSdkMessage);
      player.removeListener("playback_error", onPlaybackError);
      // "autoplay_failed" is supported by addListener but missing from removeListener in @types/spotify-web-playback-sdk; disconnect drops all listeners.
      void player.disconnect();
      setDeviceId(null);
      setPlayerHandle(null);
    };
  }, [sdkReady, settings?.hasAuthToken]);

  const effectivePlaylistId = resolvedSpotifyPlaylistId(settings?.spotifyPlaylistId);

  useEffect(() => {
    if (!deviceId || !settings?.hasAuthToken) return;

    let cancelled = false;
    void (async () => {
      try {
        const res = await fetch("/api/spotify/bootstrap", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ deviceId }),
        });
        const data = (await readResponseJson(res)) as {
          track?: { name: string; artists: string };
          error?: string;
        };
        if (!res.ok) throw new Error(data.error ?? "Could not start playback");
        if (!cancelled && data.track) {
          setNowPlaying({ name: data.track.name, artists: data.track.artists });
        }
      } catch (e) {
        if (!cancelled) {
          setPanelError(e instanceof Error ? e.message : "Playback failed");
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [deviceId, settings?.hasAuthToken, effectivePlaylistId]);

  /** Resume only after Spotify has a loaded track; avoids SDK "no list was loaded" from blind resume(). */
  useEffect(() => {
    if (!broadcastOn || !playerHandle) return;
    if (radioPhase === "station_id") return;
    if (radioPhaseRef.current === "station_id") return;

    const id = window.setTimeout(() => {
      void (async () => {
        if (radioPhaseRef.current === "station_id") return;
        try {
          try {
            await playerHandle.activateElement();
          } catch {
            /* ignore */
          }
          const state = await playerHandle.getCurrentState();
          if (state?.track_window?.current_track && state.paused) {
            await playerHandle.resume();
          }
        } catch {
          /* ignore */
        }
      })();
    }, 0);

    return () => clearTimeout(id);
  }, [broadcastOn, playerHandle, radioPhase]);

  async function savePlaylist(e: FormEvent) {
    e.preventDefault();
    setSavingPlaylist(true);
    setPanelError(null);
    try {
      const res = await fetch("/api/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          spotifyPlaylistId: playlistDraft.trim() === "" ? null : playlistDraft.trim(),
        }),
      });
      const data = (await readResponseJson(res)) as SettingsPayload & { error?: string };
      if (!res.ok) throw new Error(data.error ?? "Save failed");
      setSettings(data);
    } catch (err) {
      setPanelError(err instanceof Error ? err.message : "Save failed");
    } finally {
      setSavingPlaylist(false);
    }
  }

  async function disconnect() {
    setPanelError(null);
    setBroadcastOn(false);
    try {
      const res = await fetch("/api/spotify/disconnect", { method: "POST" });
      if (!res.ok) {
        const data = (await readResponseJson(res)) as { error?: string };
        throw new Error(data.error ?? "Disconnect failed");
      }
      setNowPlaying(null);
      refreshSettings();
    } catch (err) {
      setPanelError(err instanceof Error ? err.message : "Disconnect failed");
    }
  }

  function setPoweredOn(on: boolean) {
    setBroadcastOn(on);
    if (!playerHandle) return;
    if (!on) void playerHandle.pause().catch(() => {});
  }

  function onTransportToggle() {
    if (!playerHandle || radioPhase === "station_id" || !broadcastOn || !powerReady) return;
    void playerHandle.togglePlay().catch(() => {});
  }

  function onSkip() {
    if (radioPhase === "station_id") {
      skipStationSegment();
      return;
    }
    if (!deviceId) return;
    void fetch("/api/spotify/skip-next", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ deviceId }),
    })
      .then(async (res) => {
        if (res.ok) return;
        const data = (await readResponseJson(res)) as { error?: string };
        setPanelError(data.error ?? "Skip failed");
      })
      .catch(() => setPanelError("Skip failed"));
  }

  const blockTarget = settings?.stationBreakTarget;
  const blockProgress = settings?.currentSongCount ?? 0;
  const powerReady = Boolean(settings?.hasAuthToken && deviceId && effectivePlaylistId);
  const transportDisabled =
    !powerReady || !broadcastOn || radioPhase === "station_id";
  const displayError = settingsError ?? panelError;

  const standbyMessage = (() => {
    if (!settings?.hasAuthToken) return "Open the mixer (≡) and connect Spotify.";
    if (!deviceId) return "Connecting Spotify in this browser…";
    if (!nowPlaying) {
      if (!broadcastOn) {
        return "Turn the radio on. Spotify usually needs that tap before audio can start.";
      }
      return "Loading a random track from your playlist…";
    }
    return "— standby —";
  })();

  const statusLine =
    broadcastOn && settings?.hasAuthToken
      ? `Block: ${blockProgress} toward break${blockTarget != null ? ` / ${blockTarget}` : ""}${
          radioPhase === "station_id" ? " · AIRCHECK" : ""
        }`
      : null;

  return (
    <div className="flex flex-col items-center gap-6">
      <Script src="https://sdk.scdn.co/spotify-player.js" strategy="afterInteractive" />
      <audio ref={stationAudioRef} className="hidden" preload="auto" />

      <RadioFace
        poweredOn={broadcastOn}
        onPowerChange={setPoweredOn}
        powerDisabled={!powerReady}
        volume={uiVolume}
        onVolumeChange={setUiVolume}
        onSkip={onSkip}
        skipDisabled={!powerReady || !broadcastOn}
        transportPaused={spotifyTransportPaused}
        onTransportToggle={onTransportToggle}
        transportDisabled={transportDisabled}
        nowPlaying={nowPlaying}
        radioPhase={radioPhase}
        blockProgress={blockProgress}
        blockTarget={blockTarget ?? null}
        onOpenMixer={() => setMixerOpen(true)}
        statusLine={statusLine}
        error={displayError}
        standbyMessage={standbyMessage}
      />

      <Mixer
        open={mixerOpen}
        onClose={() => setMixerOpen(false)}
        settings={settings}
        playlistDraft={playlistDraft}
        onPlaylistDraftChange={setPlaylistDraft}
        onSavePlaylist={savePlaylist}
        savingPlaylist={savingPlaylist}
        onDisconnect={disconnect}
        onRefreshSettings={refreshSettings}
      />

      <p className="max-w-md text-center text-xs text-zinc-500 dark:text-zinc-500">
        Web Playback requires Spotify Premium. Use the mixer (≡) for playlist, station files, and
        account.
      </p>
    </div>
  );
}
