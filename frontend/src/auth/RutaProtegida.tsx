import { Navigate, useLocation } from 'react-router-dom';
import type { ReactNode } from 'react';

import { useSesion } from './useSesion';
import { Cargando } from '../components/Cargando';
import type { Rol } from '../types';

/**
 * Guard de rutas de la capa de presentación.
 *
 * Replica en la interfaz la restricción que el backend ya impone: una vista
 * reservada a coordinación no se muestra a un docente. La verificación real
 * sigue ocurriendo en el servidor; esto solo evita mostrar una pantalla que
 * terminaría en un 403.
 */
export function RutaProtegida({
  children,
  rolesPermitidos,
}: {
  children: ReactNode;
  rolesPermitidos?: Rol[];
}) {
  const { perfil, cargando } = useSesion();
  const ubicacion = useLocation();

  if (cargando) {
    return <Cargando mensaje="Verificando tu sesión" />;
  }

  if (!perfil) {
    return <Navigate to="/acceso" state={{ desde: ubicacion.pathname }} replace />;
  }

  if (rolesPermitidos && !rolesPermitidos.includes(perfil.rol)) {
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
}
