// Regenera public/data/investors_map.json desde data/schema/investors_map.csv.
//
// El ETL hace lo mismo en cada build; esto sirve para regenerar sin correr el ETL entero.
// **Los dos llaman al mismo núcleo** (`scripts/lib/investors_map.mjs`), que es lo que
// impide que vuelvan a divergir: hasta el 05-08 cada uno tenía su copia del constructor y
// `non_chinese` existía sólo en esta, así que el JSON publicado no lo llevaba.
import { readFileSync, writeFileSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { buildInvestorMap } from './lib/investors_map.mjs'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const SRC = resolve(ROOT, 'data/schema/investors_map.csv')
const OUT = resolve(ROOT, 'public/data/investors_map.json')

const map = buildInvestorMap(readFileSync(SRC, 'utf8'))
writeFileSync(OUT, JSON.stringify(map), 'utf8')
console.log(`investors_map.json: ${Object.keys(map).length} entries -> ${OUT}`)
