import { useContext } from 'react';

import { ContextoSesion, type EstadoSesion } from './contexto';

export function useSesion(): EstadoSesion {
  const contexto = useContext(ContextoSesion);
  if (!contexto) {
    throw new Error('useSesion debe usarse dentro de ProveedorSesion.');
  }
  return contexto;
}
