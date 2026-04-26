import { ImageResponse } from "next/og";

export const runtime = "edge";

export const size = { width: 512, height: 512 };
export const contentType = "image/png";

/** App icon / PWA icon (skeuomorphic radio palette). */
export default function Icon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: "#3d2918",
          color: "#6ee7b7",
          fontFamily:
            "ui-sans-serif, system-ui, -apple-system, Segoe UI, sans-serif",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            width: 380,
            height: 380,
            borderRadius: 48,
            backgroundColor: "#1a120c",
            border: "8px solid #5c4033",
            boxShadow: "inset 0 4px 24px rgba(0,0,0,0.5)",
          }}
        >
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
            }}
          >
            <div style={{ fontSize: 120, fontWeight: 700, lineHeight: 1 }}>FM</div>
            <div
              style={{
                fontSize: 42,
                fontWeight: 600,
                color: "#fcd34d",
                marginTop: 12,
                letterSpacing: "0.2em",
              }}
            >
              WPRD
            </div>
          </div>
        </div>
      </div>
    ),
    { ...size },
  );
}
