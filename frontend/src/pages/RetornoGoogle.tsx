import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';

import { useSesion } from '../auth/useSesion';
import { Aviso } from '../components/Aviso';
import { Cargando } from '../components/Cargando';

/**
 * Retorno del acceso federado.
 *
 * El backend redirige aquí con el token en el fragmento de la URL, no en la
 * cadena de consulta: el fragmento no viaja al servidor ni queda en sus
 * bitácoras. Se lee, se adopta la sesión y se limpia de la barra de
 * direcciones.
 *
 * El token se lee durante el renderizado, no en un efecto, porque ya está en
 * la URL cuando el componente se monta. Así el caso sin token se resuelve sin
 * modificar estado.
 */
export function RetornoGoogle() {
  const { adoptarToken } = useSesion();
  const navegar = useNavigate();
  const [fallo, establecerFallo] = useState(false);

  const token = useMemo(() => {
    const fragmento = new URLSearchParams(window.location.hash.replace(/^#/, ''));
    return fragmento.get('token');
  }, []);

  useEffect(() => {
    if (!token) return;

    let vigente = true;
    window.history.replaceState(null, '', window.location.pathname);

    void (async () => {
      try {
        const usuario = await adoptarToken(token);
        if (!vigente) return;
        void navegar(usuario.rol === 'COORDINADOR' ? '/revision' : '/planeaciones', {
          replace: true,
        });
      } catch {
        if (vigente) establecerFallo(true);
      }
    })();

    return () => {
      vigente = false;
    };
  }, [token, adoptarToken, navegar]);

  if (!token || fallo) {
    return (
      <div className="mx-auto max-w-md px-4 py-16">
        <Aviso>
          {token
            ? 'La sesión no pudo verificarse. Intenta entrar con tu correo y contraseña.'
            : 'El proveedor de identidad no devolvió una sesión válida. Intenta entrar con tu correo y contraseña.'}
        </Aviso>
        <button
          type="button"
          onClick={() => void navegar('/acceso', { replace: true })}
          className="mt-4 text-sm font-medium text-sello hover:underline"
        >
          Volver al acceso
        </button>
      </div>
    );
  }

  return <Cargando mensaje="Confirmando tu acceso" />;
}
