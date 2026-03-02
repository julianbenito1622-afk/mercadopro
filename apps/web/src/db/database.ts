import SQLiteESMFactory from 'wa-sqlite/dist/wa-sqlite-async.mjs'
import { Factory, SQLITE_OPEN_READWRITE, SQLITE_OPEN_CREATE } from 'wa-sqlite'
import wasmUrl from 'wa-sqlite/dist/wa-sqlite-async.wasm?url'
import schemaSql from './schema.sql?raw'

/**
 * Backend de persistencia activo.
 * - 'opfs'   : Origin Private File System (solo disponible en Web Worker)
 * - 'idb'    : IndexedDB via IDBBatchAtomicVFS (hilo principal, persistente)
 * - 'memoria': SQLite en memoria (sin persistencia entre recargas)
 */
export type BackendDB = 'opfs' | 'idb' | 'memoria'

let sqlite3: SQLiteAPI | null = null
let dbHandle: number | null = null
let backendActivo: BackendDB = 'memoria'

/**
 * Inicializa la base de datos local.
 *
 * Jerarquía de backend:
 *   1. OPFS  (OriginPrivateFileSystemVFS) — requiere Worker con sync access handles
 *   2. IDB   (IDBBatchAtomicVFS)         — funciona en hilo principal, persistente
 *   3. Memoria (:memory:)                — sin persistencia, fallback final
 *
 * Es idempotente: llamar varias veces no reinicializa la DB.
 */
export async function initDatabase(): Promise<void> {
  if (dbHandle !== null) return

  // Cargar módulo WASM — locateFile apunta al asset procesado por Vite
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const wasmModule = await SQLiteESMFactory({
    locateFile: (f: string) => (f.endsWith('.wasm') ? wasmUrl : f),
  })
  sqlite3 = Factory(wasmModule)

  const flags = SQLITE_OPEN_READWRITE | SQLITE_OPEN_CREATE

  // ── 1. Intentar OPFS ─────────────────────────────────────────────────────
  // OriginPrivateFileSystemVFS usa createSyncAccessHandle(), solo disponible
  // en contextos Worker (no en el hilo principal del navegador).
  const enWorker =
    typeof self !== 'undefined' && self.constructor?.name === 'DedicatedWorkerGlobalScope'
  if (enWorker) {
    try {
      const { OriginPrivateFileSystemVFS } = await import(
        'wa-sqlite/src/examples/OriginPrivateFileSystemVFS.js'
      )
      const vfs = new OriginPrivateFileSystemVFS()
      sqlite3.vfs_register(vfs as unknown as SQLiteVFS)
      dbHandle = await sqlite3.open_v2('mercadopro.db', flags, 'opfs')
      backendActivo = 'opfs'
    } catch {
      if (dbHandle !== null) {
        try { await sqlite3.close(dbHandle) } catch { /* ignorar */ }
        dbHandle = null
      }
    }
  }

  // ── 2. Fallback: IndexedDB (IDBBatchAtomicVFS) ────────────────────────────
  // IDBBatchAtomicVFS requiere Web Locks API (navigator.locks), disponible solo
  // en contextos seguros (HTTPS o localhost). En HTTP de red local no hay Locks
  // y cualquier operación SQL lanza SQLITE_IOERR — ni siquiera intentamos IDB.
  const idbDisponible =
    typeof navigator !== 'undefined' && 'locks' in navigator
  if (dbHandle === null && idbDisponible) {
    try {
      const { IDBBatchAtomicVFS } = await import(
        'wa-sqlite/src/examples/IDBBatchAtomicVFS.js'
      )
      const vfsName = 'mercadopro-idb'
      const vfs = new IDBBatchAtomicVFS(vfsName)
      sqlite3.vfs_register(vfs as unknown as SQLiteVFS)
      dbHandle = await sqlite3.open_v2('mercadopro.db', flags, vfsName)
      backendActivo = 'idb'
      console.info(
        '[MercadoPro DB] Usando IndexedDB (persistente)'
      )
    } catch (e) {
      if (dbHandle !== null) {
        try { await sqlite3.close(dbHandle) } catch { /* ignorar */ }
        dbHandle = null
      }
      console.warn('[MercadoPro DB] IndexedDB falló —', e instanceof Error ? e.message : e)
    }
  } else if (dbHandle === null) {
    console.warn('[MercadoPro DB] Web Locks no disponible (HTTP no-localhost) — usando memoria')
  }

  // ── 3. Fallback final: en memoria ─────────────────────────────────────────
  if (dbHandle === null) {
    dbHandle = await sqlite3.open_v2(':memory:', flags)
    backendActivo = 'memoria'
    console.warn(
      '[MercadoPro DB] ⚠ Modo memoria — los datos NO persisten al recargar la página'
    )
  }

  // Activar claves foráneas (debe ejecutarse en cada sesión)
  await sqlite3.exec(dbHandle, 'PRAGMA foreign_keys = ON;')

  // Migraciones: correr ANTES del schema para que los INSERT del seed funcionen
  // en DBs existentes. El try/catch ignora errores si la tabla no existe aún
  // (DB nueva) o si la columna ya fue agregada (idempotente).
  try {
    await sqlite3.exec(dbHandle, 'ALTER TABLE product ADD COLUMN es_pantalla_rapida INTEGER NOT NULL DEFAULT 0')
  } catch { /* tabla no existe aún o columna ya existe — ignorar */ }

  // Crear tablas e insertar datos iniciales
  // CREATE TABLE IF NOT EXISTS + INSERT OR IGNORE → idempotente
  // Ejecutar statement a statement para evitar bug de wa-sqlite con multi-statement
  // exec() sobre IDB cuando el SQL contiene caracteres Unicode multi-byte en comentarios
  for await (const stmt of sqlite3.statements(dbHandle, schemaSql)) {
    await sqlite3.step(stmt)
  }

  console.info(`[MercadoPro DB] ✓ Lista · backend: ${backendActivo}`)
}

/** Retorna el handle de la base de datos. Lanza error si no está inicializada. */
export function getDb(): number {
  if (dbHandle === null)
    throw new Error('[MercadoPro DB] No inicializada. Llama initDatabase() primero.')
  return dbHandle
}

/** Retorna la instancia de la API SQLite. Lanza error si no está inicializada. */
export function getSqlite3(): SQLiteAPI {
  if (sqlite3 === null)
    throw new Error('[MercadoPro DB] No inicializada. Llama initDatabase() primero.')
  return sqlite3
}

/** Backend activo: 'opfs' | 'idb' | 'memoria' */
export function getBackend(): BackendDB {
  return backendActivo
}
