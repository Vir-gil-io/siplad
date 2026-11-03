import { lazy, Suspense } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';

import { ProveedorSesion } from './auth/SesionContexto';
import { useSesion } from './auth/useSesion';
import { RutaProtegida } from './auth/RutaProtegida';
import { Panel } from './layouts/Panel';
import { Cargando } from './components/Cargando';
import { Acceso } from './pages/Acceso';
import { RetornoGoogle } from './pages/RetornoGoogle';
import { MisPlaneaciones } from './pages/MisPlaneaciones';
import { MisAvances } from './pages/MisAvances';
import { MisEvidencias } from './pages/MisEvidencias';
import { SeguimientoAvances } from './pages/SeguimientoAvances';
import { RevisionPlaneaciones } from './pages/RevisionPlaneaciones';
import { ValidacionEvidencias } from './pages/ValidacionEvidencias';

/**
 * Los reportes se cargan por separado.
 *
 * Es la única vista que usa la librería de gráficas, y pesa más que el resto
 * de la aplicación junta. Cargándola aparte, un docente —que nunca entra
 * aquí— no la descarga.
 */
const Reportes = lazy(() =>
  import('./pages/Reportes').then((modulo) => ({ default: modulo.Reportes })),
);

/** Envía a cada rol a la primera pantalla de su trabajo. */
function Inicio() {
  const { esCoordinador } = useSesion();
  return <Navigate to={esCoordinador ? '/revision' : '/planeaciones'} replace />;
}

export function App() {
  return (
    <ProveedorSesion>
      <Routes>
        <Route path="/acceso" element={<Acceso />} />
        <Route path="/auth/callback" element={<RetornoGoogle />} />

        <Route
          element={
            <RutaProtegida>
              <Panel />
            </RutaProtegida>
          }
        >
          <Route path="/" element={<Inicio />} />

          {/* Vistas del docente */}
          <Route
            path="/planeaciones"
            element={
              <RutaProtegida rolesPermitidos={['PROFESOR']}>
                <MisPlaneaciones />
              </RutaProtegida>
            }
          />
          <Route
            path="/avances"
            element={
              <RutaProtegida rolesPermitidos={['PROFESOR']}>
                <MisAvances />
              </RutaProtegida>
            }
          />
          <Route
            path="/evidencias"
            element={
              <RutaProtegida rolesPermitidos={['PROFESOR']}>
                <MisEvidencias />
              </RutaProtegida>
            }
          />

          {/* Vistas de coordinación */}
          <Route
            path="/revision"
            element={
              <RutaProtegida rolesPermitidos={['COORDINADOR']}>
                <RevisionPlaneaciones />
              </RutaProtegida>
            }
          />
          <Route
            path="/seguimiento"
            element={
              <RutaProtegida rolesPermitidos={['COORDINADOR']}>
                <SeguimientoAvances />
              </RutaProtegida>
            }
          />
          <Route
            path="/validacion"
            element={
              <RutaProtegida rolesPermitidos={['COORDINADOR']}>
                <ValidacionEvidencias />
              </RutaProtegida>
            }
          />
          <Route
            path="/reportes"
            element={
              <RutaProtegida rolesPermitidos={['COORDINADOR']}>
                <Suspense fallback={<Cargando mensaje="Abriendo reportes" />}>
                  <Reportes />
                </Suspense>
              </RutaProtegida>
            }
          />
        </Route>

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </ProveedorSesion>
  );
}
