# Traspaso: qué queda en manos de ICLAC

Lista de lo que hay que hacer una vez para que el sitio quede completamente bajo control de ICLAC, y
de lo que conviene saber después. Cada punto dice **quién** puede hacerlo: varios son configuraciones
de administrador que solo alguien de la organización tiene.

---

## 1. Hosting en Netlify

El sitio se despliega desde este repositorio, en la cuenta de Netlify de ICLAC. La configuración está
versionada en `netlify.toml`, así que no hay nada que ajustar a mano:

- Build command: `npm run etl && npm run build`
- Publish directory: `dist`
- Variable de entorno: `VITE_WEB3FORMS_KEY` (ver punto 2)

Desde ahí, **cada push al repositorio reconstruye el sitio solo**. Subir una planilla corregida es
todo lo que hace falta para actualizar los datos publicados.

Si más adelante se quiere un dominio propio (por ejemplo `repositorio.iclac.cl`), se configura en
*Domain management* y requiere agregar un registro DNS donde esté alojado el dominio de ICLAC.

## 2. Clave del formulario de Contacto

La vista de Contacto usa Web3Forms, que envía el formulario a una dirección de correo sin necesidad
de servidor propio.

**Esto sí necesita a alguien de ICLAC**, porque la clave llega por correo a la dirección de destino:

1. Entrar a web3forms.com y escribir la dirección que debe **recibir** los mensajes (por ejemplo
   `comunicaciones.iclac@gmail.com`). La clave llega a esa misma dirección.
2. Cargarla en Netlify: *Site configuration* → *Environment variables* → `VITE_WEB3FORMS_KEY`.
3. Volver a desplegar para que la tome.

**La clave queda atada a la dirección de destino.** Cambiar el destinatario más adelante significa
generar una clave nueva, no editar la variable. Anotarlo donde se guarden las credenciales de la
organización.

Mientras la variable no exista, la vista no se rompe: muestra un enlace de correo directo en lugar
del formulario.

## 3. Informe de validación en GitHub Pages

Ya está funcionando: cada vez que se sube un archivo de datos, la validación corre y publica el
informe en

**https://nucleomilenioiclac.github.io/iclac-mapa-fdi/**

No hay que hacer nada, salvo saber que ese enlace es fijo y siempre muestra el estado más reciente.

## 4. Accesos que conviene revisar

Nada de esto es urgente, pero conviene resolverlo antes de que el proyecto quede en régimen:

- **Quién puede escribir en el repositorio.** Hoy alcanza con quien sube los datos y quien
  desarrolla. Conviene que haya más de un administrador, para no depender de una sola persona para
  cambiar la rama por defecto o revisar la configuración.
- **La cuenta de Netlify**, con el mismo criterio.
- **Dónde se guardan las credenciales** de las dos anteriores más la clave de Web3Forms, que hoy no
  está en ninguna parte del repositorio (y no debe estarlo).

---

## Lo que hay que saber después

### Quién decide qué se publica

El repositorio distingue **validado** de **publicado**. Un país puede estar impecable y no salir en
el sitio: eso se controla en la columna `publish` de `data/schema/countries.csv`, y es una decisión
editorial de ICLAC, no del sistema. Detalle en el README.

### La tabla de inversores necesita quién la mantenga

`data/schema/investors_map.csv` traduce el nombre del inversor tal como viene de la fuente a una
empresa canónica con su tipo de propiedad. Es lo que alimenta el diagrama de Tendencias y el filtro
de propiedad.

Mantenerla no es trabajo de quien carga los datos: implica saber de estructura corporativa china.
**Hace falta designar a alguien.** Mientras tanto el sitio no se rompe: un inversor que no esté en la
tabla se muestra igual, con propiedad desconocida, y queda listado en el informe de validación y en
`node scripts/check_investor_coverage.mjs` para que quien tome esa tarea sepa por dónde empezar.

### Qué queda pendiente

`docs/estado.md`, que se mantiene borrando lo que se cierra.

### Si hay que retomar el desarrollo

`.claude/CLAUDE.md` explica por qué el código está como está: las reglas que no caducan, las trampas
ya conocidas y qué se rompe si se cambian sin saber. Está escrito para que alguien (o un agente) pueda
retomar el trabajo sin arqueología.
