import { NavLink, Outlet, useNavigate } from 'react-router-dom';

import { useSesion } from '../auth/useSesion';
import { Boton } from '../components/Controles';

/**
 * Estructura de la aplicación.
 *
 * La navegación se arma según el rol: un docente ve sus tres módulos de
 * registro, y coordinación ve las dos bandejas de revisión más los reportes.
 */
export function Panel() {
  const { perfil, cerrarSesion, esCoordinador } = useSesion();
  const navegar = useNavigate();

  const enlaces = esCoordinador
    ? [
        { a: '/revision', texto: 'Revisión de planeaciones' },
        { a: '/seguimiento', texto: 'Seguimiento de avances' },
        { a: '/validacion', texto: 'Validación de evidencias' },
        { a: '/reportes', texto: 'Reportes' },
      ]
    : [
        { a: '/planeaciones', texto: 'Mis planeaciones' },
        { a: '/avances', texto: 'Mis avances' },
        { a: '/evidencias', texto: 'Mis constancias' },
      ];

  const salir = () => {
    cerrarSesion();
    void navegar('/acceso', { replace: true });
  };

  return (
    <div className="min-h-dvh">
      <header className="border-b-2 border-tinta bg-panel">
        <div className="mx-auto flex w-full max-w-[1760px] flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-6">
          <div>
            <p className="font-titulo text-lg font-bold tracking-tight text-tinta">
              SIPLAD
            </p>
            <p className="text-xs text-grafito">Planeación y avance docente</p>
          </div>

          <div className="flex items-center gap-4">
            <div className="text-right">
              <p className="text-sm font-medium text-tinta">{perfil?.nombre}</p>
              <p className="text-xs text-grafito">
                {esCoordinador ? 'Coordinación académica' : 'Docente'}
              </p>
            </div>
            <Boton variante="contorno" onClick={salir}>
              Salir
            </Boton>
          </div>
        </div>

        <nav
          aria-label="Secciones"
          className="mx-auto w-full max-w-[1760px] overflow-x-auto px-4 sm:px-6"
        >
          <ul className="flex gap-1">
            {enlaces.map((enlace) => (
              <li key={enlace.a}>
                <NavLink
                  to={enlace.a}
                  className={({ isActive }) =>
                    [
                      'inline-block whitespace-nowrap border-b-2 px-3 py-2.5 text-sm font-medium transition-colors',
                      isActive
                        ? 'border-sello text-sello'
                        : 'border-transparent text-grafito hover:text-tinta',
                    ].join(' ')
                  }
                >
                  {enlace.texto}
                </NavLink>
              </li>
            ))}
          </ul>
        </nav>
      </header>

      <main className="mx-auto w-full max-w-[1760px] px-4 py-6 sm:px-6 sm:py-8">
        <Outlet />
      </main>
    </div>
  );
}
