// Estilos compartidos de recharts (ejes, rejilla y tooltip) usados en todas las vistas.

export const AXIS = { stroke: "#52525b", fontSize: 11 } as const;

export const GRID = { stroke: "#26262f", strokeDasharray: "3 6" } as const;

export const TOOLTIP = {
  contentStyle: { background: "#1c1c26", border: "1px solid #2a2a38", borderRadius: 4, fontSize: 12 },
  labelStyle: { color: "#a1a1aa" },
  wrapperStyle: { zIndex: 50 },
} as const;
