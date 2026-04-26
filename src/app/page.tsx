import { Suspense } from "react";
import { SpotifyPlaybackPanel } from "@/components/Player";

export default function Home() {
  return (
    <div className="flex min-h-full flex-1 flex-col items-center justify-center bg-[radial-gradient(ellipse_at_top,_#3d2918_0%,_#1a120c_45%,_#0c0a09_100%)] px-4 pb-[max(2rem,env(safe-area-inset-bottom))] pt-[max(2rem,env(safe-area-inset-top))]">
      <Suspense
        fallback={
          <div className="text-sm text-zinc-500 dark:text-zinc-400">Loading…</div>
        }
      >
        <SpotifyPlaybackPanel />
      </Suspense>
    </div>
  );
}
