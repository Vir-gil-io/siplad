import { useCallback, useState, type FormEvent } from 'react';

import { planeaciones } from '../api/servicios';
import { mensajeDeError } from '../api/cliente';
import { useCargaRemota } from '../hooks/useCargaRemota';
import { Acta, Renglon } from '../components/Acta';
import { Aviso } from '../components/Aviso';
import { AreaTexto, Boton, BotonDocumento } from '../components/Controles';
import { Cargando } from '../components/Cargando';
import { Dialogo } from '../components/Dialogo';
import { VisorDocumento } from '../components/VisorDocumento';
import { Sello } from '../components/Sello';
import { Vacio } from '../components/Vacio';
import {
  LIMITES,
  enfocarPrimerError,
  reunirErrores,
  validarTexto,
} from '../utils/validacion';
import type { EstadoPlaneacion, Planeacion } from '../types';

/**
 * Módulo 1 — Revisión de planeaciones, vista de coordinación.
 *
 * Abre filtrada en lo que está en revisión, porque es la cola de trabajo real.
 */
export function RevisionPlaneaciones() {
  const [soloPendientes, establecerSoloPendientes] = useState(true);

  const cargador = useCallback(
    () => planeaciones.listar(soloPendientes ? { estado: 'ENVIADA' } : {}),
    [soloPendientes],
  );

  const { datos, cargando, error, recargar } = useCargaRemota(
    cargador,
    'No se pudo cargar la bandeja.',
  );

  const [enRevision, establecerEnRevision] = useState<Planeacion | null>(null);

  // Una sola instancia del visor atiende a la bandeja y al diálogo de
  // dictamen, que puede abrirlo encima sin perder el formulario a medias.
  const [enVisor, establecerEnVisor] = useState<Planeacion | null>(null);
  const [recienResuelto, establecerRecienResuelto] = useState<string | null>(null);

  const lista = datos ?? [];

  return (
    <div className="space-y-4">
      {error ? <Aviso>{error}</Aviso> : null}

      <Acta
        titulo="Revisión de planeaciones"
        referencia={
          soloPendientes
            ? 'Planeaciones en espera de dictamen'
            : 'Todas las planeaciones del periodo'
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
                ? 'No hay planeaciones por revisar'
                : 'No hay planeaciones registradas'
            }
            descripcion={
              soloPendientes
                ? 'Toda la planeación enviada ya tiene dictamen. Cambia el filtro para consultar el historial del periodo.'
                : 'Cuando el personal docente registre su planeación, aparecerá aquí para su revisión.'
            }
          />
        ) : (
          lista.map((registro) => (
            <Renglon key={registro.id} interactivo>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <p className="font-titulo text-base font-semibold text-tinta">
                    {registro.usuario.nombre}
                  </p>
                  <p className="mt-0.5 text-sm text-grafito">
                    {registro.materia.clave} · {registro.materia.nombre} · Parcial{' '}
                    <span className="cifra">{registro.parcial}</span>
                  </p>
                  <p className="mt-2 max-w-[80ch] text-sm leading-relaxed text-tinta-suave">
                    {registro.contenido.length > 220
                      ? `${registro.contenido.slice(0, 220)}…`
                      : registro.contenido}
                  </p>

                  {registro.archivoUrl ? (
                    <div className="mt-2.5">
                      <BotonDocumento onVer={() => establecerEnVisor(registro)} />
                    </div>
                  ) : null}
                </div>

                <div className="flex flex-col items-end gap-2">
                  <Sello
                    estado={registro.estado}
                    estampado={recienResuelto === registro.id}
                  />
                  {registro.estado === 'ENVIADA' ? (
                    <Boton onClick={() => establecerEnRevision(registro)}>
                      Dictaminar
                    </Boton>
                  ) : null}
                </div>
              </div>
            </Renglon>
          ))
        )}
      </Acta>

      {enRevision ? (
        <FormularioDictamen
          planeacion={enRevision}
          onCerrar={() => establecerEnRevision(null)}
          onVerDocumento={establecerEnVisor}
          onResuelto={(id) => {
            establecerEnRevision(null);
            establecerRecienResuelto(id);
            recargar();
          }}
        />
      ) : null}

      {enVisor?.archivoUrl ? (
        <VisorDocumento
          url={enVisor.archivoUrl}
          titulo="Documento de la planeación"
          subtitulo={`${enVisor.usuario.nombre} · ${enVisor.materia.nombre} · Parcial ${enVisor.parcial}`}
          onCerrar={() => establecerEnVisor(null)}
        />
      ) : null}
    </div>
  );
}

