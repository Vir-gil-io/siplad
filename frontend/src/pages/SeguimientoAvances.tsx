import { useCallback, useMemo, useState } from 'react';

import { avances, catalogos } from '../api/servicios';
import { useCargaRemota } from '../hooks/useCargaRemota';
import { Acta, Cifra, Renglon } from '../components/Acta';
import { Aviso } from '../components/Aviso';
import { Selector } from '../components/Controles';
import { Cargando } from '../components/Cargando';
import { Sello } from '../components/Sello';
import { Vacio } from '../components/Vacio';
import { fechaLegible } from '../utils/validacion';
import type { Avance, PeriodoAcademico } from '../types';

interface DatosPantalla {
  lista: Avance[];
  periodos: PeriodoAcademico[];
}

/**
 * Módulo 2 — Control de avances, vista de coordinación.
 *
 * Los reportes muestran el agregado; aquí se ve el registro uno a uno, que es
 * lo que permite valorar un porcentaje: el mismo 60 % significa cosas muy
 * distintas según el tramo que el docente informó y los días hábiles que
 * contenía.
 */
export function SeguimientoAvances() {
  const cargador = useCallback(async (): Promise<DatosPantalla> => {
    const [lista, periodos] = await Promise.all([avances.listar(), catalogos.periodos()]);
    return { lista, periodos };
  }, []);

  const { datos, cargando, error } = useCargaRemota(
    cargador,
    'No se pudieron cargar los avances registrados.',
  );

  const [periodoId, establecerPeriodoId] = useState('');
  const [estado, establecerEstado] = useState('');

  const lista = useMemo(() => {
    const todos = datos?.lista ?? [];
    return todos.filter(
      (avance) =>
        (!periodoId || avance.planeacion?.periodoId === periodoId) &&
        (!estado || avance.estado === estado),
    );
  }, [datos, periodoId, estado]);

  if (cargando) return <Cargando mensaje="Cargando los avances registrados" />;
  if (error && !datos) return <Aviso>{error}</Aviso>;
  if (!datos) return null;

  const promedio =
    lista.length > 0
      ? Math.round(lista.reduce((suma, a) => suma + a.porcentaje, 0) / lista.length)
      : 0;

  const cumplidos = lista.filter((a) => a.estado === 'CUMPLIDO').length;

  return (
    <div className="space-y-4">
      {error ? <Aviso>{error}</Aviso> : null}

      <section className="hoja franja-cifras flex flex-wrap gap-x-10 gap-y-4 px-4 py-4 sm:px-5">
        <Cifra valor={lista.length} concepto="Avances registrados" />
        <Cifra
          valor={promedio}
          unidad="%"
          concepto="Promedio de cumplimiento"
          tono="sello"
        />
        <Cifra
          valor={cumplidos}
          concepto="Clasificados como cumplidos"
          tono={cumplidos === lista.length && lista.length > 0 ? 'sello' : 'lapiz'}
        />
      </section>

      <Acta
        titulo="Seguimiento de avances"
        referencia="Registro individual con el tramo informado por cada docente"
        acciones={
          <div className="flex flex-wrap gap-2">
            <Selector
              id="filtroPeriodo"
              etiqueta="Filtrar por periodo académico"
              etiquetaOculta
              value={periodoId}
              onChange={(e) => establecerPeriodoId(e.target.value)}
            >
              <option value="">Todos los periodos</option>
              {datos.periodos.map((periodo) => (
                <option key={periodo.id} value={periodo.id}>
                  {periodo.nombre}
                </option>
              ))}
            </Selector>

            <Selector
              id="filtroEstado"
              etiqueta="Filtrar por nivel de cumplimiento"
              etiquetaOculta
              value={estado}
              onChange={(e) => establecerEstado(e.target.value)}
            >
              <option value="">Todo el cumplimiento</option>
              <option value="CUMPLIDO">Cumplido</option>
              <option value="PARCIAL">Parcial</option>
              <option value="NO_CUMPLIDO">No cumplido</option>
            </Selector>
          </div>
        }
      >
        {lista.length === 0 ? (
          <Vacio
            titulo="No hay avances que coincidan"
            descripcion="Ajusta los filtros, o espera a que los docentes registren avances sobre sus planeaciones aprobadas."
          />
        ) : (
          lista.map((avance) => (
            <Renglon key={avance.id}>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <p className="font-titulo text-base font-semibold text-tinta">
                    {avance.planeacion?.usuario?.nombre ?? 'Docente'}
                  </p>
                  <p className="mt-0.5 text-sm text-grafito">
                    {avance.planeacion?.materia.nombre} ·{' '}
                    {avance.planeacion?.materia.clave} · Parcial{' '}
                    <span className="cifra">{avance.planeacion?.parcial}</span> ·{' '}
                    {avance.planeacion?.periodo.nombre}
                  </p>

                  <p className="mt-1.5 text-sm text-tinta-suave">
                    Informado del {fechaLegible(avance.fechaInicio)} al{' '}
                    {fechaLegible(avance.fechaFin)}
                    {avance.diasHabiles !== undefined ? (
                      <>
                        {' · '}
                        <span className="cifra">{avance.diasHabiles}</span> días hábiles
                      </>
                    ) : null}
                  </p>

                  {avance.observaciones ? (
                    <p className="recuadro mt-2 px-3 py-2 text-sm text-tinta-suave">
                      {avance.observaciones}
                    </p>
                  ) : null}
                </div>

                <div className="flex items-center gap-4">
                  <p className="cifra font-titulo text-2xl font-semibold text-tinta">
                    {avance.porcentaje}
                    <span className="text-base font-medium text-grafito">%</span>
                  </p>
                  <Sello estado={avance.estado} />
                </div>
              </div>
            </Renglon>
          ))
        )}
      </Acta>
    </div>
  );
}
