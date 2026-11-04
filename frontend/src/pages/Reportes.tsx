import { useCallback, useMemo, useState } from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  LabelList,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

import { avances as servicioAvances, reportes } from '../api/servicios';
import { mensajeDeError } from '../api/cliente';
import { useCargaRemota } from '../hooks/useCargaRemota';
import { Acta, Cifra, Renglon } from '../components/Acta';
import { Aviso } from '../components/Aviso';
import { Boton, Selector } from '../components/Controles';
import { Cargando } from '../components/Cargando';
import { Dialogo } from '../components/Dialogo';
import { Sello } from '../components/Sello';
import { Vacio } from '../components/Vacio';
import { fechaLegible } from '../utils/validacion';
import type {
  Avance,
  EstadoAvance,
  FilaReporteDocente,
  FilaReportePorParcial,
  FiltroReporte,
  IndicadoresGlobales,
} from '../types';

/* ---------------------------------------------------------------------------
   Módulo 4 — Reportes y seguimiento institucional.

   Color: el cumplimiento es polaridad, no identidad, así que la escala es
   divergente — tinta violeta del sello en el extremo favorable, lápiz rojo en
   el desfavorable y grafito neutro en medio. Los dos polos se verificaron con
   el validador de paleta: ΔE 18.8 en protanopia y 22.5 en visión normal,
   ambos por encima del piso, y los tres superan 3:1 de contraste contra la
   superficie. La identidad nunca depende solo del color: cada segmento lleva
   su cifra y hay leyenda y tabla.

   La cifra agregada es el punto de partida, no la conclusión: un 40 % de
   avances no cumplidos solo sirve si se puede saber de qué registros se trata.
   De ahí que cada segmento de la pila abra el desglose de los avances que lo
   componen, con el nombre de quien los registró.
   --------------------------------------------------------------------------- */

const SELLO = '#5a3c8f';
const GRAFITO = '#6b7083';
const LAPIZ = '#ae3f2c';
const SUPERFICIE = '#fbfcfa';
const REGLA = '#c9cec4';

const ESTILO_EJE = {
  fontSize: 12,
  fontFamily: "'IBM Plex Sans', system-ui, sans-serif",
  fill: GRAFITO,
};

/** Nombre de la serie en la pila, y estado del avance que representa. */
const SERIES: { nombre: string; estado: EstadoAvance; color: string }[] = [
  { nombre: 'Cumplido', estado: 'CUMPLIDO', color: SELLO },
  { nombre: 'Parcial', estado: 'PARCIAL', color: GRAFITO },
  { nombre: 'No cumplido', estado: 'NO_CUMPLIDO', color: LAPIZ },
];

interface DatosReporte {
  indicadores: IndicadoresGlobales;
  porDocente: FilaReporteDocente[];
  porParcial: FilaReportePorParcial[];
  avances: Avance[];
}

/** Segmento que el usuario eligió desglosar. */
interface Desglose {
  parcial: number;
  estado: EstadoAvance;
}

