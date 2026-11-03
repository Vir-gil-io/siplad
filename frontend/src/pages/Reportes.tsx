import { useCallback, useState } from 'react';
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

import { reportes } from '../api/servicios';
import { mensajeDeError } from '../api/cliente';
import { useCargaRemota } from '../hooks/useCargaRemota';
import { Acta, Cifra, Renglon } from '../components/Acta';
import { Aviso } from '../components/Aviso';
import { Boton } from '../components/Controles';
import { Cargando } from '../components/Cargando';
import { Vacio } from '../components/Vacio';
import type {
  FilaReporteDocente,
  FilaReportePorParcial,
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

interface DatosReporte {
  indicadores: IndicadoresGlobales;
  porDocente: FilaReporteDocente[];
  porParcial: FilaReportePorParcial[];
}

export function Reportes() {
  const cargador = useCallback(async (): Promise<DatosReporte> => {
    const [indicadores, porDocente, porParcial] = await Promise.all([
      reportes.indicadores(),
      reportes.porDocente(),
      reportes.porParcial(),
    ]);
    return { indicadores, porDocente, porParcial };
  }, []);

  const { datos, cargando, error, establecerError } = useCargaRemota(
    cargador,
    'No se pudieron cargar los reportes.',
  );

  const [descargando, establecerDescargando] = useState<'excel' | 'pdf' | null>(null);

  const descargar = async (formato: 'excel' | 'pdf') => {
    establecerDescargando(formato);
    establecerError(null);
    try {
      await reportes.descargar(formato);
    } catch (fallo) {
      establecerError(mensajeDeError(fallo, 'No se pudo generar el archivo.'));
    } finally {
      establecerDescargando(null);
    }
  };

  if (cargando) return <Cargando mensaje="Calculando indicadores" />;
  if (!datos) return error ? <Aviso>{error}</Aviso> : null;

  const { indicadores, porDocente, porParcial } = datos;
  const sinDatos = indicadores.planeaciones.total === 0;

  return (
    <div className="space-y-4">
      {error ? <Aviso>{error}</Aviso> : null}

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
            titulo="Todavía no hay registros en el periodo"
            descripcion="Los indicadores se calculan sobre las planeaciones, los avances y las constancias del periodo activo. En cuanto el personal docente empiece a registrar, aparecerán aquí."
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
          <GraficaPorParcial filas={porParcial} />
          <GraficaPorDocente filas={porDocente} />
          <TablaPorDocente filas={porDocente} />
        </>
      ) : null}
    </div>
  );
}

/* --- Avances por parcial ---------------------------------------------------
   Pila por estado de cumplimiento. El hueco de 2 px entre segmentos se logra
   con un contorno del color de la superficie.
   ------------------------------------------------------------------------- */

interface DatoPila {
  parcial: string;
  Cumplido: number;
  Parcial: number;
  'No cumplido': number;
}

function GraficaPorParcial({ filas }: { filas: FilaReportePorParcial[] }) {
  const datos: DatoPila[] = filas.map((f) => ({
    parcial: `Parcial ${f.parcial}`,
    Cumplido: f.cumplidos,
    Parcial: f.parciales,
    'No cumplido': f.noCumplidos,
  }));

  const hayAvances = filas.some((f) => f.avancesRegistrados > 0);

  return (
    <Acta titulo="Cumplimiento de avances por parcial">
      {!hayAvances ? (
        <Vacio
          titulo="Sin avances registrados"
          descripcion="El personal docente aún no informa el avance logrado en ningún parcial."
        />
      ) : (
        <Renglon>
          <Leyenda
            series={[
              { nombre: 'Cumplido', color: SELLO },
              { nombre: 'Parcial', color: GRAFITO },
              { nombre: 'No cumplido', color: LAPIZ },
            ]}
          />

          <div className="mt-3 h-64 w-full">
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
                <Bar
                  dataKey="Cumplido"
                  stackId="estado"
                  fill={SELLO}
                  stroke={SUPERFICIE}
                  strokeWidth={2}
                  maxBarSize={72}
                >
                  <LabelList dataKey="Cumplido" content={<CifraEnSegmento />} />
                </Bar>
                <Bar
                  dataKey="Parcial"
                  stackId="estado"
                  fill={GRAFITO}
                  stroke={SUPERFICIE}
                  strokeWidth={2}
                  maxBarSize={72}
                >
                  <LabelList dataKey="Parcial" content={<CifraEnSegmento />} />
                </Bar>
                <Bar
                  dataKey="No cumplido"
                  stackId="estado"
                  fill={LAPIZ}
                  stroke={SUPERFICIE}
                  strokeWidth={2}
                  maxBarSize={72}
                  radius={[4, 4, 0, 0]}
                >
                  <LabelList dataKey="No cumplido" content={<CifraEnSegmento />} />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Renglon>
      )}
    </Acta>
  );
}

/* --- Cumplimiento por docente ----------------------------------------------
   Una sola serie, así que no lleva leyenda: el título la nombra. Barras
   horizontales porque los nombres son largos.
   ------------------------------------------------------------------------- */

function GraficaPorDocente({ filas }: { filas: FilaReporteDocente[] }) {
  const conRegistros = filas.filter((f) => f.planeacionesRegistradas > 0);

  const datos = conRegistros.map((f) => ({
    // Se abrevia para que el eje no se coma el ancho del gráfico.
    nombre: abreviarNombre(f.docente),
    completo: f.docente,
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
                >
                  {datos.map((dato) => (
                    <Cell key={dato.completo} fill={SELLO} />
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
