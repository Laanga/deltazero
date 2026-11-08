import { describe, expect, it } from "vitest";

import {
  alignedIndex,
  alignedValue,
  deltaSeries,
  gainSegments,
  gapMetersAtTime,
  lapStats,
  rivalColor,
  sectorDeltas,
  zoneGains,
} from "./duel";
import { anchorLap, valueAtDistance } from "./f1math";
import type { TelemetryData } from "./types";

/** Vuelta sintética a velocidad constante (m/s) con rejilla cada `step` metros. */
function lapAt(driver: string, length: number, speedMs: number, step = 5): TelemetryData {
  const distance: number[] = [];
  for (let d = 0; d < length; d += step) distance.push(d);
  distance.push(length);
  return {
    driver,
    lap_number: 1,
    lap_time: length / speedMs,
    compound: null,
    sectors: { s1: length / 3 / speedMs, s2: length / 3 / speedMs, s3: length / 3 / speedMs },
    channels: {
      distance,
      time: distance.map((d) => d / speedMs),
      speed: distance.map(() => speedMs * 3.6),
      rpm: distance.map(() => 10000),
      throttle: distance.map(() => 100),
      brake: distance.map(() => 0),
      gear: distance.map(() => 7),
      drs: distance.map(() => 0),
    },
    track: null,
  };
}

describe("anchorLap", () => {
  it("el reloj empieza en 0 y termina exactamente en el tiempo oficial", () => {
    // Primera muestra 0,2 s tarde, última 0,25 s antes del final; 50 m/s constantes
    const times = [0.2, 1, 2, 3, 4, 4.75];
    const a = anchorLap(times, 5, { speed: times.map(() => 180) });
    expect(a.t[0]).toBe(0);
    expect(a.t.at(-1)).toBe(5);
    expect(a.d[0]).toBe(0);
    expect(a.d.at(-1)).toBeCloseTo(250); // 50 m/s × 5 s
    expect(valueAtDistance(a.d, a.t, 100)).toBeCloseTo(2);
  });
});

describe("alineación por fracción de vuelta", () => {
  // Mismo ritmo, pero el rival "mide" la vuelta un 1 % más larga (error de integración)
  const ref = lapAt("REF", 5000, 50);
  const rival = { ...lapAt("RIV", 5050, 50.5) };

  it("delta nulo en toda la vuelta cuando la única diferencia es la longitud integrada", () => {
    const d = deltaSeries(ref, rival);
    expect(Math.max(...d.map(Math.abs))).toBeLessThan(1e-9);
  });

  it("el índice alineado cae en la misma fracción de vuelta", () => {
    const i = ref.channels.distance.indexOf(2500);
    const j = alignedIndex(ref, rival, i);
    expect(rival.channels.distance[j]).toBeCloseTo(2525, 0);
    expect(alignedValue(ref, rival, "time", i)).toBeCloseTo(ref.channels.time[i]);
  });
});

describe("anclajes por sector", () => {
  it("con error de integración no uniforme, el delta en cada línea de sector es el oficial", () => {
    const ref = lapAt("REF", 3000, 50); // 60 s, sectores de 20 s
    // Rival: mismo ritmo real, pero su distancia integrada "se estira" un 6 % solo en el S1
    const base = lapAt("RIV", 3000, 50);
    const stretch = (d: number) => (d <= 1000 ? d * 1.06 : d + 60);
    const rival: TelemetryData = {
      ...base,
      lap_time: 60.3,
      sectors: { s1: 20.1, s2: 20.1, s3: 20.1 },
      channels: {
        ...base.channels,
        distance: base.channels.distance.map(stretch),
        time: base.channels.time.map((t) => t * (60.3 / 60)),
      },
    };
    const d = deltaSeries(ref, rival);
    const at = (x: number) => valueAtDistance(ref.channels.distance, d, x);
    expect(at(1000)).toBeCloseTo(0.1, 6); // S1 oficial: 20,1 − 20
    expect(at(2000)).toBeCloseTo(0.2, 6); // S1+S2
    expect(d.at(-1)).toBeCloseTo(0.3, 6); // vuelta
  });

  it("sin sectores en uno de los dos, cae a fracción de vuelta completa", () => {
    const ref = lapAt("REF", 5000, 50);
    const rival = { ...lapAt("RIV", 5050, 50.5), sectors: null };
    expect(Math.max(...deltaSeries(ref, rival).map(Math.abs))).toBeLessThan(1e-9);
  });
});