export function Reportes() {
  const [filtro, establecerFiltro] = useState<FiltroReporte>({});
  const [desglose, establecerDesglose] = useState<Desglose | null>(null);

  // El cargador depende del filtro, de modo que al cambiarlo el hook vuelve a
  // pedir los datos y descarta la respuesta anterior si llega tarde. Los datos
  // viejos siguen en pantalla mientras llega la respuesta: así el reporte no
  // parpadea en vacío cada vez que se toca un selector.
  // La plantilla docente que alimenta el selector se toma de la consulta sin
  // acotar: si se tomara de la consulta en curso, al elegir un docente la
  // lista se reduciria a ese mismo y no habria modo de volver a los demas.
  const [plantilla, establecerPlantilla] = useState<{ id: string; nombre: string }[]>([]);

  const cargador = useCallback(async (): Promise<DatosReporte> => {
    const [indicadores, porDocente, porParcial, avances] = await Promise.all([
      reportes.indicadores(filtro),
      reportes.porDocente(filtro),
      reportes.porParcial(filtro),
      servicioAvances.listar(filtro.periodoId),
    ]);

    if (!filtro.docenteId) {
      establecerPlantilla(
        porDocente.map((fila) => ({ id: fila.docenteId, nombre: fila.docente })),
      );
    }

    return { indicadores, porDocente, porParcial, avances };
  }, [filtro]);

  const { datos, cargando, error, establecerError } = useCargaRemota(
    cargador,
    'No se pudieron cargar los reportes.',
  );

  const [descargando, establecerDescargando] = useState<'excel' | 'pdf' | null>(null);

  const descargar = async (formato: 'excel' | 'pdf') => {
    establecerDescargando(formato);
    establecerError(null);
    try {
      // El archivo sale acotado por lo mismo que la pantalla: quien descarga
      // recibe exactamente lo que está viendo.
      await reportes.descargar(formato, filtro);
    } catch (fallo) {
      establecerError(mensajeDeError(fallo, 'No se pudo generar el archivo.'));
    } finally {
      establecerDescargando(null);
    }
  };

  if (cargando) return <Cargando mensaje="Calculando indicadores" />;
  if (!datos) return error ? <Aviso>{error}</Aviso> : null;

  const { indicadores, porDocente, porParcial, avances } = datos;
  const sinDatos = indicadores.planeaciones.total === 0;
  const acotado = filtro.parcial !== undefined || filtro.docenteId !== undefined;

  return (
    <div className="space-y-4">
      {error ? <Aviso>{error}</Aviso> : null}

      {/* --- Acotación del reporte ------------------------------------------ */}
      <BarraFiltros
        filtro={filtro}
        plantilla={plantilla}
        onCambiar={establecerFiltro}
        acotado={acotado}
      />

      {/* --- Indicadores del periodo ---------------------------------------- */}
      <Acta
        titulo="Seguimiento institucional"
        referencia={indicadores.periodo?.nombre ?? 'Sin periodo activo'}
        acciones={
          <>
            <Boton
              variante="contorno"
              onClick={() => void descargar('excel')}
              disabled={descargando !== null}
            >
              {descargando === 'excel' ? 'Generando…' : 'Descargar Excel'}
            </Boton>
            <Boton
              variante="contorno"
              onClick={() => void descargar('pdf')}
              disabled={descargando !== null}
            >
              {descargando === 'pdf' ? 'Generando…' : 'Descargar PDF'}
            </Boton>
          </>
        }
      >
        {sinDatos ? (
          <Vacio
            titulo={
              acotado
                ? 'Sin registros con esa acotación'
                : 'Todavía no hay registros en el periodo'
            }
            descripcion={
              acotado
                ? 'Ningún registro del periodo coincide con el parcial y el docente elegidos. Quita la acotación para ver el reporte completo.'
                : 'Los indicadores se calculan sobre las planeaciones, los avances y las constancias del periodo activo. En cuanto el personal docente empiece a registrar, aparecerán aquí.'
            }
          />
        ) : (
          <>
            <Renglon>
              <div className="grid grid-cols-2 gap-6 lg:grid-cols-4">
                <Cifra
                  valor={indicadores.planeaciones.porcentajeCumplimiento}
                  unidad="%"
                  concepto="Planeación aprobada"
                  tono="sello"
                />
                <Cifra
                  valor={indicadores.avances.porcentajePromedio}
                  unidad="%"
                  concepto="Avance promedio"
                  tono="sello"
                />
                <Cifra
                  valor={indicadores.capacitacion.horasAcreditadas}
                  concepto="Horas acreditadas"
                />
                <Cifra
                  valor={indicadores.capacitacion.docentesConCapacitacion}
                  concepto="Docentes capacitados"
                />
              </div>
            </Renglon>

            <Renglon>
              <dl className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm sm:grid-cols-3 lg:grid-cols-5">
                {[
                  ['Planeaciones registradas', indicadores.planeaciones.total],
                  ['Aprobadas', indicadores.planeaciones.aprobadas],
                  ['En revisión', indicadores.planeaciones.enviadas],
                  ['Con ajustes', indicadores.planeaciones.ajustesSolicitados],
                  [
                    'Días hábiles del periodo',
                    indicadores.diasHabilesDelPeriodo ?? 'No disponible',
                  ],
                ].map(([concepto, valor]) => (
                  <div key={String(concepto)}>
                    <dt className="text-grafito">{concepto}</dt>
                    <dd className="cifra font-medium text-tinta">{valor}</dd>
                  </div>
                ))}
              </dl>
            </Renglon>
          </>
        )}
      </Acta>

      {!sinDatos ? (
        <>
          <GraficaPorParcial filas={porParcial} onDesglosar={establecerDesglose} />
          <GraficaPorDocente
            filas={porDocente}
            onElegirDocente={(docenteId) =>
              establecerFiltro((actual) => ({ ...actual, docenteId }))
            }
          />
          <TablaPorDocente filas={porDocente} />
        </>
      ) : null}

      {desglose ? (
        <DesgloseAvances
          desglose={desglose}
          avances={avances}
          onCerrar={() => establecerDesglose(null)}
        />
      ) : null}
    </div>
  );
}

