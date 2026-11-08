"use client"; // Sustituye al layout raíz cuando falla: necesita su propio <html> y <body>

export default function GlobalError({
  unstable_retry,
}: {
  error: Error & { digest?: string };
  unstable_retry: () => void;
}) {
  return (
    <html lang="es">
      <body
        style={{
          margin: 0,
          minHeight: "100dvh",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: 16,
          background: "#0a0a0f",
          color: "#f5f5f7",
          fontFamily: "system-ui, sans-serif",
        }}
      >
        <h1 style={{ fontSize: 22, margin: 0 }}>DeltaZero no ha podido arrancar</h1>
        <button
          onClick={() => unstable_retry()}
          style={{
            height: 44,
            padding: "0 24px",
            borderRadius: 999,
            border: 0,
            background: "#e10600",
            color: "#fff",
            fontWeight: 700,
            cursor: "pointer",
          }}
        >
          Reintentar
        </button>
      </body>
    </html>
  );
}
