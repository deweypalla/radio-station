import { cookies } from "next/headers";
import { type NextRequest, NextResponse } from "next/server";
import { ensureSettingsRow } from "@/lib/db";
import {
  exchangeAuthorizationCode,
  persistSpotifyTokens,
  resolveSpotifyRedirectUriForCallback,
  SPOTIFY_OAUTH_REDIRECT_COOKIE,
} from "@/lib/spotify";

const STATE_COOKIE = "spotify_oauth_state";

export async function GET(request: NextRequest) {
  const origin = new URL(request.url).origin;
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const oauthError = url.searchParams.get("error");

  if (oauthError) {
    return NextResponse.redirect(
      new URL(`/?spotify_error=${encodeURIComponent(oauthError)}`, origin),
    );
  }

  if (!code || !state) {
    return NextResponse.redirect(
      new URL("/?spotify_error=missing_code_or_state", origin),
    );
  }

  const cookieStore = await cookies();
  const expected = cookieStore.get(STATE_COOKIE)?.value;
  const storedRedirect = cookieStore.get(SPOTIFY_OAUTH_REDIRECT_COOKIE)?.value;
  cookieStore.delete(STATE_COOKIE);
  cookieStore.delete(SPOTIFY_OAUTH_REDIRECT_COOKIE);

  if (!expected || expected !== state) {
    return NextResponse.redirect(new URL("/?spotify_error=invalid_state", origin));
  }

  try {
    await ensureSettingsRow();
    const redirectUri = resolveSpotifyRedirectUriForCallback(request, storedRedirect);
    const tokens = await exchangeAuthorizationCode(code, redirectUri);
    await persistSpotifyTokens(tokens);
    return NextResponse.redirect(new URL("/?spotify=connected", origin));
  } catch (e) {
    const message = e instanceof Error ? e.message : "token_exchange_failed";
    return NextResponse.redirect(
      new URL(`/?spotify_error=${encodeURIComponent(message)}`, origin),
    );
  }
}
