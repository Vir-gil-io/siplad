import { useCallback, useEffect, useState } from 'react';

import { mensajeDeError } from '../api/cliente';

/**
 * Carga de datos desde la API.
 *
 * Resuelve tres cosas que de otro modo se repiten mal en cada vista:
 *
 * 1. Descarta la respuesta de una petición que ya quedó obsoleta. Si el
 *    usuario cambia de filtro antes de que llegue la respuesta anterior, sin
 *    esta guarda se pintaría el resultado viejo sobre el nuevo.
 * 2. No modifica el estado de forma sincrónica dentro del efecto, lo que
 *    evita la cascada de renderizados.
 * 3. Expone `recargar` para refrescar después de una operación de escritura.
 *
 * El `cargador` debe venir memorizado con useCallback por quien lo usa; de lo
 * contrario el efecto se dispararía en cada renderizado.
 */
export function useCargaRemota<T>(cargador: () => Promise<T>, mensajeDeRespaldo: string) {
  const [datos, establecerDatos] = useState<T | null>(null);
  const [cargando, establecerCargando] = useState(true);
  const [error, establecerError] = useState<string | null>(null);
  const [version, establecerVersion] = useState(0);

  useEffect(() => {
    let vigente = true;

    void (async () => {
      try {
        const resultado = await cargador();
        if (!vigente) return;
        establecerDatos(resultado);
        establecerError(null);
      } catch (fallo) {
        if (vigente) establecerError(mensajeDeError(fallo, mensajeDeRespaldo));
      } finally {
        if (vigente) establecerCargando(false);
      }
    })();

    return () => {
      vigente = false;
    };
  }, [cargador, version, mensajeDeRespaldo]);

  const recargar = useCallback(() => {
    establecerCargando(true);
    establecerVersion((actual) => actual + 1);
  }, []);

  return { datos, cargando, error, recargar, establecerError };
}