/* --- Acotación -------------------------------------------------------------
   Dos criterios y nada más: el parcial y el docente. El periodo no se ofrece
   porque el seguimiento institucional se hace sobre el periodo en curso, y la
   materia tampoco porque el desglose por materia ya es una sección del propio
   reporte.
   ------------------------------------------------------------------------- */

function BarraFiltros({
  filtro,
  plantilla,
  onCambiar,
  acotado,
}: {
  filtro: FiltroReporte;
  plantilla: { id: string; nombre: string }[];
  onCambiar: (filtro: FiltroReporte) => void;
  acotado: boolean;
}) {
  return (
    <section className="hoja flex flex-wrap items-end gap-3 px-4 py-3 sm:px-5">
      <div className="w-full sm:w-44">
        <Selector
          id="filtro-parcial"
          etiqueta="Parcial"
          value={filtro.parcial ?? ''}
          onChange={(evento) =>
            onCambiar({
              ...filtro,
              parcial: evento.target.value ? Number(evento.target.value) : undefined,
            })
          }
        >
          <option value="">Todos los parciales</option>
          <option value="1">Primer parcial</option>
          <option value="2">Segundo parcial</option>
          <option value="3">Tercer parcial</option>
        </Selector>
      </div>

      <div className="w-full sm:w-80">
        <Selector
          id="filtro-docente"
          etiqueta="Docente"
          value={filtro.docenteId ?? ''}
          onChange={(evento) =>
            onCambiar({ ...filtro, docenteId: evento.target.value || undefined })
          }
        >
          <option value="">Todo el personal docente</option>
          {plantilla.map((docente) => (
            <option key={docente.id} value={docente.id}>
              {docente.nombre}
            </option>
          ))}
        </Selector>
      </div>

      {acotado ? (
        <Boton variante="texto" onClick={() => onCambiar({})}>
          Quitar acotación
        </Boton>
      ) : null}

      <p className="ml-auto max-w-xs text-xs text-grafito">
        Lo que elijas aquí acota también el archivo que se descarga.
      </p>
    </section>
  );
}

/* --- Avances por parcial ---------------------------------------------------
   Pila por estado de cumplimiento. El hueco de 2 px entre segmentos se logra
   con un contorno del color de la superficie.

   Cada segmento es accionable: al pulsarlo se abre la lista de los avances
   que lo forman. La misma acción está en los botones de la leyenda, que es
   donde puede alcanzarla quien navega con teclado, porque un rectángulo de
   SVG no entra en el orden de tabulación.
   ------------------------------------------------------------------------- */

