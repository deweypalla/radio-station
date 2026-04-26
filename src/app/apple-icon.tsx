import { ImageResponse } from "next/og";

export const runtime = "edge";

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

/** iOS home screen icon. */
export default function AppleIcon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: "#3d2918",
          fontFamily:
            "ui-sans-serif, system-ui, -apple-system, Segoe UI, sans-serif",
        }}
      >
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            width: 140,
            height: 140,
            borderRadius: 28,
            backgroundColor: "#1a120c",
            border: "4px solid #5c4033",
          }}
        >
          <div style={{ fontSize: 44, fontWeight: 700, color: "#6ee7b7" }}>FM</div>
          <div style={{ fontSize: 16, fontWeight: 600, color: "#fcd34d", marginTop: 4 }}>
            WPRD
          </div>
        </div>
      </div>
    ),
    { ...size },
  );
}
