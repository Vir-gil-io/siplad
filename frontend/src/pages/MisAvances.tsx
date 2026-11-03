import { useCallback, useState, type FormEvent } from 'react';

import { avances, planeaciones } from '../api/servicios';
import { mensajeDeError } from '../api/cliente';
import { useCargaRemota } from '../hooks/useCargaRemota';
import { Acta, Renglon } from '../components/Acta';
import { Aviso } from '../components/Aviso';
import { AreaTexto, Boton, Campo } from '../components/Controles';
import { Cargando } from '../components/Cargando';
import { Dialogo } from '../components/Dialogo';
import { Sello } from '../components/Sello';
import { Vacio } from '../components/Vacio';
import {
  LIMITES,
  enfocarPrimerError,
  fechaLegible,
  reunirErrores,
  validarEntero,
  validarTexto,
  validarTramo,
} from '../utils/validacion';
import type { Planeacion } from '../types';

/**
 * Módulo 2 — Control de avances por parcial, vista del docente.
 *
 * El avance solo puede registrarse sobre una planeación aprobada, así que la
 * lista parte de las aprobadas y cada renglón muestra si ya tiene avance.
 */
export function MisAvances() {
  const cargador = useCallback(() => planeaciones.listar({ estado: 'APROBADA' }), []);

  const { datos, cargando, error, recargar } = useCargaRemota(
    cargador,
    'No se pudieron cargar tus avances.',
  );

  const [seleccionada, establecerSeleccionada] = useState<Planeacion | null>(null);
  const [recienGuardado, establecerRecienGuardado] = useState<string | null>(null);

  if (cargando) return <Cargando mensaje="Cargando tus avances" />;
  if (error && !datos) return <Aviso>{error}</Aviso>;

  const aprobadas = datos ?? [];

  return (
    <div className="space-y-4">
      {error ? <Aviso>{error}</Aviso> : null}

      <Acta
        titulo="Mis avances"
        referencia="El avance se registra sobre planeaciones aprobadas"
      >
        {aprobadas.length === 0 ? (
          <Vacio
            titulo="No tienes planeaciones aprobadas todavía"
            descripcion="El avance se registra sobre una planeación ya aprobada por coordinación. En cuanto aprueben alguna, aparecerá aquí para que informes el porcentaje logrado."
          />
        ) : (
          aprobadas.map((registro) => (
            <Renglon key={registro.id}>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <p className="font-titulo text-base font-semibold text-tinta">
                    {registro.materia.nombre}
                  </p>
                  <p className="mt-0.5 text-sm text-grafito">
                    {registro.materia.clave} · Parcial{' '}
                    <span className="cifra">{registro.parcial}</span>
                  </p>

                  {registro.avance ? (
                    <p className="mt-1.5 text-sm text-tinta-suave">
                      Informado del {fechaLegible(registro.avance.fechaInicio)} al{' '}
                      {fechaLegible(registro.avance.fechaFin)}
                      {registro.avance.diasHabiles !== undefined ? (
                        <>
                          {' · '}
                          <span className="cifra">
                            {registro.avance.diasHabiles}
                          </span>{' '}
                          días hábiles
                        </>
                      ) : null}
                    </p>
                  ) : null}

                  {registro.avance?.observaciones ? (
                    <p className="mt-2 text-sm text-tinta-suave">
                      {registro.avance.observaciones}
                    </p>
                  ) : null}
                </div>

                <div className="flex items-center gap-4">
                  {registro.avance ? (
                    <>
                      <p className="cifra font-titulo text-2xl font-semibold text-tinta">
                        {registro.avance.porcentaje}
                        <span className="text-base font-medium text-grafito">%</span>
                      </p>
                      <Sello
                        estado={registro.avance.estado}
                        estampado={recienGuardado === registro.id}
                      />
                    </>
                  ) : (
                    <Boton onClick={() => establecerSeleccionada(registro)}>
                      Registrar avance
                    </Boton>
                  )}
                </div>
              </div>
            </Renglon>
          ))
        )}
      </Acta>

      {seleccionada ? (
        <FormularioAvance
          planeacion={seleccionada}
          onCerrar={() => establecerSeleccionada(null)}
          onGuardado={(planeacionId) => {
            establecerSeleccionada(null);
            establecerRecienGuardado(planeacionId);
            recargar();
          }}
        />
      ) : null}
    </div>
  );
}

