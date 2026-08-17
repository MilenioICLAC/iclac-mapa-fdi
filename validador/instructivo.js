// Texto del instructivo de subida. Aparte de la lógica a propósito: esto lo va a
// releer y corregir alguien que no está tocando código.
//
// Se parte en DOS momentos porque son dos cosas distintas y mezclarlas es lo que
// hace que un instructivo no se lea: la primera vez cuesta y es de una sola vez;
// cada vez son cuatro clics.

// ── OJO ────────────────────────────────────────────────────────────────────────
// Dueño actual del repositorio. Apunta a donde el repositorio está HOY, para que
// el enlace nunca esté roto. Si vuelve a moverse, esta constante cambia acá y en
// ningún otro lado. Transferido a la organización el 17-08-2026.
export const REPO = 'MilenioICLAC/iclac-mapa-fdi'
export const CARPETA_DATOS = 'data/sources/countries'

export const urlSubida = () => `https://github.com/${REPO}/upload/main/${CARPETA_DATOS}`
export const urlCarpeta = () => `https://github.com/${REPO}/tree/main/${CARPETA_DATOS}`

export const PRIMERA_VEZ = [
  {
    titulo: 'Tener una cuenta de GitHub',
    cuerpo:
      'Gratis, en github.com. Conviene una cuenta propia y no una compartida: así cada cambio queda con el nombre de quien lo hizo, que es lo que después permite preguntar.'
  },
  {
    titulo: 'Pedir acceso al repositorio',
    cuerpo:
      'Alguien de ICLAC con permiso de administrador tiene que invitarte, desde Settings → Collaborators and teams del repositorio. Te llega un correo con una invitación que hay que aceptar; hasta que no la aceptes, la pantalla de subida no te va a dejar.'
  },
  {
    titulo: 'Comprobar que entrás',
    cuerpo:
      'Abrí la carpeta de datos. Si ves el botón «Add file» arriba a la derecha, ya está: tenés permiso y no hay nada más que configurar.'
  }
]

export const CADA_VEZ = [
  {
    titulo: 'Validar acá primero',
    cuerpo: 'Que es lo que acabás de hacer. Así lo que sube ya se sabe cómo va a quedar.'
  },
  {
    titulo: 'Abrir la pantalla de subida',
    cuerpo: 'El botón de acá arriba lleva directo a la carpeta correcta, no hay que navegar.'
  },
  {
    titulo: 'Arrastrar el archivo',
    cuerpo:
      'Con el MISMO nombre que ya tiene (por ejemplo argentina.xlsx). El nombre es lo que dice de qué país es. Que ya haya un archivo con ese nombre no es problema: se reemplaza solo, en un paso. NO hace falta borrar el anterior, y conviene no hacerlo: entre el borrado y la subida el país queda fuera del sitio.'
  },
  {
    titulo: 'Escribir en una línea qué cambió',
    cuerpo:
      'Por ejemplo «Argentina: corregidas las coordenadas de Jujuy». Es lo único que va a quedar para entender, meses después, por qué cambió un dato.'
  },
  {
    titulo: 'Commit changes',
    cuerpo:
      'El botón verde. De ahí en adelante es solo: el informe se regenera y el mapa se reconstruye, sin que nadie tenga que avisar.'
  }
]

export const QUE_NO_TOCAR = [
  `Se sube solo a <code>${CARPETA_DATOS}</code>. Es la única carpeta de datos.`,
  'El archivo mantiene su nombre. Si lo renombrás, el sistema lo trata como un país nuevo y el anterior desaparece del mapa.',
  'Las carpetas <code>scripts/</code> y <code>.github/</code> son el motor del sitio: si algo ahí se rompe, el mapa deja de construirse.',
  'Nada de esto es irreversible: todo cambio queda registrado y se puede volver atrás. Pero es más fácil no pisarlo.'
]

export const RED_DE_SEGURIDAD =
  'Si un archivo llega incompleto por accidente, el sitio no se actualiza: se queda con los datos anteriores y avisa. No hay forma de borrar el mapa subiendo un archivo malo.'
