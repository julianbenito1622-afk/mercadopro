import { getSqlite3, getDb } from './database'

// IMPORTANTE: wa-sqlite async (Asyncify) NO soporta queries concurrentes.
// NUNCA usar Promise.all con queries SQLite. Siempre ejecutar secuencialmente con await.

// Cola interna para serializar toda operación SQLite.
// React 18 StrictMode monta/desmonta/remonta componentes, lo que lanza dos
// useEffect simultáneos. Sin esta cola, las queries concurrentes corrompen
// el estado interno del módulo WASM:
//   "RuntimeError: index out of bounds"
//   "Error: bad parameter or other API misuse"
let _colaSQL: Promise<void> = Promise.resolve()

function enCola<T>(tarea: () => Promise<T>): Promise<T> {
  const sig: Promise<T> = _colaSQL.then(tarea)
  // La cola siempre avanza aunque la tarea falle
  _colaSQL = sig.then(() => undefined, () => undefined)
  return sig
}

export function generarId(): string {
  return crypto.randomUUID()
}

export function fechaActual(): string {
  return new Date().toISOString()
}

export function ejecutarSQL(
  sql: string,
  params: (string | number | null)[] = []
): Promise<void> {
  return enCola(async () => {
    const sqlite3 = getSqlite3()
    const db = getDb()
    for await (const _stmt of sqlite3.statements(db, sql)) {
      for (let i = 0; i < params.length; i++) {
        sqlite3.bind(_stmt, i + 1, params[i])
      }
      await sqlite3.step(_stmt)
    }
  })
}

export function consultarSQL<T = Record<string, unknown>>(
  sql: string,
  params: (string | number | null)[] = []
): Promise<T[]> {
  return enCola(async () => {
    const sqlite3 = getSqlite3()
    const db = getDb()
    const rows: T[] = []

    for await (const stmt of sqlite3.statements(db, sql)) {
      for (let i = 0; i < params.length; i++) {
        sqlite3.bind(stmt, i + 1, params[i])
      }

      const columns = sqlite3.column_names(stmt)
      let rc: number
      while ((rc = await sqlite3.step(stmt)) === /* SQLITE_ROW */ 100) {
        const row: Record<string, unknown> = {}
        for (let i = 0; i < columns.length; i++) {
          row[columns[i]] = sqlite3.column(stmt, i)
        }
        rows.push(row as T)
      }
      void rc
    }

    return rows
  })
}
