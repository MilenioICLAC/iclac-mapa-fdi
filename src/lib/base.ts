// Ruta de un archivo de `public/` respetando la base del sitio: el mapa se sirve desde
// `/mapa-fdi/`, así que un `/data/...` escrito a mano apuntaría a la raíz del dominio.
export const asset = (ruta: string): string => import.meta.env.BASE_URL + ruta.replace(/^\//, '')
