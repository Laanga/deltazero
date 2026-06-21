// Utilidades de exportación de datos y gráficas (solo navegador).

const SVG_NS = "http://www.w3.org/2000/svg";

function triggerDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** Descarga un CSV; la primera fila son las cabeceras. */
export function downloadCSV(filename: string, rows: (string | number | null)[][]) {
  const esc = (v: string | number | null) => {
    const s = v == null ? "" : String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const csv = rows.map((r) => r.map(esc).join(",")).join("\n");
  // BOM para que Excel respete los acentos
  const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8;" });
  triggerDownload(blob, filename.endsWith(".csv") ? filename : `${filename}.csv`);
}

/** Rasteriza el primer <svg> dentro de `container` a PNG (2x) y lo descarga. */
export async function exportSvgToPng(container: HTMLElement, filename: string, bg = "#15151e") {
  // Prioriza el lienzo de recharts; evita capturar iconos SVG de la cabecera
  const svg =
    container.querySelector<SVGSVGElement>(".recharts-surface") ??
    container.querySelector<SVGSVGElement>(".recharts-wrapper svg") ??
    container.querySelector<SVGSVGElement>("svg");
  if (!svg) throw new Error("No hay gráfica para exportar");

  const rect = svg.getBoundingClientRect();
  const w = Math.max(1, Math.round(rect.width));
  const h = Math.max(1, Math.round(rect.height));

  const clone = svg.cloneNode(true) as SVGSVGElement;
  clone.setAttribute("xmlns", SVG_NS);
  clone.setAttribute("width", String(w));
  clone.setAttribute("height", String(h));
  clone.setAttribute("style", "font-family: ui-sans-serif, system-ui, sans-serif");

  const bgRect = document.createElementNS(SVG_NS, "rect");
  bgRect.setAttribute("width", "100%");
  bgRect.setAttribute("height", "100%");
  bgRect.setAttribute("fill", bg);
  clone.insertBefore(bgRect, clone.firstChild);

  const data = new XMLSerializer().serializeToString(clone);
  const svgUrl = "data:image/svg+xml;charset=utf-8," + encodeURIComponent(data);

  const img = new Image();
  await new Promise<void>((resolve, reject) => {
    img.onload = () => resolve();
    img.onerror = () => reject(new Error("No se pudo rasterizar la gráfica"));
    img.src = svgUrl;
  });

  const scale = 2;
  const canvas = document.createElement("canvas");
  canvas.width = w * scale;
  canvas.height = h * scale;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas no disponible");
  ctx.scale(scale, scale);
  ctx.drawImage(img, 0, 0);

  await new Promise<void>((resolve) => {
    canvas.toBlob((blob) => {
      if (blob) triggerDownload(blob, filename.endsWith(".png") ? filename : `${filename}.png`);
      resolve();
    }, "image/png");
  });
}
