import { useCallback, useState, type FormEvent } from 'react';

import { catalogos, evidencias } from '../api/servicios';
import { mensajeDeError } from '../api/cliente';
import { useCargaRemota } from '../hooks/useCargaRemota';
import { Acta, Renglon } from '../components/Acta';
import { Aviso } from '../components/Aviso';
import { Boton, BotonDocumento, Campo, CampoArchivo } from '../components/Controles';
import { Cargando } from '../components/Cargando';
import { Dialogo } from '../components/Dialogo';
import { VisorDocumento } from '../components/VisorDocumento';
import { Sello } from '../components/Sello';
import { Vacio } from '../components/Vacio';
import {
  ARCHIVO,
  LIMITES,
  enfocarPrimerError,
  reunirErrores,
  validarArchivo,
  validarEntero,
  validarFecha,
  validarTexto,
} from '../utils/validacion';
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
  const [enVisor, establecerEnVisor] = useState<Evidencia | null>(null);

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

                  <div className="mt-2.5">
                    <BotonDocumento
                      onVer={() => establecerEnVisor(registro)}
                      etiqueta="Ver constancia"
                    />
                  </div>
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

      {enVisor ? (
        <VisorDocumento
          url={enVisor.archivoUrl}
          titulo="Constancia de capacitación"
          subtitulo={`${enVisor.nombreCurso} · ${enVisor.institucion} · ${enVisor.horas} horas`}
          onCerrar={() => establecerEnVisor(null)}
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

  const [errores, establecerErrores] = useState<Record<string, string>>({});
  const [error, establecerError] = useState<string | null>(null);
  const [enviando, establecerEnviando] = useState(false);

  /** Las reglas replican una a una las del DTO del backend. */
  const validar = () =>
    reunirErrores({
      nombreCurso: validarTexto(nombreCurso, {
        etiqueta: 'El nombre del curso',
        requerido: true,
        minimo: LIMITES.nombreCurso.minimo,
        maximo: LIMITES.nombreCurso.maximo,
      }),
      institucion: validarTexto(institucion, {
        etiqueta: 'La institución',
        requerido: true,
        minimo: LIMITES.institucion.minimo,
        maximo: LIMITES.institucion.maximo,
      }),
      fecha: validarFecha(fecha, 'La fecha de conclusión'),
      horas: validarEntero(horas, {
        etiqueta: 'Las horas',
        minimo: 1,
        maximo: 500,
        requerido: true,
      }),
      archivo: validarArchivo(archivo, ARCHIVO.constancia, true),
    });

  const enviar = async (evento: FormEvent) => {
    evento.preventDefault();
    establecerError(null);

    const encontrados = validar();
    establecerErrores(encontrados);

    if (Object.keys(encontrados).length > 0) {
      enfocarPrimerError(encontrados);
      return;
    }

    // El archivo ya quedó comprobado arriba; la condición es para el tipado.
    if (!archivo) return;

    establecerEnviando(true);
    try {
      await evidencias.crear({
        nombreCurso: nombreCurso.trim(),
        institucion: institucion.trim(),
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

  const limpiar = (campo: string) =>
    establecerErrores((previos) => {
      if (!previos[campo]) return previos;
      const { [campo]: _, ...resto } = previos;
      return resto;
    });

  return (
    <Dialogo titulo="Cargar constancia" onCerrar={onCerrar}>
      <form onSubmit={(e) => void enviar(e)} className="space-y-4" noValidate>
        {error ? <Aviso>{error}</Aviso> : null}

        <Campo
          id="nombreCurso"
          etiqueta="Nombre del curso"
          ayuda="Tal como aparece en la constancia."
          maxLength={LIMITES.nombreCurso.maximo}
          value={nombreCurso}
          error={errores.nombreCurso}
          onChange={(e) => {
            establecerNombreCurso(e.target.value);
            limpiar('nombreCurso');
          }}
          requerido
        />

        <Campo
          id="institucion"
          etiqueta="Institución emisora"
          maxLength={LIMITES.institucion.maximo}
          value={institucion}
          error={errores.institucion}
          onChange={(e) => {
            establecerInstitucion(e.target.value);
            limpiar('institucion');
          }}
          requerido
        />

        <div className="grid gap-4 sm:grid-cols-2">
          <Campo
            id="fecha"
            etiqueta="Fecha de conclusión"
            type="date"
            max={new Date().toISOString().slice(0, 10)}
            value={fecha}
            error={errores.fecha}
            onChange={(e) => {
              establecerFecha(e.target.value);
              limpiar('fecha');
            }}
            requerido
          />
          <Campo
            id="horas"
            etiqueta="Horas acreditadas"
            type="number"
            inputMode="numeric"
            min={1}
            max={500}
            step={1}
            value={horas}
            error={errores.horas}
            onChange={(e) => {
              establecerHoras(e.target.value);
              limpiar('horas');
            }}
            requerido
          />
        </div>

        <CampoArchivo
          id="archivo"
          etiqueta="Archivo de la constancia"
          ayuda={`${ARCHIVO.constancia.descripcion}. Máximo 5 MB.`}
          accept={ARCHIVO.constancia.accept}
          archivo={archivo}
          error={errores.archivo}
          onArchivo={(elegido) => {
            establecerArchivo(elegido);
            limpiar('archivo');
          }}
          requerido
        />

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
