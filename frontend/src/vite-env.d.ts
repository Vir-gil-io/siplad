/// <reference types="vite/client" />

/**
 * Variables de entorno de la compilación.
 *
 * Declararlas da autocompletado y hace que un nombre mal escrito sea un error
 * de compilación en lugar de un valor indefinido en tiempo de ejecución.
 */
interface ImportMetaEnv {
  /**
   * Dirección base de la API. En desarrollo se omite y las peticiones van a
   * /api, que el servidor de Vite reenvía al backend.
   */
  readonly VITE_API_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
