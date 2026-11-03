import { createContext } from 'react';
import type { Perfil } from '../types';

export interface EstadoSesion {
  perfil: Perfil | null;
  cargando: boolean;
  iniciarSesion: (email: string, password: string) => Promise<Perfil>;
  adoptarToken: (token: string) => Promise<Perfil>;
  cerrarSesion: () => void;
  esCoordinador: boolean;
}

/**
 * El contexto vive en su propio archivo.
 *
 * Así el módulo del proveedor exporta únicamente componentes y la recarga en
 * caliente de Vite sigue funcionando durante el desarrollo.
 */
export const ContextoSesion = createContext<EstadoSesion | null>(null);
