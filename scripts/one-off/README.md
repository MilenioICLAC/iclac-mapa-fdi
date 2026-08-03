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
| `apply_ownership_unknown_verdicts.mjs` | Cargó las propiedades que la revisión externa había resuelto para las empresas que nos quedaron en UNKNOWN, y que el pase del 23-07 no había aplicado por mirar solo los veredictos `WRONG`. Solo toca filas UNKNOWN. |
| `export_research_news_gap.mjs` | Planilla adjunta del punto C14: inversiones donde los flags `Research`/`News` y las columnas `source1..3` no coinciden. Lee la base viva, así que se puede volver a correr en cada entrega para ver si el hueco se cerró. |
| `export_vector_conflicts.mjs` | Listado de conflictos en la columna `Vector` para revisión. |
| `inspect_vectors.mjs`, `inspect_xlsx.mjs`, `xtab_project_type.mjs` | Exploración rápida de una planilla. Útiles como plantilla. |
| `merge_geo.mjs` | Mergeó polígonos sueltos al mapa. Reemplazado por `scripts/build_borders.mjs`. |
| `rebuild_investors_map_ownership.mjs` | Reescribió la columna de propiedad de la tabla de inversores con los veredictos de la revisión externa. |
| `restore_investor_raw.mjs` | Recuperó el nombre original del inversor cuando una entrega llegó con la columna normalizada. |
