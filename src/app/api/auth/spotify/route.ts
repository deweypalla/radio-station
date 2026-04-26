import { randomBytes } from "crypto";
import { cookies } from "next/headers";
import { type NextRequest, NextResponse } from "next/server";
import {
  buildSpotifyAuthorizeUrl,
  getSpotifyRedirectUri,
  SPOTIFY_OAUTH_REDIRECT_COOKIE,
} from "@/lib/spotify";

const STATE_COOKIE = "spotify_oauth_state";

const cookieOpts = {
  httpOnly: true,
  sameSite: "lax" as const,
  secure: process.env.NODE_ENV === "production",
  path: "/",
  maxAge: 600,
};

export async function GET(request: NextRequest) {
  const origin = new URL(request.url).origin;
  try {
    const state = randomBytes(24).toString("hex");
    const cookieStore = await cookies();
    cookieStore.set(STATE_COOKIE, state, cookieOpts);
    const redirectUri = getSpotifyRedirectUri(request);
    cookieStore.set(SPOTIFY_OAUTH_REDIRECT_COOKIE, redirectUri, cookieOpts);
    const url = buildSpotifyAuthorizeUrl(state, redirectUri);
    return NextResponse.redirect(url);
  } catch (e) {
    const message = e instanceof Error ? e.message : "OAuth start failed";
    return NextResponse.redirect(
      new URL(`/?spotify_error=${encodeURIComponent(message)}`, origin),
    );
  }
}