describe("deltaSeries", () => {
  it("rival más lento: delta crece linealmente y acaba en la diferencia oficial", () => {
    const ref = lapAt("REF", 5000, 50); // 100 s
    const rival = lapAt("RIV", 5000, 49.5); // ~101,01 s
    const d = deltaSeries(ref, rival);
    expect(d[0]).toBeCloseTo(0);
    expect(d.at(-1)).toBeCloseTo(rival.lap_time! - ref.lap_time!, 6);
    expect(d[100]).toBeGreaterThan(0);
  });
});

describe("gapMetersAtTime", () => {
  it("el rival más rápido va por delante y la separación crece con el tiempo", () => {
    const ref = lapAt("REF", 5000, 50);
    const rival = lapAt("RIV", 5000, 51);
    expect(gapMetersAtTime(ref, rival, 0)).toBeCloseTo(0);
    expect(gapMetersAtTime(ref, rival, 10)).toBeCloseTo(10);
    expect(gapMetersAtTime(ref, rival, 50)).toBeCloseTo(50);
  });
});

describe("zonas y segmentos", () => {
  it("la suma de ganancias por zona es el delta final", () => {
    const ref = lapAt("REF", 3000, 50);
    const rival = lapAt("RIV", 3000, 49);
    const delta = deltaSeries(ref, rival);
    const zones = zoneGains(ref, delta, [
      { label: "1", distance: 400 },
      { label: "2", distance: 1500 },
      { label: "3", distance: 2600 },
    ]);
    expect(zones.map((z) => z.label)).toEqual(["1", "2", "3"]);
    expect(zones[0].from).toBe(0);
    expect(zones[2].to).toBe(3000);
    const sum = zones.reduce((s, z) => s + z.refGain, 0);
    expect(sum).toBeCloseTo(delta.at(-1)!, 6);
    expect(zones.every((z) => z.refGain > 0)).toBe(true);
  });

  it("segmentos cubren la vuelta y suman el delta final", () => {
    const delta = Array.from({ length: 101 }, (_, i) => i / 100);
    const segs = gainSegments(delta, 10);
    expect(segs).toHaveLength(10);
    expect(segs[0].from).toBe(0);
    expect(segs.at(-1)!.to).toBe(1);
    expect(segs.reduce((s, x) => s + x.refGain, 0)).toBeCloseTo(1);
  });
});

describe("sectores, estadísticas y color", () => {
  it("sectorDeltas: positivo cuando la referencia es más rápida", () => {
    const ref = lapAt("REF", 3000, 50);
    const rival = lapAt("RIV", 3000, 40);
    expect(sectorDeltas(ref, rival).every((s) => s.diff! > 0)).toBe(true);
  });
  it("sectorDeltas tolera sectores ausentes", () => {
    const ref = { ...lapAt("REF", 3000, 50), sectors: null };
    expect(sectorDeltas(ref, lapAt("RIV", 3000, 40))[0].diff).toBeNull();
  });
  it("lapStats", () => {
    const s = lapStats(lapAt("REF", 1000, 50));
    expect(s.topSpeed).toBeCloseTo(180);
    expect(s.fullThrottle).toBe(100);
    expect(s.braking).toBe(0);
  });
  it("rivalColor separa compañeros de equipo", () => {
    expect(rivalColor("#F47600", "#F47600")).toBe("#e4e4ea");
    expect(rivalColor("#F47600", "#ED1131")).toBe("#ED1131");
  });
});
