import { openf1Api } from "./openf1";

// Única fuente de datos: la API pública de OpenF1, directa desde el navegador.
export const api = openf1Api;

export type F1Api = typeof openf1Api;