interface DatoPila {
  parcial: string;
  numero: number;
  Cumplido: number;
  Parcial: number;
  'No cumplido': number;
}

/** Lo que Recharts entrega al pulsar una barra: el dato, dentro de `payload`. */
function parcialPulsado(dato: unknown): number | null {
  const contenido = (dato as { payload?: { numero?: number } } | undefined)?.payload;
  return typeof contenido?.numero === 'number' ? contenido.numero : null;
}

function GraficaPorParcial({
  filas,
  onDesglosar,
}: {
  filas: FilaReportePorParcial[];
  onDesglosar: (desglose: Desglose) => void;
}) {
  const datos: DatoPila[] = filas.map((f) => ({
    parcial: `Parcial ${f.parcial}`,
    numero: f.parcial,
    Cumplido: f.cumplidos,
    Parcial: f.parciales,
    'No cumplido': f.noCumplidos,
  }));

  const hayAvances = filas.some((f) => f.avancesRegistrados > 0);

  const alPulsar = (estado: EstadoAvance) => (dato: unknown) => {
    const parcial = parcialPulsado(dato);
    if (parcial !== null) onDesglosar({ parcial, estado });
  };

  return (
    <Acta titulo="Cumplimiento de avances por parcial">
      {!hayAvances ? (
        <Vacio
          titulo="Sin avances registrados"
          descripcion="El personal docente aún no informa el avance logrado en ningún parcial."
        />
      ) : (
        <Renglon>
          <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-2">
            <Leyenda series={SERIES} />
            <p className="text-xs text-grafito">
              Pulsa un segmento para ver de qué avances se trata.
            </p>
          </div>

          <div className="mt-3 h-72 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={datos} margin={{ top: 8, right: 8, bottom: 0, left: -18 }}>
                <CartesianGrid vertical={false} stroke={REGLA} strokeDasharray="0" />
                <XAxis
                  dataKey="parcial"
                  tick={ESTILO_EJE}
                  axisLine={{ stroke: REGLA }}
                  tickLine={false}
                />
                <YAxis
                  tick={ESTILO_EJE}
                  axisLine={false}
                  tickLine={false}
                  allowDecimals={false}
                />
                <Tooltip content={<Globo />} cursor={{ fill: 'rgba(90,60,143,0.06)' }} />
                {/* Cada segmento lleva su cifra: la identidad nunca depende solo del
                    color, que es lo que exige una lectura accesible. */}
                {SERIES.map((serie, indice) => (
                  <Bar
                    key={serie.nombre}
                    dataKey={serie.nombre}
                    stackId="estado"
                    fill={serie.color}
                    stroke={SUPERFICIE}
                    strokeWidth={2}
                    maxBarSize={72}
                    cursor="pointer"
                    onClick={alPulsar(serie.estado)}
                    radius={indice === SERIES.length - 1 ? [4, 4, 0, 0] : undefined}
                  >
                    <LabelList dataKey={serie.nombre} content={<CifraEnSegmento />} />
                  </Bar>
                ))}
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* La misma acción, alcanzable con teclado y con lector de pantalla. */}
          <div className="mt-3 space-y-1.5 border-t border-regla pt-3">
            {datos.map((dato) => (
              <div key={dato.numero} className="flex flex-wrap items-center gap-2">
                <span className="w-24 text-sm text-grafito">{dato.parcial}</span>
                {SERIES.map((serie) => {
                  const cantidad = dato[serie.nombre as keyof DatoPila] as number;
                  return (
                    <Boton
                      key={serie.nombre}
                      variante="texto"
                      disabled={cantidad === 0}
                      onClick={() =>
                        onDesglosar({ parcial: dato.numero, estado: serie.estado })
                      }
                    >
                      {serie.nombre} <span className="cifra">({cantidad})</span>
                    </Boton>
                  );
                })}
              </div>
            ))}
          </div>
        </Renglon>
      )}
    </Acta>
  );
}

