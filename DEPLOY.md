# Despliegue de DeltaZero

La app es **solo frontend**: llama directamente desde el navegador a APIs públicas
gratuitas, así que se despliega en Vercel sin servidor propio y sin coste.

- **[OpenF1](https://openf1.org)** (`api.openf1.org`) — calendario, pilotos, vueltas,
  telemetría, posiciones, stints, resultados
- **[Jolpica](https://github.com/jolpica/jolpica-f1)** (`api.jolpi.ca`) — mundiales de
  pilotos y constructores

El cliente está en [`lib/openf1.ts`](lib/openf1.ts), con cola de
peticiones serializada y reintentos para respetar el rate limit de OpenF1.

## Pasos

1. Sube el repo a GitHub.
2. En [vercel.com](https://vercel.com) → **New Project** → importa el repo.
3. Deploy. No necesita variables de entorno.

## Limitaciones

- **Datos desde 2023** (OpenF1 no tiene temporadas anteriores).
- **Sin números de curva** en el mapa (OpenF1 no expone corners; el trazado se dibuja
  igual desde la telemetría).
- Telemetría a ~3.7 Hz.
- Sesiones muy recientes pueden no tener datos de posición (el mapa muestra un aviso
  y el resto funciona).
- La primera carga de telemetría tarda unos segundos por el rate limit de OpenF1.
