import { ImageResponse } from "next/og";

export const alt = "Solun - Privacy at its highest";
export const size = {
  width: 1200,
  height: 630
};
export const contentType = "image/png";

export default function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          padding: "80px",
          background: "linear-gradient(135deg, #0b101a 0%, #0f2436 50%, #0b101a 100%)",
          color: "#f5f7ff",
          fontFamily: "Space Grotesk, ui-sans-serif, system-ui, sans-serif"
        }}
      >
        <div style={{ fontSize: 60, letterSpacing: "-0.02em", fontWeight: 600 }}>Solun</div>
        <div style={{ fontSize: 34, marginTop: 14, maxWidth: 740, lineHeight: 1.2 }}>
          Privacy at its highest
        </div>
        <div style={{ marginTop: 26, fontSize: 22, color: "rgba(198, 210, 255, 0.75)" }}>
          Secure paste and file sharing with short-lived links
        </div>
      </div>
    ),
    {
      ...size
    }
  );
}
