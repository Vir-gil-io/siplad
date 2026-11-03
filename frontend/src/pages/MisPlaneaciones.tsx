import { useCallback, useState, type FormEvent } from 'react';

import { catalogos, planeaciones } from '../api/servicios';
import { mensajeDeError } from '../api/cliente';
import { useCargaRemota } from '../hooks/useCargaRemota';
import { Acta, Renglon } from '../components/Acta';
import { Aviso } from '../components/Aviso';
import { Boton, AreaTexto, Selector } from '../components/Controles';
import { Cargando } from '../components/Cargando';
import { Dialogo } from '../components/Dialogo';
import { Sello } from '../components/Sello';
import { Vacio } from '../components/Vacio';
import type { Materia, PeriodoAcademico, Planeacion } from '../types';

interface DatosPantalla {
  lista: Planeacion[];
  materias: Materia[];
  periodo: PeriodoAcademico | null;
}

/** Módulo 1 — Gestión de planeación didáctica, vista del docente. */
export function MisPlaneaciones() {
  const cargador = useCallback(async (): Promise<DatosPantalla> => {
    const [lista, materias, periodo] = await Promise.all([
      planeaciones.listar(),
      catalogos.materias(),
      catalogos.periodoActivo(),
    ]);
    return { lista, materias, periodo };
  }, []);

  const { datos, cargando, error, recargar } = useCargaRemota(
    cargador,
    'No se pudieron cargar tus planeaciones.',
  );

  // `undefined` es diálogo cerrado; `null` es alta; un registro es corrección.
  const [enFormulario, establecerEnFormulario] = useState<Planeacion | null | undefined>(
    undefined,
  );

  if (cargando) return <Cargando mensaje="Cargando tus planeaciones" />;
  if (error && !datos) return <Aviso>{error}</Aviso>;
  if (!datos) return null;

  const { lista, materias, periodo } = datos;
  const puedeRegistrar = periodo !== null && materias.length > 0;

  return (
    <div className="space-y-4">
      {error ? <Aviso>{error}</Aviso> : null}

      <Acta
        titulo="Mis planeaciones"
        referencia={periodo ? periodo.nombre : 'Sin periodo activo'}
        acciones={
          <Boton onClick={() => establecerEnFormulario(null)} disabled={!puedeRegistrar}>
            Registrar planeación
          </Boton>
        }
      >
        {lista.length === 0 ? (
          <Vacio
            titulo="Aún no registras ninguna planeación"
            descripcion="Registra la planeación de cada materia y parcial del periodo. Coordinación la revisa y te avisa si requiere ajustes."
            accion={
              <Boton
                onClick={() => establecerEnFormulario(null)}
                disabled={!puedeRegistrar}
              >
                Registrar la primera
              </Boton>
            }
          />
        ) : (
          lista.map((registro) => (
            <Renglon key={registro.id}>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <p className="font-titulo text-base font-semibold text-tinta">
                    {registro.materia.nombre}
                  </p>
                  <p className="mt-0.5 text-sm text-grafito">
                    {registro.materia.clave} · Parcial{' '}
                    <span className="cifra">{registro.parcial}</span> ·{' '}
                    {registro.periodo.nombre}
                  </p>

                  {registro.comentarioRevision ? (
                    <p className="mt-2 border-l-[3px] border-lapiz bg-lapiz-claro px-3 py-2 text-sm text-lapiz">
                      {registro.comentarioRevision}
                    </p>
                  ) : null}
                </div>

                <div className="flex flex-col items-end gap-2">
                  <Sello estado={registro.estado} />
                  {registro.estado !== 'APROBADA' ? (
                    <Boton
                      variante="texto"
                      onClick={() => establecerEnFormulario(registro)}
                    >
                      Corregir
                    </Boton>
                  ) : null}
                </div>
              </div>
            </Renglon>
          ))
        )}
      </Acta>

      {enFormulario !== undefined ? (
        <FormularioPlaneacion
          planeacion={enFormulario}
          materias={materias}
          periodo={periodo}
          onCerrar={() => establecerEnFormulario(undefined)}
          onGuardado={() => {
            establecerEnFormulario(undefined);
            recargar();
          }}
        />
      ) : null}
    </div>
  );
}

