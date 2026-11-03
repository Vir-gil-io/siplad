import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';

import { autenticacion } from '../api/servicios';
import { borrarToken, guardarToken, leerToken } from '../api/cliente';
import { ContextoSesion, type EstadoSesion } from './contexto';
import type { Perfil } from '../types';

/**
 * Estado de sesión de la aplicación.
 *
 * Al arrancar, si hay un token almacenado se consulta el perfil contra la API
 * en lugar de confiar en datos guardados en el navegador: así una cuenta
 * desactivada o un token vencido no dan acceso a la interfaz.
 *
 * El estado inicial de `cargando` depende de si existe un token, de modo que
 * el efecto no tenga que modificarlo de forma sincrónica.
 */
export function ProveedorSesion({ children }: { children: ReactNode }) {
  const [perfil, establecerPerfil] = useState<Perfil | null>(null);
  const [cargando, establecerCargando] = useState(() => leerToken() !== null);

  useEffect(() => {
    if (leerToken() === null) return;

    let vigente = true;

    void (async () => {
      try {
        const datos = await autenticacion.perfil();
        if (vigente) establecerPerfil(datos);
      } catch {
        borrarToken();
        if (vigente) establecerPerfil(null);
      } finally {
        if (vigente) establecerCargando(false);
      }
    })();

    return () => {
      vigente = false;
    };
  }, []);

  const iniciarSesion = useCallback(async (email: string, password: string) => {
    const respuesta = await autenticacion.iniciarSesion(email, password);
    guardarToken(respuesta.accessToken);
    establecerPerfil(respuesta.usuario);
    return respuesta.usuario;
  }, []);

  /** Usado por el retorno del acceso federado, que entrega solo el token. */
  const adoptarToken = useCallback(async (token: string) => {
    guardarToken(token);
    const datos = await autenticacion.perfil();
    establecerPerfil(datos);
    return datos;
  }, []);

  const cerrarSesion = useCallback(() => {
    borrarToken();
    establecerPerfil(null);
  }, []);

  const valor = useMemo<EstadoSesion>(
    () => ({
      perfil,
      cargando,
      iniciarSesion,
      adoptarToken,
      cerrarSesion,
      esCoordinador: perfil?.rol === 'COORDINADOR',
    }),
    [perfil, cargando, iniciarSesion, adoptarToken, cerrarSesion],
  );

  return <ContextoSesion.Provider value={valor}>{children}</ContextoSesion.Provider>;
}