function FormularioDictamen({
  planeacion,
  onCerrar,
  onVerDocumento,
  onResuelto,
}: {
  planeacion: Planeacion;
  onCerrar: () => void;
  onVerDocumento: (planeacion: Planeacion) => void;
  onResuelto: (id: string) => void;
}) {
  const [estado, establecerEstado] = useState<EstadoPlaneacion>('APROBADA');
  const [comentario, establecerComentario] = useState('');
  const [errores, establecerErrores] = useState<Record<string, string>>({});
  const [error, establecerError] = useState<string | null>(null);
  const [enviando, establecerEnviando] = useState(false);

  const pideAjustes = estado === 'AJUSTES_SOLICITADOS';

  const enviar = async (evento: FormEvent) => {
    evento.preventDefault();
    establecerError(null);

    // El comentario solo es obligatorio cuando se solicitan ajustes: aprobar
    // no requiere justificacion escrita.
    const encontrados = reunirErrores({
      comentario: pideAjustes
        ? validarTexto(comentario, {
            etiqueta: 'Las observaciones',
            requerido: true,
            minimo: LIMITES.comentarioRevision.minimo,
            maximo: LIMITES.comentarioRevision.maximo,
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
      await planeaciones.revisar(planeacion.id, {
        estado,
        comentarioRevision: pideAjustes ? comentario : undefined,
      });
      onResuelto(planeacion.id);
    } catch (fallo) {
      establecerError(mensajeDeError(fallo, 'No se pudo registrar el dictamen.'));
      establecerEnviando(false);
    }
  };

  return (
    <Dialogo titulo="Dictaminar planeación" onCerrar={onCerrar}>
      <form onSubmit={(e) => void enviar(e)} className="space-y-4" noValidate>
        {error ? <Aviso>{error}</Aviso> : null}

        <div className="recuadro px-4 py-3">
          <p className="text-sm font-medium text-tinta">{planeacion.usuario.nombre}</p>
          <p className="mt-0.5 text-sm text-grafito">
            {planeacion.materia.nombre} · Parcial{' '}
            <span className="cifra">{planeacion.parcial}</span>
          </p>
          <p className="mt-2.5 max-h-48 overflow-y-auto text-sm leading-relaxed text-tinta-suave">
            {planeacion.contenido}
          </p>

          {planeacion.archivoUrl ? (
            <div className="mt-3 border-t border-regla pt-3">
              <BotonDocumento
                onVer={() => onVerDocumento(planeacion)}
                etiqueta="Ver el documento antes de dictaminar"
              />
            </div>
          ) : null}
        </div>

        <fieldset>
          <legend className="mb-2 text-sm font-medium text-tinta">Dictamen</legend>
          <div className="space-y-2">
            <label className="flex cursor-pointer items-start gap-2.5 text-sm">
              <input
                type="radio"
                name="dictamen"
                checked={estado === 'APROBADA'}
                onChange={() => establecerEstado('APROBADA')}
                className="mt-1 accent-[#5a3c8f]"
              />
              <span>
                <span className="font-medium text-tinta">Aprobar</span>
                <span className="block text-grafito">
                  La planeación cumple los lineamientos. El docente podrá registrar
                  avances sobre ella.
                </span>
              </span>
            </label>

            <label className="flex cursor-pointer items-start gap-2.5 text-sm">
              <input
                type="radio"
                name="dictamen"
                checked={pideAjustes}
                onChange={() => establecerEstado('AJUSTES_SOLICITADOS')}
                className="mt-1 accent-[#ae3f2c]"
              />
              <span>
                <span className="font-medium text-tinta">Solicitar ajustes</span>
                <span className="block text-grafito">
                  Regresa al docente con tus observaciones para que la corrija.
                </span>
              </span>
            </label>
          </div>
        </fieldset>

        {pideAjustes ? (
          <AreaTexto
            id="comentario"
            etiqueta="Observaciones"
            ayuda="Indica con precisión qué debe corregirse. El docente verá este texto."
            maximo={LIMITES.comentarioRevision.maximo}
            value={comentario}
            error={errores.comentario}
            onChange={(e) => {
              establecerComentario(e.target.value);
              establecerErrores((p) => {
                const { comentario: _, ...resto } = p;
                return resto;
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
            variante={pideAjustes ? 'peligro' : 'solida'}
            disabled={enviando}
          >
            {enviando ? 'Registrando…' : pideAjustes ? 'Solicitar ajustes' : 'Aprobar'}
          </Boton>
        </div>
      </form>
    </Dialogo>
  );
}