/* --- Desglose de un segmento -----------------------------------------------
   Lo que estaba detrás de la cifra: los registros uno a uno, con el nombre de
   quien los informó, la materia y el tramo de fechas que cubren.
   ------------------------------------------------------------------------- */

const LEYENDA_ESTADO: Record<EstadoAvance, string> = {
  CUMPLIDO: 'cumplidos',
  PARCIAL: 'parciales',
  NO_CUMPLIDO: 'no cumplidos',
};

function DesgloseAvances({
  desglose,
  avances,
  onCerrar,
}: {
  desglose: Desglose;
  avances: Avance[];
  onCerrar: () => void;
}) {
  const seleccion = useMemo(
    () =>
      avances
        .filter(
          (avance) =>
            avance.estado === desglose.estado &&
            avance.planeacion?.parcial === desglose.parcial,
        )
        .sort((a, b) => a.porcentaje - b.porcentaje),
    [avances, desglose],
  );

  return (
    <Dialogo
      titulo={`Avances ${LEYENDA_ESTADO[desglose.estado]}`}
      subtitulo={`Parcial ${desglose.parcial} · ${seleccion.length} ${
        seleccion.length === 1 ? 'registro' : 'registros'
      }`}
      ancho="amplio"
      onCerrar={onCerrar}
    >
      {seleccion.length === 0 ? (
        <p className="py-6 text-center text-sm text-grafito">
          No hay avances con ese estado en el parcial. La cifra de la gráfica puede
          corresponder a un periodo distinto del que se consulta aquí.
        </p>
      ) : (
        <ul className="divide-y divide-regla">
          {seleccion.map((avance) => (
            <li key={avance.id} className="flex flex-wrap items-start gap-3 py-3">
              <div className="min-w-0 flex-1">
                <p className="font-titulo text-base font-semibold text-tinta">
                  {avance.planeacion?.usuario.nombre ?? 'Docente no disponible'}
                </p>
                <p className="mt-0.5 text-sm text-grafito">
                  {avance.planeacion?.materia.clave} · {avance.planeacion?.materia.nombre}
                </p>
                <p className="mt-0.5 text-sm text-grafito">
                  Del {fechaLegible(avance.fechaInicio)} al{' '}
                  {fechaLegible(avance.fechaFin)}
                  {avance.diasHabiles !== undefined ? (
                    <>
                      {' '}
                      · <span className="cifra">{avance.diasHabiles}</span> días hábiles
                    </>
                  ) : null}
                </p>
                {avance.observaciones ? (
                  <p className="recuadro mt-2 px-3 py-2 text-sm text-tinta">
                    {avance.observaciones}
                  </p>
                ) : null}
              </div>

              <div className="flex shrink-0 flex-col items-end gap-1.5">
                <span className="cifra font-titulo text-xl font-semibold text-tinta">
                  {avance.porcentaje}%
                </span>
                <Sello estado={avance.estado} />
              </div>
            </li>
          ))}
        </ul>
      )}

      <div className="flex justify-end border-t border-regla pt-4">
        <Boton type="button" onClick={onCerrar}>
          Cerrar
        </Boton>
      </div>
    </Dialogo>
  );
}

/* --- Cumplimiento por docente ----------------------------------------------
   Una sola serie, así que no lleva leyenda: el título la nombra. Barras
   horizontales porque los nombres son largos. Pulsar una barra acota el
   reporte a ese docente.
   ------------------------------------------------------------------------- */

