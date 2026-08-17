# Traspaso: qué queda en manos de ICLAC

Lista de lo que hay que hacer una vez para que el sitio quede completamente bajo control de ICLAC, y
de lo que conviene saber después. Cada punto dice **quién** puede hacerlo: varios son configuraciones
de administrador que solo alguien de la organización tiene.

---

## 1. Hosting en Netlify

Montado. El sitio está publicado en **https://app.iclac.cl**, desde este repositorio y en la cuenta
de Netlify de ICLAC. La configuración está versionada en `netlify.toml`, así que no hay nada que
ajustar a mano:

- Build command: `npm run etl && npm run build`
- Publish directory: `dist`
- Variable de entorno: `VITE_WEB3FORMS_KEY` (ver punto 2)

**Cada push al repositorio reconstruye el sitio solo.** Subir una planilla corregida es todo lo que
hace falta para actualizar los datos publicados.

El dominio apunta con un registro **CNAME** de `app` a `map-fdi.netlify.app`, en la zona DNS de
`iclac.cl`, que se administra en iHosting junto al sitio institucional. El certificado HTTPS lo emite
y lo renueva Netlify solo.

Si más adelante se quiere otro subdominio, se agrega en *Domain management* y se repite ese CNAME en
el Zone Editor del cPanel. **No usar la herramienta de subdominios del cPanel:** crea un registro A
apuntando al servidor de iHosting, que no puede convivir con el CNAME.

## 2. Clave del formulario de Contacto

Montado. La vista de Contacto usa Web3Forms, que reenvía el formulario a una dirección de correo sin
necesidad de servidor propio. La clave está cargada en Netlify como `VITE_WEB3FORMS_KEY` y los
mensajes llegan a `comunicaciones.iclac@gmail.com`.

Dos cosas para cuando haya que cambiarla:

**La clave queda atada a la dirección de destino.** Cambiar el destinatario significa generar una
clave nueva en web3forms.com desde el buzón nuevo, no editar la variable. La clave se saca del panel
de la cuenta en ese sitio; el correo con que se supone que llega no siempre aparece.

**Editar la variable no basta: hay que volver a desplegar.** El valor se hornea dentro del JavaScript
en el momento de construir el sitio, así que un despliegue ya hecho no la toma, por más que la
variable esté correcta en el panel. En Netlify: *Deploys* → *Trigger deploy* → *Clear cache and
deploy site*.

Si la variable falta, la vista no se rompe: muestra un enlace de correo directo en lugar del
formulario.

## 3. Informe de validación en GitHub Pages

Ya está funcionando: cada vez que se sube un archivo de datos, la validación corre y publica el
informe en

**https://milenioiclac.github.io/iclac-mapa-fdi/**

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
