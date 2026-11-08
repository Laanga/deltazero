# Plan · Replay 3D de carrera

> Estado: **planificado, sin implementar**. Documento de diseño para una sección nueva de DeltaZero
> donde se renderiza el circuito en 3D y se ven los 20 coches moviéndose durante toda la carrera.

## 1. Objetivo

Una ruta propia (`/replay`) que reproduce una sesión completa:

- Circuito en 3D con **elevación real** (Spa, Suzuka, Austin… se notan las cuestas).
- **Los 20 coches** moviéndose a la vez, con colores de equipo, etiqueta y posición en carrera.
- Línea de tiempo de toda la carrera con vueltas, SC/VSC/bandera roja y paradas.
- Cámaras: órbita libre, cenital, "TV" (cámaras fijas en curvas) y **cámara de persecución** de un piloto.
- Clasificación en vivo, gaps y mensajes de dirección de carrera sincronizados con el reloj.

## 2. Datos: qué hay y cuánto pesa

Comprobado contra la API (Spa 2025, `session_key=9939`):

| Fuente | Qué aporta | Volumen |
|---|---|---|
| OpenF1 `/location` | `x, y, z` de cada coche, **~3,5 Hz** | ventana de 5 s sin filtrar piloto → **414 filas, 23 coches** (~50 KB) |
| OpenF1 `/position`, `/intervals` | posición y gap oficiales en el tiempo | ligero |
| OpenF1 `/race_control`, `/pit`, `/stints` | banderas, paradas, neumáticos | ya se usan en la app |
| MultiViewer `/circuits/{key}/{year}` | silueta, curvas numeradas, rotación TV, paneles de comisarios | ~30 KB (ya integrado en `api.circuit`) |

Carrera de ~1 h 30 min ≈ **450.000 muestras** (~55 MB en JSON). Inviable de golpe; viable por streaming:

- **Ventanas de 60 s sin filtrar por piloto** → 1 petición = los 20 coches (~5.000 filas, ~600 KB). Unas 90 peticiones
  por carrera; con el limitador actual (3 req/s) se descarga en ~30–40 s, **por delante del cursor de reproducción**
  (se puede empezar a ver a los 2–3 s).
- Parseo en un **Web Worker** a `Float32Array` por piloto (t, x, y, z): ~11 MB en memoria por carrera.
- Caché en **IndexedDB** por `session_key` + ventana: la segunda vez es instantáneo y funciona offline.

## 3. Geometría del circuito

1. **Línea central**: la vuelta más limpia del líder (sin SC, sin boxes) desde `/location`, con `z` real. Suavizado
   (Catmull-Rom + media móvil sobre `z`, que viene ruidosa) y remuestreo cada 2 m.
2. **Cinta de asfalto**: extrusión de la línea central con ancho ~12–15 m (normales en el plano XY), `BufferGeometry`
   propia. Pianos como franjas rojo/blanco en el exterior de las curvas (las curvas y su ángulo vienen de MultiViewer).
3. **Pit lane**: trazado de las vueltas de entrada/salida a boxes de cualquier piloto.
4. Detalles: línea de meta a cuadros, colores de sector (los mismos que el mapa 2D), números de curva como
   etiquetas HTML ancladas en 3D, suelo con rejilla de telemetría tenue (coherente con la marca).
5. Mismo sistema de coordenadas que `/location` y la rotación oficial de MultiViewer → reutiliza `lib/trackGeometry.ts`.

## 4. Coches y movimiento

- `InstancedMesh` (1 draw call para los 20): modelo low-poly propio (sin licencias de terceros), color por instancia.
- Posición interpolada a 60 fps entre muestras de 3,5 Hz con **Catmull-Rom**; orientación a partir del vector velocidad
  (y cabeceo con la pendiente, gracias a `z`).
- Etiqueta con código del piloto y posición en carrera (sprite / HTML con `occlude`).
- Estela opcional (últimos ~2 s) para leer adelantamientos.
- Coche en boxes o retirado: atenuado / fuera de pista.

## 5. Interfaz

- **Timeline** inferior en cápsula de cristal: vueltas marcadas, bandas SC/VSC/roja (`parseRaceControl` ya existe),
  iconos de paradas; arrastrar para saltar. Velocidades ×1, ×4, ×16, ×64.
- **Clasificación lateral en vivo** (posición, gap, neumático y edad) con animación de cambios de posición
  (`layout` de framer-motion).
- **Ticker** de dirección de carrera.
- Selector de cámara (segmented control) y "seguir piloto" tocando la clasificación, el mismo patrón que el mapa 2D.
- Enlace compartible: `/replay?y=2025&gp=Belgian+Grand+Prix&t=3725&follow=PIA` (misma infraestructura de URL).

## 6. Stack técnico

- **three.js** + **@react-three/fiber** + **@react-three/drei** (`OrbitControls`, `Html`, `Line`, `PerspectiveCamera`).
- Cargado **solo en `/replay`** (ruta propia del App Router + `next/dynamic` con `ssr: false`): el resto de la app no
  paga ni un byte (three ≈ 150 KB gzip).
- Worker para descarga, parseo e interpolación; el hilo principal solo escribe matrices de instancias.
- `prefers-reduced-motion`: sin cámaras automáticas ni estelas. **Móvil**: modo 2D por defecto reutilizando
  `TrackMap` (ya optimizado con rAF) y 3D opcional.

## 7. Fases

| Fase | Entregable | Estimación |
|---|---|---|
| 0 · Spike de datos | Script que descarga una carrera por ventanas, mide tiempos/volumen y guarda en IndexedDB | 1 día |
| 1 · Replay 2D | **Victoria rápida**: los 20 coches de toda la carrera sobre el `TrackMap` actual + timeline. Valida el pipeline sin 3D | 2 días |
| 2 · Escena 3D | Cinta del circuito con elevación, coches instanciados e interpolados, cámara orbital | 3 días |
| 3 · Cámaras e interfaz | Persecución, TV y cenital; clasificación en vivo, ticker, URL compartible | 2–3 días |
| 4 · Pulido | Rendimiento (perfilado en móvil), accesibilidad, estados vacíos, capturas para el README | 2 días |

## 8. Riesgos

- **Rate limit de OpenF1** en la descarga inicial → streaming por delante del cursor + caché IndexedDB.
- **Ruido en `z`** → suavizado fuerte de la línea central; los coches se "pegan" a la cinta proyectando sobre ella.
- **Desfase temporal entre coches** (muestras no simultáneas) → interpolación por tiempo absoluto, nunca por índice.
- **Sesiones en directo**: OpenF1 exige cuenta de pago para datos en vivo; el replay se plantea para sesiones terminadas.
- **Licencias**: nada de modelos o marcas oficiales en 3D; geometría propia.
