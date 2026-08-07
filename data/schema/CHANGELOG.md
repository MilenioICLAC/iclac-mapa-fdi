# Changelog del esquema de datos

Historia de `data/schema/schema.md`: qué cambió en el contrato y **por qué**. El contrato vigente vive
allá; acá sólo queda la procedencia.

Se escribe una entrada cuando cambia una **regla**, no cuando se corrige una redacción. Cada entrada
dice qué se movió y qué problema concreto lo motivó, porque el `git log` guarda el cambio pero no el
motivo, y el motivo es lo que evita repetir la decisión al revés seis semanas después.

---

## v1.6 (2026-08-07)

limpieza de dos cosas que el contrato daba por hechas y no lo estaban.
- **`Socio_No_Chino` y `Socio_Pais` salen.** Nunca se aprobaron: entraron a v1.6 como propuesta
  redactada y quedaron descritas como si fueran contrato. Se revirtió el esquema, las reglas del
  validador (`fila/socio-*`), sus diagnósticos en el informe y los campos del ETL.
  `scripts/one-off/build_partner_proposal.mjs` se conserva como registro de la propuesta del 03-08.
- **`Joint_Venture` se queda como columna legada.** Mal codificada y sin criterio (3 inversiones en
  `Yes` contra 39 que describen una operación conjunta en el texto, sin solaparse), así que la app no
  la usa, pero se sigue llenando para no perder el dato.
- **`Id_Seq` y `ALPHA3-NNNN` dejan de ser propuesta.** Los 17 archivos por país los traen desde la
  carga del 09-07. Se sacan los ⏳ y §8 queda sin la decisión de identificador.
- **Aviso nuevo `archivo/columna-sugerida-ausente`**: si falta `reliability_notes`, un warning **de
  archivo**, nunca por fila. Hoy lo emiten los 17 archivos, porque ninguno la tiene. No entra a
  `REQUIRED_SOFT_COLUMNS` a propósito: esa lista además valida celda por celda, y como la nota es de
  la inversión y no del punto, Perú dejaría 5.000 avisos del mismo hueco.
- **`source4` y `source5` tampoco existen en ningún archivo por país.** Se decidió no avisarlo:
  nadie las va a llenar en esta pasada y el aviso sería ruido. Queda anotado acá porque tiene
  consecuencia: con tres columnas, un `reliability_score` de 4 o 5 no se puede documentar entero, y
  por eso hay puntajes que no se pueden auditar contra el archivo.

## v1.5 (2026-07-28)

una sola corrección, pero de fondo — **`Ownership` sale del
contrato**, junto con su columna de trabajo `Ownership_Original`.
- *Por qué:* v1.4 la metió al contrato y a la vez §5.1 declaraba que la fuente era
  `investors_map.csv`. Dos fuentes para un mismo hecho, y **divergieron**: la base del cliente
  quedó con 0 `Local SOE` y la tabla nuestra con 21. La propiedad es atributo de la **empresa**, no
  del deal, así que su lugar natural es la tabla de empresas.
- *Qué implica:* el archivo del país ya no la lleva. Si reaparece, el validador la trata como
  columna extra y la ignora; la regla de enum se mantiene como red por si vuelve con valores.
- Ejecuta la propuesta de handover que §5.1 ya dejaba escrita en v1.4.
- `Ownership_Original` era la copia pre-rename (`SASAC`/`SOE` en 11.909 de 12.532 filas): columna
  de trabajo de las que §1 prohíbe, que se salvaba sólo porque el patrón es `_ORIG` y ésta termina
  en `_Original`.

## v1.4 (2026-07-23)

cambios para que el validador sea **resiliente** (rojo = problema
real, no cosmético) y para que incorporar un país no requiera tocar código.
- **Nombre de archivo case-insensitive.** `chile.xlsx` y `CHILE.xlsx` valen igual. La diferencia
  de mayúsculas la absorbe la normalización, no es un error. *Por qué:* el ida-y-vuelta de
  renombres costaba tiempo sin cambiar el significado del dato.
- **País como dato, no código.** El alcance de países sale de las constantes del validador a un
  registro `data/schema/countries.csv` (semilla pre-cargada por nosotros: toda LATAM +
  Centroamérica + Caribe; **México excluido a propósito**). Sumar un país = editar ese CSV (o
  nosotros la semilla), sin tocar el validador. Un país fuera del registro = "fuera de la lista",
  con instrucción, no error críptico.
- **Capa de normalización determinista (curaciones).** Antes de validar se arreglan de nuestro
  lado, sin pérdida: apóstrofe de Excel en `COUNTRY_ISO_NUM`/`Id_Seq` (`'152`→`152`), `Country` a
  forma canónica (`CHILE`→`Chile`, `Brasil`→`Brazil`). Cada arreglo se **lista** (no se enmascara).
- **`Area_ES` fuera de la validación de formato.** El mapa traduce keyed por `Area_EN`, así que la
  etiqueta ES es redundante. Se conserva SÓLO el **conflicto conceptual** (`fila/sector-conflicto`,
  warning): cuando `Area_ES` apunta a un sector distinto de `Area_EN` (ej: `PRY-0001` COFCO
  `Energy` vs `Agroindustria`) — ahí una de las dos está mal.
- **`Ownership` entra al contrato**, mandada por la base del cliente (§5.1). Enum:
  `Central SOE / Local SOE / POE / MIXED / UNKNOWN`.
- **Geometría de país** como compuerta blanda: si un país no tiene borde cargado, avisa (no bota);
  el país entra al mapa cuando su borde existe y sus datos pasan (§10).
- **Umbral de rechazo explícito por severidad:** un archivo se rechaza si tiene un problema de
  archivo (basta uno) o si baja del umbral de filas válidas. Warnings/curaciones nunca botan.

## v1.3 (2026-07-14)

nombre de archivo por país pasa a **país en MAYÚSCULA, en
inglés, sin tildes** (`CHILE.xlsx`, `BRAZIL.xlsx`). Es la convención con que el cliente hizo su
primera carga al repo (09-07); se adopta tal cual para no hacerle renombrar nada. Reemplaza
"minúscula/español" de v1.2. Lista cerrada de nombres válidos = países del proyecto
(`FILENAME_BY_ALPHA3` en el validador).

## v1.2 (2026-07-04)

sincronizado con la Parte II del entregable 26/06.
`Year` pasa a **req**; `Investment` queda **opt** (hay inversiones reales sin monto público).
Nueva columna `Id_Seq` (secuencia por país, **propuesta pendiente de confirmación cliente**) y
formato propuesto de `Id_Investment` = `ALPHA3-NNNN` (§5). Nueva columna `News` (enum `Yes`/`No`, req).
`Origin of seller` → `Origin_Of_Seller`. Archivos por país en minúscula/español/sin tildes (`chile.xlsx`).
Columnas extra del cliente permitidas (se ignoran). **Resuelto §9:** `Project_Type` es UNA columna con
3 valores excluyentes; las booleanas `Acquisition`/`Greenfield`/`Construction` salen del esquema.
`Company_Id`/`previous_fdi` salen del esquema (se resuelven de nuestro lado, §10).

## v1.0 (2026-06-25)

primera propuesta del contrato.