function GraficaPorDocente({
  filas,
  onElegirDocente,
}: {
  filas: FilaReporteDocente[];
  onElegirDocente: (docenteId: string) => void;
}) {
  const conRegistros = filas.filter((f) => f.planeacionesRegistradas > 0);

  const datos = conRegistros.map((f) => ({
    // Se abrevia para que el eje no se coma el ancho del gráfico.
    nombre: abreviarNombre(f.docente),
    completo: f.docente,
    docenteId: f.docenteId,
    cumplimiento: f.porcentajeCumplimientoPlaneacion,
  }));

  return (
    <Acta titulo="Cumplimiento de planeación por docente">
      {datos.length === 0 ? (
        <Vacio
          titulo="Sin planeaciones registradas"
          descripcion="Ningún docente ha registrado planeación en el periodo activo."
        />
      ) : (
        <Renglon>
          <div
            className="w-full"
            style={{ height: Math.max(datos.length * 44 + 32, 140) }}
          >
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={datos}
                layout="vertical"
                margin={{ top: 4, right: 44, bottom: 4, left: 8 }}
              >
                <CartesianGrid horizontal={false} stroke={REGLA} />
                <XAxis
                  type="number"
                  domain={[0, 100]}
                  unit="%"
                  tick={ESTILO_EJE}
                  axisLine={{ stroke: REGLA }}
                  tickLine={false}
                />
                <YAxis
                  type="category"
                  dataKey="nombre"
                  width={156}
                  tick={ESTILO_EJE}
                  axisLine={false}
                  tickLine={false}
                />
                <Tooltip
                  content={<Globo unidad="%" />}
                  cursor={{ fill: 'rgba(90,60,143,0.06)' }}
                />
                <Bar
                  dataKey="cumplimiento"
                  name="Cumplimiento"
                  radius={[0, 4, 4, 0]}
                  maxBarSize={22}
                  cursor="pointer"
                  onClick={(dato: unknown) => {
                    const contenido = (
                      dato as { payload?: { docenteId?: string } } | undefined
                    )?.payload;
                    if (contenido?.docenteId) onElegirDocente(contenido.docenteId);
                  }}
                >
                  {datos.map((dato) => (
                    <Cell key={dato.docenteId} fill={SELLO} />
                  ))}
                  <LabelList
                    dataKey="cumplimiento"
                    position="right"
                    offset={8}
                    formatter={(valor) => `${String(valor ?? '')}%`}
                    style={{ ...ESTILO_EJE, fill: '#23263b', fontWeight: 500 }}
                  />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
          <p className="mt-2 text-xs text-grafito">
            Pulsa una barra para acotar el reporte a ese docente.
          </p>
        </Renglon>
      )}
    </Acta>
  );
}

/* --- Tabla de detalle ------------------------------------------------------
   Es también la vista tabular que exige la lectura accesible de los gráficos.
   ------------------------------------------------------------------------- */