function FormularioPlaneacion({
  planeacion,
  materias,
  periodo,
  onCerrar,
  onGuardado,
}: {
  planeacion: Planeacion | null;
  materias: Materia[];
  periodo: PeriodoAcademico | null;
  onCerrar: () => void;
  onGuardado: () => void;
}) {
  const esEdicion = planeacion !== null;

  // El estado inicial se deriva de las props una sola vez, al montar. Como el
  // diálogo se monta en cada apertura, no hace falta sincronizarlo después.
  const [materiaId, establecerMateriaId] = useState(
    planeacion?.materiaId ?? materias[0]?.id ?? '',
  );
  const [parcial, establecerParcial] = useState(String(planeacion?.parcial ?? 1));
  const [contenido, establecerContenido] = useState(planeacion?.contenido ?? '');
  const [error, establecerError] = useState<string | null>(null);
  const [enviando, establecerEnviando] = useState(false);

  const enviar = async (evento: FormEvent) => {
    evento.preventDefault();
    establecerError(null);
    establecerEnviando(true);

    try {
      if (planeacion) {
        await planeaciones.actualizar(planeacion.id, { contenido });
      } else {
        if (!periodo) throw new Error('No hay un periodo académico activo.');
        await planeaciones.crear({
          materiaId,
          parcial: Number(parcial),
          contenido,
          periodoId: periodo.id,
        });
      }
      onGuardado();
    } catch (fallo) {
      establecerError(
        mensajeDeError(fallo, 'No se pudo guardar la planeación. Revisa los datos.'),
      );
      establecerEnviando(false);
    }
  };

  return (
    <Dialogo
      titulo={esEdicion ? 'Corregir planeación' : 'Registrar planeación'}
      onCerrar={onCerrar}
    >
      <form onSubmit={(e) => void enviar(e)} className="space-y-4" noValidate>
        {error ? <Aviso>{error}</Aviso> : null}

        {planeacion ? (
          <p className="text-sm text-grafito">
            {planeacion.materia.nombre} · Parcial{' '}
            <span className="cifra">{planeacion.parcial}</span>. Al guardar, la planeación
            vuelve a revisión.
          </p>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2">
            <Selector
              id="materia"
              etiqueta="Materia"
              value={materiaId}
              onChange={(e) => establecerMateriaId(e.target.value)}
              required
              requerido
            >
              {materias.map((materia) => (
                <option key={materia.id} value={materia.id}>
                  {materia.clave} — {materia.nombre}
                </option>
              ))}
            </Selector>

            <Selector
              id="parcial"
              etiqueta="Parcial"
              value={parcial}
              onChange={(e) => establecerParcial(e.target.value)}
              required
              requerido
            >
              <option value="1">Primer parcial</option>
              <option value="2">Segundo parcial</option>
              <option value="3">Tercer parcial</option>
            </Selector>
          </div>
        )}

        <AreaTexto
          id="contenido"
          etiqueta="Planeación"
          ayuda="Objetivos de aprendizaje, secuencia didáctica, recursos e instrumentos de evaluación. Mínimo 20 caracteres."
          value={contenido}
          onChange={(e) => establecerContenido(e.target.value)}
          required
          requerido
        />

        <div className="flex justify-end gap-2 border-t border-regla pt-4">
          <Boton type="button" variante="contorno" onClick={onCerrar}>
            Cancelar
          </Boton>
          <Boton type="submit" disabled={enviando}>
            {enviando ? 'Guardando…' : esEdicion ? 'Guardar y enviar' : 'Registrar'}
          </Boton>
        </div>
      </form>
    </Dialogo>
  );
}
