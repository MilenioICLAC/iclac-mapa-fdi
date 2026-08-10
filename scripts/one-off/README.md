# Scripts de una sola vez

**Nada de acá corre solo.** No están en el build, no están en la CI y no hay que ejecutarlos para
operar el sitio. Son las herramientas con que se hicieron auditorías y migraciones puntuales durante
la construcción.

Se conservan porque explican de dónde salieron algunas decisiones y porque un análisis parecido se
puede volver a necesitar. Pero **varios esperan archivos de entrada que no están en el repositorio**
(entregas intermedias de la base, planillas de revisión externa, fuentes estadísticas). Si uno falla
con "no such file", es eso: le falta su insumo, no está roto.

Para lo que sí forma parte de la operación diaria, ver `scripts/` un nivel más arriba y la sección
de scripts en `.claude/CLAUDE.md`.

| Script | Qué hizo |
|---|---|
| `audit_base.mjs` | Cruce de la base contra el archivo de referencia del equipo de investigación, más detector de geometría duplicada entre inversiones. |
| `audit_ownership_cross.mjs` | Verificó si una entrega había aplicado los veredictos de la revisión externa de propiedad. |
| `build_fdi_share.mjs`, `build_fdi_share_report.mjs` | Métrica de participación china en el stock de IED (contra UNCTAD) y brecha contra cifras oficiales bilaterales (FMI CDIS). Sin interfaz: es análisis, no una vista del sitio. |
| `build_consortium_review.mjs` | Instrumento del 31-07 para destrabar MIXED en los consorcios: las 19 empresas que aparecen como miembro y no tienen ficha propia, más los 21 consorcios con lo que sí se puede diagnosticar hoy. Reemplaza la única línea vaga que traía la planilla de propiedad del 14-07. |
| `build_id_map.mjs` | Tabla de equivalencia entre los identificadores antiguos y el formato `ALPHA3-NNNN`. |
| `build_ownership_review.mjs` | Generó el instrumento con que se pidió la revisión experta de propiedad de empresas. |
| `drop_base_columns.mjs` | Sacó de la base las columnas de propiedad al adoptar el esquema v1.5. |
| `add_evidence_columns.mjs` | Agregó a `investors_map.csv` las ocho columnas de evidencia (03-08) y las cargó desde la planilla de la revisión externa, que hasta entonces era el único respaldo de las clasificaciones publicadas y vivía fuera del repositorio. Lee los estilos de celda, así que también recuperó los vehículos JV marcados en amarillo. |
| `seed_member_companies.mjs` | Creó la ficha de las 18 empresas que aparecían solo como miembro de consorcio (03-08), con nuestra propuesta de propiedad marcada `ownership_status=propuesto` y la nota de la que salió cada una. Deja `mcm` fuera a propósito: no es empresa china. |
| `build_investor_audit.mjs` | Archivo de auditoría para la revisión externa (03-08): las 24 empresas cuya clasificación escribimos nosotros y nadie de afuera miró, prellenadas y **ordenadas por el monto de consorcios que dependen de cada una**. Hoja `efecto` con qué consorcio depende de qué empresa. Se regenera cuando cambia el CSV. |
| `add_non_chinese_partners.mjs` | Abrió la tabla a los socios no chinos (03-08): columna `origin_country` (vacío = China) y la primera fila, MCM en el consorcio de Panamá. Con eso `PAN-0015` pasó de UNKNOWN a Local SOE. Solo se sembró MCM: los otros 28 socios salen de una extracción por texto sin confirmar. |
| `translate_consortium_notes.mjs` | Pasó a inglés las notas de los 21 consorcios (03-08), conservando porcentajes y fuentes, y marcó con PLEASE CHECK las 5 que traen una pregunta real: tres pares que son matriz y filial del mismo grupo (¿consorcio o doble conteo?), MCM que no es empresa china, y Texhong + Danasun sin resolver. |
| `clean_consortium_rows.mjs` | Limpió las 21 filas de consorcio (03-08): `ownership_status` de `pending-calculation` a `derived`, y fuera de las notas el `CALCULATED FROM MEMBERS` (cálculo congelado en la fuente), «Definir atribucion de monto» (resuelto) y «aunque enum=MIXED» (falso). La evidencia no se tocó. |
| `empty_consortium_ownership.mjs` | Vació `ownership` en las 21 filas de consorcio (03-08). Un acuerdo entre empresas no tiene dueño: su propiedad se resuelve desde `members` al leerla. El vacío queda reservado para marcar «esto no es una empresa», y el validador lo exige en las dos direcciones. |
| `drop_jv_parents.mjs` | Eliminó la columna `jv_parents` (03-08). Duplicaba `controllers` y quedaba vacía **por diseño** en los tres vehículos que marcó la revisión externa, cuyos socios son personas naturales. El script se niega a correr si algún valor no está ya reflejado en `controllers`. |
| `propose_remaining.mjs` | Cerró los dos huecos que quedaban (03-08): propuso las 3 empresas de países retenidos que nunca fueron a revisión (AFECC, Texhong, Chaoyang Petroleum) y anotó en cada consorcio cuál sería su propiedad calculada desde los miembros, **sin cambiar el valor guardado**, porque calcularlo de verdad es adoptar la salida que sigue en decisión de ICLAC. |
| `normalize_seeded_notes.mjs` | Sacó `_count` y `_musd` del CSV (66 de 240 filas desactualizadas: no eran dato, eran un reporte pegado a mano) y reescribió en inglés las 18 notas de las fichas sembradas, que son la evidencia que audita la revisión externa. |
| `set_proposed_chinese_names.mjs` | Cargó el nombre en chino **propuesto por nosotros** para 6 de las 18 fichas nuevas (03-08). Las otras 12 quedan vacías con el motivo escrito en el script. No pisa nada que venga de la revisión externa. |
| `ingest_external_comments.mjs` | Rescató la columna `comments` de la planilla del 31-07, que **nunca se había leído** (04-08): 29 comentarios de la revisión externa a la columna nueva `external_note`, separada de `review_note` para que su texto no siga confundido con nuestra prosa. De paso corrigió Hubei Energy a `Central SOE`, el único de sus 155 valores que no había llegado, porque su veredicto era «Not Sure» y el ingest filtraba por OK/WRONG. |
| `ingest_review_notes_0508.mjs` | Lo mismo con los 9 comentarios `REVIEW:` que devolvió el 05-08 en `investors_table_ywedits.xlsx`. Existe porque `external_note` **no** está entre los `EDITABLES` de `investors:import`, y eso es a propósito: es el dicho literal de alguien en una fecha, no un campo nuestro. Aborta si el texto que va a escribir no es substring literal de su celda, y se niega a pisar un `external_note` que ya tenga contenido, porque sus dos rondas son dos dichos con fecha y no uno que reemplaza al otro. |
| `build_clean_investors_table.mjs` | **No escribe el CSV**: genera `docs/sprint_5/investors_table_limpia.xlsx`, una propuesta de `review_note` limpia para revisar (05-08). Once reglas, todas con rastro en la hoja `note_changes`. Sacó la oscilación acumulada —correcciones desde el dataset legado que ya no es fuente, historia de fusión de ids, `PLEASE CHECK` contestados— y dejó la tabla entera en inglés. Encontró 14 notas que **nombraban un `ownership` distinto al de su propia fila**. Marca en color y en columna `flag` lo que hay que mirar. |
| `build_partner_proposal.mjs` | Instrumento del 03-08 para proponerle al equipo de datos la columna `Socio_No_Chino` en los archivos por país, prellenada con el socio extraído del texto de `Detail` (29 de 42 filas). Reemplazaría a `Joint_Venture`, que hoy marca 3 inversiones mientras 39 describen una operación conjunta en el texto, sin solaparse. |
| `apply_ownership_unknown_verdicts.mjs` | Cargó las propiedades que la revisión externa había resuelto para las empresas que nos quedaron en UNKNOWN, y que el pase del 23-07 no había aplicado por mirar solo los veredictos `WRONG`. Solo toca filas UNKNOWN. |
| `export_research_news_gap.mjs` | Planilla adjunta del punto C14: inversiones donde los flags `Research`/`News` y las columnas `source1..3` no coinciden. Lee la base viva, así que se puede volver a correr en cada entrega para ver si el hueco se cerró. |
| `export_vector_conflicts.mjs` | Listado de conflictos en la columna `Vector` para revisión. |
| `inspect_vectors.mjs`, `inspect_xlsx.mjs`, `xtab_project_type.mjs` | Exploración rápida de una planilla. Útiles como plantilla. |
| `merge_geo.mjs` | Mergeó polígonos sueltos al mapa. Reemplazado por `scripts/build_borders.mjs`. |
| `rebuild_investors_map_ownership.mjs` | Reescribió la columna de propiedad de la tabla de inversores con los veredictos de la revisión externa. |
| `restore_investor_raw.mjs` | Recuperó el nombre original del inversor cuando una entrega llegó con la columna normalizada. |
