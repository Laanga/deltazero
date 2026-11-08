import { describe, expect, it } from "vitest";

import { paramsToSelection, selectionToParams } from "./sessionStore";

describe("selección ⇄ URL", () => {
  const sel = {
    year: 2025,
    gp: "Monaco Grand Prix",
    session: "Q",
    selectedDrivers: ["VER", "NOR"],
    lap: "12",
    tab: "laps" as const,
  };

  it("ida y vuelta sin pérdidas", () => {
    expect(paramsToSelection(selectionToParams(sel))).toEqual(sel);
  });

  it("omite los valores por defecto", () => {
    const qs = selectionToParams({
      ...sel,
      selectedDrivers: [],
      lap: "fastest",
      tab: "telemetry",
    }).toString();
    expect(qs).toBe("y=2025&gp=Monaco+Grand+Prix&s=Q");
  });

  it("sanea entradas manipuladas", () => {
    const p = new URLSearchParams(
      "y=2025&gp=X&s=R&d=VER,<script>,nor,AAA,BBB,CCC,DDD&lap=abc&tab=hack",
    );
    const out = paramsToSelection(p)!;
    expect(out.selectedDrivers).toEqual(["VER", "NOR", "AAA", "BBB", "CCC"]);
    expect(out.lap).toBe("fastest");
    expect(out.tab).toBe("telemetry");
  });

  it("rechaza años fuera de rango", () => {
    expect(paramsToSelection(new URLSearchParams("y=1999&gp=X"))).toBeNull();
    expect(paramsToSelection(new URLSearchParams("gp=X"))).toBeNull();
  });
});
