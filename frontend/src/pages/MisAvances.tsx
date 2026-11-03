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
  const [porcentaje, establecerPorcentaje] = useState('');
  const [observaciones, establecerObservaciones] = useState('');
  const [error, establecerError] = useState<string | null>(null);
  const [enviando, establecerEnviando] = useState(false);

  const enviar = async (evento: FormEvent) => {
    evento.preventDefault();
    establecerError(null);
    establecerEnviando(true);

    try {
      await avances.crear({
        planeacionId: planeacion.id,
        porcentaje: Number(porcentaje),
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

        <Campo
          id="porcentaje"
          etiqueta="Porcentaje logrado"
          type="number"
          min={0}
          max={100}
          step={1}
          ayuda="A partir de 85% se clasifica como cumplido; de 60 a 84% como parcial; por debajo de 60% como no cumplido."
          value={porcentaje}
          onChange={(e) => establecerPorcentaje(e.target.value)}
          required
          requerido
        />

        <AreaTexto
          id="observaciones"
          etiqueta="Observaciones"
          ayuda="Opcional. Explica cualquier circunstancia que afectó el avance."
          value={observaciones}
          onChange={(e) => establecerObservaciones(e.target.value)}
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
