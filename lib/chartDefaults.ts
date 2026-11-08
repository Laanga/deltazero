// Estilos compartidos de recharts (ejes, rejilla y tooltip) usados en todas las vistas.

export const AXIS = { stroke: "#5a5a66", fontSize: 11, tickLine: false, axisLine: false } as const;

export const GRID = {
  stroke: "rgb(255 255 255 / 0.06)",
  strokeDasharray: "2 6",
  vertical: false,
} as const;

export const TOOLTIP = {
  contentStyle: {
    background: "rgb(24 24 32 / 0.88)",
    backdropFilter: "blur(16px) saturate(160%)",
    WebkitBackdropFilter: "blur(16px) saturate(160%)",
    border: "1px solid rgb(255 255 255 / 0.1)",
    borderRadius: 16,
    boxShadow: "0 16px 40px -12px rgb(0 0 0 / 0.7)",
    fontSize: 12,
    padding: "8px 12px",
  },
  labelStyle: { color: "#a1a1aa", marginBottom: 4 },
  itemStyle: { padding: "1px 0" },
  wrapperStyle: { zIndex: 50 },
} as const;