function FormularioAvance({
  planeacion,
  onCerrar,
  onGuardado,
}: {
  planeacion: Planeacion;
  onCerrar: () => void;
  onGuardado: (planeacionId: string) => void;
}) {
  const periodo = planeacion.periodo;
  const hoy = new Date().toISOString().slice(0, 10);

  // El tramo se propone completo —del inicio del periodo hasta hoy— y el
  // docente lo acota. Partir de un campo vacio obliga a teclear dos fechas
  // para el caso mas comun, que es informar sobre todo lo transcurrido.
  const [fechaInicio, establecerFechaInicio] = useState(periodo.fechaInicio.slice(0, 10));
  const [fechaFin, establecerFechaFin] = useState(
    periodo.fechaFin.slice(0, 10) < hoy ? periodo.fechaFin.slice(0, 10) : hoy,
  );
  const [porcentaje, establecerPorcentaje] = useState('');
  const [observaciones, establecerObservaciones] = useState('');
  const [errores, establecerErrores] = useState<Record<string, string>>({});
  const [error, establecerError] = useState<string | null>(null);
  const [enviando, establecerEnviando] = useState(false);

  const enviar = async (evento: FormEvent) => {
    evento.preventDefault();
    establecerError(null);

    const tramo = validarTramo(fechaInicio, fechaFin, periodo);

    const encontrados = reunirErrores({
      fechaInicio: tramo.fechaInicio,
      fechaFin: tramo.fechaFin,
      porcentaje: validarEntero(porcentaje, {
        etiqueta: 'El porcentaje',
        minimo: 0,
        maximo: 100,
        requerido: true,
      }),
      observaciones: validarTexto(observaciones, {
        etiqueta: 'Las observaciones',
        maximo: LIMITES.observacionesAvance.maximo,
      }),
    });
    establecerErrores(encontrados);

    if (Object.keys(encontrados).length > 0) {
      enfocarPrimerError(encontrados);
      return;
    }

    establecerEnviando(true);

    try {
      await avances.crear({
        planeacionId: planeacion.id,
        porcentaje: Number(porcentaje),
        fechaInicio,
        fechaFin,
        observaciones: observaciones.trim() || undefined,
      });
      onGuardado(planeacion.id);
    } catch (fallo) {
      establecerError(
        mensajeDeError(fallo, 'No se pudo registrar el avance. Revisa los datos.'),
      );
      establecerEnviando(false);
    }
  };

  return (
    <Dialogo titulo="Registrar avance del parcial" onCerrar={onCerrar}>
      <form onSubmit={(e) => void enviar(e)} className="space-y-4" noValidate>
        {error ? <Aviso>{error}</Aviso> : null}

        <p className="text-sm text-grafito">
          {planeacion.materia.nombre} · Parcial{' '}
          <span className="cifra">{planeacion.parcial}</span>
        </p>

        <fieldset className="recuadro px-3 py-3">
          <legend className="px-1 text-sm font-medium text-tinta">
            Tramo que informas
          </legend>
          <p className="mb-3 text-xs text-grafito">
            El avance corresponde a este intervalo. Debe quedar dentro de {periodo.nombre}
            , del {fechaLegible(periodo.fechaInicio)} al {fechaLegible(periodo.fechaFin)}.
          </p>

          <div className="grid gap-4 sm:grid-cols-2">
            <Campo
              id="fechaInicio"
              etiqueta="Desde"
              type="date"
              min={periodo.fechaInicio.slice(0, 10)}
              max={hoy}
              value={fechaInicio}
              error={errores.fechaInicio}
              onChange={(e) => {
                establecerFechaInicio(e.target.value);
                establecerErrores((p) => {
                  const { fechaInicio: _, ...r } = p;
                  return r;
                });
              }}
              requerido
            />
            <Campo
              id="fechaFin"
              etiqueta="Hasta"
              type="date"
              min={fechaInicio || periodo.fechaInicio.slice(0, 10)}
              max={
                periodo.fechaFin.slice(0, 10) < hoy ? periodo.fechaFin.slice(0, 10) : hoy
              }
              value={fechaFin}
              error={errores.fechaFin}
              onChange={(e) => {
                establecerFechaFin(e.target.value);
                establecerErrores((p) => {
                  const { fechaFin: _, ...r } = p;
                  return r;
                });
              }}
              requerido
            />
          </div>
        </fieldset>

        <Campo
          id="porcentaje"
          etiqueta="Porcentaje logrado"
          type="number"
          inputMode="numeric"
          min={0}
          max={100}
          step={1}
          ayuda="A partir de 85% se clasifica como cumplido; de 60 a 84% como parcial; por debajo de 60% como no cumplido."
          value={porcentaje}
          error={errores.porcentaje}
          onChange={(e) => {
            establecerPorcentaje(e.target.value);
            establecerErrores((p) => {
              const { porcentaje: _, ...r } = p;
              return r;
            });
          }}
          requerido
        />

        <AreaTexto
          id="observaciones"
          etiqueta="Observaciones"
          ayuda="Opcional. Explica cualquier circunstancia que afectó el avance."
          maximo={LIMITES.observacionesAvance.maximo}
          value={observaciones}
          error={errores.observaciones}
          onChange={(e) => {
            establecerObservaciones(e.target.value);
            establecerErrores((p) => {
              const { observaciones: _, ...r } = p;
              return r;
            });
          }}
        />

        <div className="flex justify-end gap-2 border-t border-regla pt-4">
          <Boton type="button" variante="contorno" onClick={onCerrar}>
            Cancelar
          </Boton>
          <Boton type="submit" disabled={enviando}>
            {enviando ? 'Guardando…' : 'Registrar avance'}
          </Boton>
        </div>
      </form>
    </Dialogo>
  );
}
