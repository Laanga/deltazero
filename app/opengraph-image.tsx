import { ImageResponse } from "next/og";

export const alt = "DeltaZero — Análisis de Fórmula 1";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OpengraphImage() {
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
          background: "#15151e",
          backgroundImage:
            "radial-gradient(circle at 75% 30%, rgba(225,6,0,0.22), transparent 55%)",
          color: "#ffffff",
          fontFamily: "sans-serif",
        }}
      >
        <div style={{ display: "flex", height: 10, width: 160, background: "#e10600", marginBottom: 36 }} />
        <div style={{ display: "flex", fontSize: 132, fontWeight: 900, letterSpacing: -2, lineHeight: 1 }}>
          <span>Delta</span>
          <span style={{ color: "#e10600" }}>Zero</span>
        </div>
        <div style={{ marginTop: 28, fontSize: 40, color: "#a1a1aa", maxWidth: 900 }}>
          Telemetría, comparativas y estrategia de Fórmula 1 con datos reales
        </div>
      </div>
    ),
    { ...size },
  );
}
