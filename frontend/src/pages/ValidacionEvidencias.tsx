import { useCallback, useState, type FormEvent } from 'react';

import { evidencias } from '../api/servicios';
import { mensajeDeError } from '../api/cliente';
import { useCargaRemota } from '../hooks/useCargaRemota';
import { Acta, Renglon } from '../components/Acta';
import { Aviso } from '../components/Aviso';
import { AreaTexto, Boton } from '../components/Controles';
import { Cargando } from '../components/Cargando';
import { Dialogo } from '../components/Dialogo';
import { Sello } from '../components/Sello';
import { Vacio } from '../components/Vacio';
import {
  LIMITES,
  enfocarPrimerError,
  reunirErrores,
  validarTexto,
} from '../utils/validacion';
import type { EstadoEvidencia, Evidencia } from '../types';

/** Módulo 3 — Validación de constancias, vista de coordinación. */
export function ValidacionEvidencias() {
  const [soloPendientes, establecerSoloPendientes] = useState(true);

  const cargador = useCallback(
    () => evidencias.listar(soloPendientes ? { estado: 'PENDIENTE' } : {}),
    [soloPendientes],
  );

  const { datos, cargando, error, recargar } = useCargaRemota(
    cargador,
    'No se pudo cargar la bandeja.',
  );

  const [enValidacion, establecerEnValidacion] = useState<Evidencia | null>(null);
  const [recienResuelto, establecerRecienResuelto] = useState<string | null>(null);

  const lista = datos ?? [];

  return (
    <div className="space-y-4">
      {error ? <Aviso>{error}</Aviso> : null}

      <Acta
        titulo="Validación de constancias"
        referencia={
          soloPendientes
            ? 'Constancias en espera de validación'
            : 'Todas las constancias del periodo'
        }
        acciones={
          <Boton
            variante="contorno"
            onClick={() => establecerSoloPendientes(!soloPendientes)}
          >
            {soloPendientes ? 'Ver todas' : 'Ver solo pendientes'}
          </Boton>
        }
      >
        {cargando ? (
          <Cargando mensaje="Cargando la bandeja" />
        ) : lista.length === 0 ? (
          <Vacio
            titulo={
              soloPendientes
                ? 'No hay constancias por validar'
                : 'No hay constancias registradas'
            }
            descripcion={
              soloPendientes
                ? 'Toda la capacitación cargada ya fue validada o rechazada. Cambia el filtro para consultar el historial.'
                : 'Cuando el personal docente cargue sus constancias, aparecerán aquí.'
            }
          />
        ) : (
          lista.map((registro) => (
            <Renglon key={registro.id} interactivo>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <p className="font-titulo text-base font-semibold text-tinta">
                    {registro.nombreCurso}
                  </p>
                  <p className="mt-0.5 text-sm text-grafito">
                    {registro.usuario.nombre} · {registro.institucion} ·{' '}
                    <span className="cifra">{registro.horas}</span> horas
                  </p>
                  <a
                    href={registro.archivoUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="mt-2 inline-block text-sm font-medium text-sello hover:underline"
                  >
                    Abrir constancia
                  </a>
                </div>

                <div className="flex flex-col items-end gap-2">
                  <Sello
                    estado={registro.estado}
                    estampado={recienResuelto === registro.id}
                  />
                  {registro.estado === 'PENDIENTE' ? (
                    <Boton onClick={() => establecerEnValidacion(registro)}>
                      Validar
                    </Boton>
                  ) : null}
                </div>
              </div>
            </Renglon>
          ))
        )}
      </Acta>

      {enValidacion ? (
        <FormularioValidacion
          evidencia={enValidacion}
          onCerrar={() => establecerEnValidacion(null)}
          onResuelto={(id) => {
            establecerEnValidacion(null);
            establecerRecienResuelto(id);
            recargar();
          }}
        />
      ) : null}
    </div>
  );
}

function FormularioValidacion({
  evidencia,
  onCerrar,
  onResuelto,
}: {
  evidencia: Evidencia;
  onCerrar: () => void;
  onResuelto: (id: string) => void;
}) {
  const [estado, establecerEstado] = useState<EstadoEvidencia>('VALIDADA');
  const [motivo, establecerMotivo] = useState('');
  const [errores, establecerErrores] = useState<Record<string, string>>({});
  const [error, establecerError] = useState<string | null>(null);
  const [enviando, establecerEnviando] = useState(false);

  const rechaza = estado === 'RECHAZADA';

  const enviar = async (evento: FormEvent) => {
    evento.preventDefault();
    establecerError(null);

    const encontrados = reunirErrores({
      motivo: rechaza
        ? validarTexto(motivo, {
            etiqueta: 'El motivo',
            requerido: true,
            minimo: LIMITES.motivoRechazo.minimo,
            maximo: LIMITES.motivoRechazo.maximo,
          })
        : null,
    });
    establecerErrores(encontrados);

    if (Object.keys(encontrados).length > 0) {
      enfocarPrimerError(encontrados);
      return;
    }

    establecerEnviando(true);

    try {
      await evidencias.validar(evidencia.id, {
        estado,
        motivoRechazo: rechaza ? motivo.trim() : undefined,
      });
      onResuelto(evidencia.id);
    } catch (fallo) {
      establecerError(mensajeDeError(fallo, 'No se pudo registrar la validación.'));
      establecerEnviando(false);
    }
  };

  return (
    <Dialogo titulo="Validar constancia" onCerrar={onCerrar}>
      <form onSubmit={(e) => void enviar(e)} className="space-y-4" noValidate>
        {error ? <Aviso>{error}</Aviso> : null}

        <div className="border border-regla bg-papel px-4 py-3">
          <p className="text-sm font-medium text-tinta">{evidencia.nombreCurso}</p>
          <p className="mt-0.5 text-sm text-grafito">
            {evidencia.usuario.nombre} · {evidencia.institucion}
          </p>
          <p className="mt-0.5 text-sm text-grafito">
            <span className="cifra">{evidencia.horas}</span> horas ·{' '}
            {new Date(evidencia.fecha).toLocaleDateString('es-MX', {
              day: 'numeric',
              month: 'long',
              year: 'numeric',
              timeZone: 'UTC',
            })}
          </p>
          <a
            href={evidencia.archivoUrl}
            target="_blank"
            rel="noreferrer"
            className="mt-2 inline-block text-sm font-medium text-sello hover:underline"
          >
            Abrir el archivo para revisarlo
          </a>
        </div>

        <fieldset>
          <legend className="mb-2 text-sm font-medium text-tinta">Resolución</legend>
          <div className="space-y-2">
            <label className="flex cursor-pointer items-start gap-2.5 text-sm">
              <input
                type="radio"
                name="resolucion"
                checked={estado === 'VALIDADA'}
                onChange={() => establecerEstado('VALIDADA')}
                className="mt-1 accent-[#5a3c8f]"
              />
              <span>
                <span className="font-medium text-tinta">Validar</span>
                <span className="block text-grafito">
                  Las horas se suman a la capacitación acreditada del docente.
                </span>
              </span>
            </label>

            <label className="flex cursor-pointer items-start gap-2.5 text-sm">
              <input
                type="radio"
                name="resolucion"
                checked={rechaza}
                onChange={() => establecerEstado('RECHAZADA')}
                className="mt-1 accent-[#ae3f2c]"
              />
              <span>
                <span className="font-medium text-tinta">Rechazar</span>
                <span className="block text-grafito">
                  Las horas no cuentan. El docente verá el motivo.
                </span>
              </span>
            </label>
          </div>
        </fieldset>

        {rechaza ? (
          <AreaTexto
            id="motivo"
            etiqueta="Motivo del rechazo"
            ayuda="Explica qué le falta a la constancia. El docente verá este texto."
            maximo={LIMITES.motivoRechazo.maximo}
            value={motivo}
            error={errores.motivo}
            onChange={(e) => {
              establecerMotivo(e.target.value);
              establecerErrores((p) => {
                const { motivo: _, ...r } = p;
                return r;
              });
            }}
            requerido
          />
        ) : null}

        <div className="flex justify-end gap-2 border-t border-regla pt-4">
          <Boton type="button" variante="contorno" onClick={onCerrar}>
            Cancelar
          </Boton>
          <Boton
            type="submit"
            variante={rechaza ? 'peligro' : 'solida'}
            disabled={enviando}
          >
            {enviando ? 'Registrando…' : rechaza ? 'Rechazar' : 'Validar'}
          </Boton>
        </div>
      </form>
    </Dialogo>
  );
}
