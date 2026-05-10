"use client";

import { useCallback, useEffect, useRef, useState, type RefObject } from "react";
import { readResponseJson } from "@/lib/jsonResponse";

export type RadioNowPlaying = { name: string; artists: string };

export type RadioSettingsSnapshot = {
  currentSongCount: number;
  stationBreakTarget: number | null;
};

export type SettingsApplyResult = RadioSettingsSnapshot & {
  spotifyPlaylistId: string | null;
  hasAuthToken: boolean;
};

type StationItem = { id: number; fileName: string; filePath: string };

function randomBlockSize(): 5 | 6 {
  return Math.random() < 0.5 ? 5 : 6;
}

type UseRadioArgs = {
  broadcastOn: boolean;
  deviceId: string | null;
  player: Spotify.Player | null;
  hasAuthToken: boolean;
  playlistId: string | null;
  settings: RadioSettingsSnapshot;
  applySettings: (patch: Record<string, unknown>) => Promise<SettingsApplyResult>;
  onStationNowPlaying: (track: RadioNowPlaying | null) => void;
  audioRef: RefObject<HTMLAudioElement | null>;
  /** Current UI volume 0–1 for station ID playback */
  stationVolumeRef: RefObject<number>;
};

export function useRadio({
  broadcastOn,
  deviceId,
  player,
  hasAuthToken,
  playlistId,
  settings,
  applySettings,
  onStationNowPlaying,
  audioRef,
  stationVolumeRef,
}: UseRadioArgs): { phase: "music" | "station_id"; skipStationSegment: () => void } {
  const [phase, setPhase] = useState<"music" | "station_id">("music");

  const lastSpotifyTrackIdRef = useRef<string | null>(null);
  const playingStationRef = useRef(false);
  const skipNextTransitionRef = useRef(false);
  const broadcastOnRef = useRef(broadcastOn);
  const deviceIdRef = useRef(deviceId);
  const playerRef = useRef(player);
  const settingsRef = useRef(settings);
  const applySettingsRef = useRef(applySettings);
  const onStationNowPlayingRef = useRef(onStationNowPlaying);
  const hasAuthTokenRef = useRef(hasAuthToken);
  const playlistIdRef = useRef(playlistId);
  const listenerPlayerRef = useRef<Spotify.Player | null>(null);
  /** Avoids playing the same station file twice in a row when multiple exist (server also excludes this id). */
  const lastStationPickIdRef = useRef<number | null>(null);
  /** Completes the current station-ID segment (increment + resume Spotify); no-op if none active. */
  const completeStationSegmentRef = useRef<(() => Promise<void>) | null>(null);
  /** Serializes async work from Spotify `player_state_changed` (callbacks are not awaited by the SDK). */
  let stateHandlingChain = Promise.resolve();

  broadcastOnRef.current = broadcastOn;
  deviceIdRef.current = deviceId;
  playerRef.current = player;
  settingsRef.current = settings;
  applySettingsRef.current = applySettings;
  onStationNowPlayingRef.current = onStationNowPlaying;
  hasAuthTokenRef.current = hasAuthToken;
  playlistIdRef.current = playlistId;

  useEffect(() => {
    if (broadcastOn) return;
    playingStationRef.current = false;
    completeStationSegmentRef.current = null;
    setPhase("music");
    const p = playerRef.current;
    if (p) {
      void p.setVolume(Math.min(1, Math.max(0, stationVolumeRef.current))).catch(() => {});
    }
    const a = audioRef.current;
    if (a) {
      a.pause();
      a.removeAttribute("src");
      a.load();
    }
  }, [broadcastOn, audioRef]);

  useEffect(() => {
    if (!player) return;
    if (listenerPlayerRef.current !== player) {
      listenerPlayerRef.current = player;
      lastSpotifyTrackIdRef.current = null;
      skipNextTransitionRef.current = false;
    }

    const runStationBreak = async () => {
      const p = playerRef.current;
      const dev = deviceIdRef.current;
      if (!p || !dev) return;

      playingStationRef.current = true;
      setPhase("station_id");

      /** Silence Web Playback immediately; Spotify can still slip tracks forward while "paused". */
      try {
        await p.setVolume(0);
      } catch {
        /* ignore */
      }

      try {
        await p.pause();
      } catch {
        /* ignore */
      }

      try {
        await fetch("/api/spotify/pause", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ deviceId: dev }),
        });
      } catch {
        /* ignore network / API errors */
      }

      const nextTarget = randomBlockSize();
      await applySettingsRef.current({
        currentSongCount: 0,
        stationBreakTarget: nextTarget,
      });

      const excludeQ =
        lastStationPickIdRef.current != null
          ? `?exclude=${encodeURIComponent(String(lastStationPickIdRef.current))}`
          : "";
      const res = await fetch(`/api/station-ids/next${excludeQ}`, { cache: "no-store" });
      const data = (await readResponseJson(res)) as { item?: StationItem | null; error?: string };
      const pick = data.item ?? null;

      const resumeSpotify = async () => {
        const uiVol = Math.min(1, Math.max(0, stationVolumeRef.current));
        const sdk = playerRef.current;
        skipNextTransitionRef.current = true;
        playingStationRef.current = false;
        setPhase("music");
        onStationNowPlayingRef.current(null);
        try {
          const pr = await fetch("/api/spotify/play-random", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ deviceId: dev }),
          });
          const prJson = (await readResponseJson(pr)) as {
            track?: { name: string; artists: string };
            error?: string;
          };
          if (prJson.track) {
            onStationNowPlayingRef.current({
              name: prJson.track.name,
              artists: prJson.track.artists,
            });
          }
        } finally {
          try {
            await sdk?.setVolume(uiVol);
          } catch {
            /* ignore */
          }
        }
      };

      if (!pick) {
        completeStationSegmentRef.current = null;
        onStationNowPlayingRef.current(null);
        await resumeSpotify();
        return;
      }

      lastStationPickIdRef.current = pick.id;
      const label = pick.fileName.replace(/\.[^./\\]+$/, "");
      onStationNowPlayingRef.current({ name: label, artists: "Station ID" });

      const audio = audioRef.current;
      if (!audio) {
        completeStationSegmentRef.current = null;
        playingStationRef.current = false;
        setPhase("music");
        await resumeSpotify();
        return;
      }

      audio.src = pick.filePath;
      audio.volume = Math.min(1, Math.max(0, stationVolumeRef.current));
      audio.load();

      let segmentFinished = false;
      const finishSegment = async () => {
        if (segmentFinished) return;
        segmentFinished = true;
        completeStationSegmentRef.current = null;
        audio.removeEventListener("ended", onEnded);
        if (!broadcastOnRef.current) {
          playingStationRef.current = false;
          setPhase("music");
          return;
        }
        void fetch(`/api/station-ids/${pick.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ incrementPlayCount: true }),
        });
        await resumeSpotify();
      };

      const onEnded = () => {
        void finishSegment();
      };

      completeStationSegmentRef.current = finishSegment;

      audio.addEventListener("ended", onEnded);
      try {
        await audio.play();
      } catch {
        completeStationSegmentRef.current = null;
        playingStationRef.current = false;
        setPhase("music");
        await resumeSpotify();
      }
    };

    const onState = (state: Spotify.PlaybackState | null) => {
      stateHandlingChain = stateHandlingChain
        .then(async () => {
          if (!broadcastOnRef.current || playingStationRef.current) return;
          if (!hasAuthTokenRef.current || !playlistIdRef.current) return;

          const cur = state?.track_window?.current_track?.id ?? null;
          if (!cur) return;

          if (skipNextTransitionRef.current) {
            skipNextTransitionRef.current = false;
            lastSpotifyTrackIdRef.current = cur;
            return;
          }

          const prev = lastSpotifyTrackIdRef.current;
          if (prev === null) {
            lastSpotifyTrackIdRef.current = cur;
            return;
          }
          if (prev === cur) return;

          lastSpotifyTrackIdRef.current = cur;

          let ctx = settingsRef.current;
          let target = ctx.stationBreakTarget;
          if (target !== 5 && target !== 6) {
            ctx = await applySettingsRef.current({ stationBreakTarget: randomBlockSize() });
            target = ctx.stationBreakTarget;
          }
          if (target !== 5 && target !== 6) return;

          const newCount = ctx.currentSongCount + 1;
          ctx = await applySettingsRef.current({ currentSongCount: newCount });

          if (newCount >= target) {
            await runStationBreak();
          }
        })
        .catch(() => {});
    };

    player.addListener("player_state_changed", onState);
    return () => {
      player.removeListener("player_state_changed", onState);
    };
  }, [player, audioRef]);

  const skipStationSegment = useCallback(() => {
    if (!playingStationRef.current) return;
    const audio = audioRef.current;
    audio?.pause();
    const run = completeStationSegmentRef.current;
    if (run) void run();
  }, [audioRef]);

  return { phase, skipStationSegment };
}
