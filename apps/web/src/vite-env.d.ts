/// <reference types="vite/client" />

// Declaraciones de tipo para VFS de wa-sqlite que no tienen tipos en el paquete
declare module 'wa-sqlite/src/examples/IDBBatchAtomicVFS.js' {
  import * as VFS from 'wa-sqlite/src/VFS.js'
  export class IDBBatchAtomicVFS extends VFS.Base {
    name: string
    constructor(idbDatabaseName?: string, options?: object)
  }
}

declare module 'wa-sqlite/src/examples/OriginPrivateFileSystemVFS.js' {
  import * as VFS from 'wa-sqlite/src/VFS.js'
  export class OriginPrivateFileSystemVFS extends VFS.Base {
    get name(): string
  }
}
