import { useCallback, useState, type FormEvent } from 'react';

import { catalogos, evidencias } from '../api/servicios';
import { mensajeDeError } from '../api/cliente';
import { useCargaRemota } from '../hooks/useCargaRemota';
import { Acta, Renglon } from '../components/Acta';
import { Aviso } from '../components/Aviso';
import { Boton, Campo } from '../components/Controles';
import { Cargando } from '../components/Cargando';
import { Dialogo } from '../components/Dialogo';
import { Sello } from '../components/Sello';
import { Vacio } from '../components/Vacio';
import type { Evidencia, PeriodoAcademico } from '../types';

interface DatosPantalla {
  lista: Evidencia[];
  periodo: PeriodoAcademico | null;
}

/** Módulo 3 — Evidencias de capacitación, vista del docente. */
export function MisEvidencias() {
  const cargador = useCallback(async (): Promise<DatosPantalla> => {
    const [lista, periodo] = await Promise.all([
      evidencias.listar(),
      catalogos.periodoActivo(),
    ]);
    return { lista, periodo };
  }, []);

  const { datos, cargando, error, recargar } = useCargaRemota(
    cargador,
    'No se pudieron cargar tus constancias.',
  );

  const [dialogoAbierto, establecerDialogoAbierto] = useState(false);

  if (cargando) return <Cargando mensaje="Cargando tus constancias" />;
  if (error && !datos) return <Aviso>{error}</Aviso>;
  if (!datos) return null;

  const { lista, periodo } = datos;

  const horasValidadas = lista
    .filter((e) => e.estado === 'VALIDADA')
    .reduce((suma, e) => suma + e.horas, 0);

  return (
    <div className="space-y-4">
      {error ? <Aviso>{error}</Aviso> : null}

      <Acta
        titulo="Mis constancias"
        referencia={
          lista.length > 0
            ? `${horasValidadas} horas acreditadas en el periodo`
            : (periodo?.nombre ?? 'Sin periodo activo')
        }
        acciones={
          <Boton onClick={() => establecerDialogoAbierto(true)} disabled={!periodo}>
            Cargar constancia
          </Boton>
        }
      >
        {lista.length === 0 ? (
          <Vacio
            titulo="No has cargado constancias"
            descripcion="Adjunta la constancia de cada curso que tomaste en el periodo. Coordinación las valida y solo las validadas cuentan en tus horas acreditadas."
            accion={
              <Boton onClick={() => establecerDialogoAbierto(true)} disabled={!periodo}>
                Cargar la primera
              </Boton>
            }
          />
        ) : (
          lista.map((registro) => (
            <Renglon key={registro.id}>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <p className="font-titulo text-base font-semibold text-tinta">
                    {registro.nombreCurso}
                  </p>
                  <p className="mt-0.5 text-sm text-grafito">
                    {registro.institucion} ·{' '}
                    <span className="cifra">{registro.horas}</span> horas ·{' '}
                    {new Date(registro.fecha).toLocaleDateString('es-MX', {
                      day: 'numeric',
                      month: 'long',
                      year: 'numeric',
                      timeZone: 'UTC',
                    })}
                  </p>

                  {registro.motivoRechazo ? (
                    <p className="mt-2 border-l-[3px] border-lapiz bg-lapiz-claro px-3 py-2 text-sm text-lapiz">
                      {registro.motivoRechazo}
                    </p>
                  ) : null}

                  <a
                    href={registro.archivoUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="mt-2 inline-block text-sm font-medium text-sello hover:underline"
                  >
                    Ver constancia
                  </a>
                </div>

                <Sello estado={registro.estado} />
              </div>
            </Renglon>
          ))
        )}
      </Acta>

      {dialogoAbierto && periodo ? (
        <FormularioEvidencia
          periodo={periodo}
          onCerrar={() => establecerDialogoAbierto(false)}
          onGuardado={() => {
            establecerDialogoAbierto(false);
            recargar();
          }}
        />
      ) : null}
    </div>
  );
}

function FormularioEvidencia({
  periodo,
  onCerrar,
  onGuardado,
}: {
  periodo: PeriodoAcademico;
  onCerrar: () => void;
  onGuardado: () => void;
}) {
  const [nombreCurso, establecerNombreCurso] = useState('');
  const [institucion, establecerInstitucion] = useState('');
  const [fecha, establecerFecha] = useState('');
  const [horas, establecerHoras] = useState('');
  const [archivo, establecerArchivo] = useState<File | null>(null);
  const [error, establecerError] = useState<string | null>(null);
  const [enviando, establecerEnviando] = useState(false);

  const enviar = async (evento: FormEvent) => {
    evento.preventDefault();
    establecerError(null);

    if (!archivo) {
      establecerError('Adjunta el archivo de la constancia en PDF, JPG o PNG.');
      return;
    }

    establecerEnviando(true);
    try {
      await evidencias.crear({
        nombreCurso,
        institucion,
        fecha,
        horas: Number(horas),
        periodoId: periodo.id,
        archivo,
      });
      onGuardado();
    } catch (fallo) {
      establecerError(
        mensajeDeError(fallo, 'No se pudo cargar la constancia. Revisa los datos.'),
      );
      establecerEnviando(false);
    }
  };

  return (
    <Dialogo titulo="Cargar constancia" onCerrar={onCerrar}>
      <form onSubmit={(e) => void enviar(e)} className="space-y-4" noValidate>
        {error ? <Aviso>{error}</Aviso> : null}

        <Campo
          id="nombreCurso"
          etiqueta="Nombre del curso"
          value={nombreCurso}
          onChange={(e) => establecerNombreCurso(e.target.value)}
          required
          requerido
        />

        <Campo
          id="institucion"
          etiqueta="Institución emisora"
          value={institucion}
          onChange={(e) => establecerInstitucion(e.target.value)}
          required
          requerido
        />

        <div className="grid gap-4 sm:grid-cols-2">
          <Campo
            id="fecha"
            etiqueta="Fecha de conclusión"
            type="date"
            value={fecha}
            onChange={(e) => establecerFecha(e.target.value)}
            required
            requerido
          />
          <Campo
            id="horas"
            etiqueta="Horas acreditadas"
            type="number"
            min={1}
            max={500}
            value={horas}
            onChange={(e) => establecerHoras(e.target.value)}
            required
            requerido
          />
        </div>

        <div>
          <label
            htmlFor="archivo"
            className="mb-1.5 block text-sm font-medium text-tinta"
          >
            Archivo de la constancia
            <span className="ml-0.5 text-lapiz">*</span>
          </label>
          <input
            id="archivo"
            type="file"
            accept="application/pdf,image/jpeg,image/png"
            onChange={(e) => establecerArchivo(e.target.files?.[0] ?? null)}
            className="w-full rounded-[3px] border border-regla-fuerte bg-panel px-3 py-2 text-sm file:mr-3 file:rounded-[3px] file:border-0 file:bg-sello-claro file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-sello"
            required
          />
          <p className="mt-1 text-xs text-grafito">PDF, JPG o PNG. Máximo 5 MB.</p>
        </div>

        <div className="flex justify-end gap-2 border-t border-regla pt-4">
          <Boton type="button" variante="contorno" onClick={onCerrar}>
            Cancelar
          </Boton>
          <Boton type="submit" disabled={enviando}>
            {enviando ? 'Cargando…' : 'Cargar constancia'}
          </Boton>
        </div>
      </form>
    </Dialogo>
  );
}