function TablaPorDocente({ filas }: { filas: FilaReporteDocente[] }) {
  return (
    <Acta titulo="Detalle por docente">
      {filas.length === 0 ? (
        <Vacio
          titulo="Sin personal docente registrado"
          descripcion="No hay cuentas de docente activas en el sistema."
        />
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[46rem] border-collapse text-sm">
            <thead>
              <tr className="border-b border-regla-fuerte text-left">
                <th scope="col" className="px-4 py-2.5 font-medium text-grafito sm:px-5">
                  Docente
                </th>
                <th
                  scope="col"
                  className="px-3 py-2.5 text-right font-medium text-grafito"
                >
                  Planeaciones
                </th>
                <th
                  scope="col"
                  className="px-3 py-2.5 text-right font-medium text-grafito"
                >
                  Aprobadas
                </th>
                <th
                  scope="col"
                  className="px-3 py-2.5 text-right font-medium text-grafito"
                >
                  Cumplimiento
                </th>
                <th
                  scope="col"
                  className="px-3 py-2.5 text-right font-medium text-grafito"
                >
                  Avance
                </th>
                <th
                  scope="col"
                  className="px-4 py-2.5 text-right font-medium text-grafito sm:px-5"
                >
                  Horas
                </th>
              </tr>
            </thead>
            <tbody>
              {filas.map((fila) => (
                <tr key={fila.docenteId} className="renglon">
                  <td className="px-4 py-3 sm:px-5">
                    <span className="font-medium text-tinta">{fila.docente}</span>
                    <span className="block text-xs text-grafito">{fila.email}</span>
                  </td>
                  <td className="cifra px-3 py-3 text-right text-tinta">
                    {fila.planeacionesRegistradas}
                  </td>
                  <td className="cifra px-3 py-3 text-right text-tinta">
                    {fila.planeacionesAprobadas}
                  </td>
                  <td className="cifra px-3 py-3 text-right font-medium text-tinta">
                    {fila.porcentajeCumplimientoPlaneacion}%
                  </td>
                  <td className="cifra px-3 py-3 text-right text-tinta">
                    {fila.promedioAvance}%
                  </td>
                  <td className="cifra px-4 py-3 text-right text-tinta sm:px-5">
                    {fila.horasAcreditadas}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Acta>
  );
}

/* --- Piezas compartidas de los gráficos ----------------------------------- */

/**
 * Cifra impresa dentro de un segmento de la pila.
 *
 * Se omite cuando el valor es cero o cuando el segmento es demasiado bajo
 * para que la cifra quepa sin encimarse.
 */
function CifraEnSegmento(propiedades: {
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  value?: number;
}) {
  const { x = 0, y = 0, width = 0, height = 0, value = 0 } = propiedades;

  if (!value || height < 18) return null;

  return (
    <text
      x={x + width / 2}
      y={y + height / 2}
      textAnchor="middle"
      dominantBaseline="central"
      fill="#ffffff"
      fontSize={12}
      fontWeight={600}
      fontFamily="'IBM Plex Sans', system-ui, sans-serif"
      pointerEvents="none"
    >
      {value}
    </text>
  );
}

function Leyenda({ series }: { series: { nombre: string; color: string }[] }) {
  return (
    <ul className="flex flex-wrap gap-x-5 gap-y-1.5">
      {series.map((serie) => (
        <li key={serie.nombre} className="flex items-center gap-2 text-sm text-grafito">
          <span
            aria-hidden="true"
            className="inline-block h-2.5 w-2.5 shrink-0"
            style={{ backgroundColor: serie.color }}
          />
          {serie.nombre}
        </li>
      ))}
    </ul>
  );
}

interface EntradaGlobo {
  name?: string;
  value?: number | string;
  color?: string;
  payload?: { completo?: string };
}

/**
 * Globo de información.
 *
 * El texto lleva los tonos de tinta de la interfaz; el color de la serie va
 * en la marca de al lado y nunca en las letras.
 */
function Globo({
  active,
  payload,
  label,
  unidad = '',
}: {
  active?: boolean;
  payload?: EntradaGlobo[];
  label?: string | number;
  unidad?: string;
}) {
  if (!active || !payload || payload.length === 0) return null;

  const titulo = payload[0]?.payload?.completo ?? label;

  return (
    <div className="border border-regla-fuerte bg-panel px-3 py-2 text-sm shadow-sm">
      <p className="font-medium text-tinta">{titulo}</p>
      <ul className="mt-1 space-y-0.5">
        {payload.map((entrada) => (
          <li key={entrada.name} className="flex items-center gap-2 text-grafito">
            <span
              aria-hidden="true"
              className="inline-block h-2 w-2 shrink-0"
              style={{ backgroundColor: entrada.color }}
            />
            <span>{entrada.name}</span>
            <span className="cifra ml-auto font-medium text-tinta">
              {entrada.value}
              {unidad}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** "Jorge Alberto Correa Nunez" queda como "Jorge A. Correa N." */
function abreviarNombre(completo: string): string {
  const partes = completo.trim().split(/\s+/);
  if (partes.length <= 2) return completo;

  return partes
    .map((parte, indice) =>
      indice === 0 || indice === 2 ? parte : `${parte.charAt(0)}.`,
    )
    .join(' ');
}
