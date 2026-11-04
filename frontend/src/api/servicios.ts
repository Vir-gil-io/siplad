import { cliente } from './cliente';
import type {
  Avance,
  Evidencia,
  EstadoEvidencia,
  EstadoPlaneacion,
  FilaReporteDocente,
  FilaReportePorMateria,
  FilaReportePorParcial,
  IndicadoresGlobales,
  Materia,
  Perfil,
  PeriodoAcademico,
  Planeacion,
  RespuestaAutenticacion,
  FiltroReporte,
} from '../types';

/**
 * Servicios de la API, uno por cada Web Service del backend.
 *
 * Las vistas invocan estas funciones y nunca a axios directamente, de modo
 * que el contrato con la API queda en un solo lugar.
 */

// --- Web Service 1: Autenticación ------------------------------------------

export const autenticacion = {
  iniciarSesion: (email: string, password: string) =>
    cliente
      .post<RespuestaAutenticacion>('/auth/login', { email, password })
      .then((r) => r.data),

  perfil: () => cliente.get<Perfil>('/auth/perfil').then((r) => r.data),

  /** Dirección a la que se envía al navegador para el acceso federado. */
  urlGoogle: () => `${import.meta.env.VITE_API_URL ?? '/api'}/auth/google`,
};

// --- Web Service 2: Planeación didáctica -----------------------------------

export interface FiltrosPlaneacion {
  periodoId?: string;
  materiaId?: string;
  usuarioId?: string;
  estado?: EstadoPlaneacion;
  parcial?: number;
}

export const planeaciones = {
  listar: (filtros: FiltrosPlaneacion = {}) =>
    cliente.get<Planeacion[]>('/planeaciones', { params: filtros }).then((r) => r.data),

  obtener: (id: string) =>
    cliente.get<Planeacion>(`/planeaciones/${id}`).then((r) => r.data),

  /**
   * El documento de la planeacion es opcional.
   *
   * Sin archivo se envia JSON, que es mas ligero y legible en las bitacoras;
   * con archivo se envia multipart. El backend admite ambas formas, de modo
   * que el contrato anterior sigue siendo valido.
   */
  crear: (datos: {
    parcial: number;
    contenido: string;
    materiaId: string;
    periodoId: string;
    archivo?: File | null;
  }) => {
    const { archivo, ...campos } = datos;

    if (!archivo) {
      return cliente.post<Planeacion>('/planeaciones', campos).then((r) => r.data);
    }

    const formulario = new FormData();
    formulario.append('parcial', String(campos.parcial));
    formulario.append('contenido', campos.contenido);
    formulario.append('materiaId', campos.materiaId);
    formulario.append('periodoId', campos.periodoId);
    formulario.append('archivo', archivo);

    return cliente.post<Planeacion>('/planeaciones', formulario).then((r) => r.data);
  },

  actualizar: (id: string, datos: { contenido?: string; archivo?: File | null }) => {
    const { archivo, ...campos } = datos;

    if (!archivo) {
      return cliente.patch<Planeacion>(`/planeaciones/${id}`, campos).then((r) => r.data);
    }

    const formulario = new FormData();
    if (campos.contenido !== undefined) {
      formulario.append('contenido', campos.contenido);
    }
    formulario.append('archivo', archivo);

    return cliente
      .patch<Planeacion>(`/planeaciones/${id}`, formulario)
      .then((r) => r.data);
  },

  revisar: (
    id: string,
    datos: { estado: EstadoPlaneacion; comentarioRevision?: string },
  ) =>
    cliente.patch<Planeacion>(`/planeaciones/${id}/revision`, datos).then((r) => r.data),

  eliminar: (id: string) =>
    cliente.delete<{ mensaje: string }>(`/planeaciones/${id}`).then((r) => r.data),
};

// --- Web Service 3: Avances por parcial ------------------------------------

export const avances = {
  listar: (periodoId?: string) =>
    cliente.get<Avance[]>('/avances', { params: { periodoId } }).then((r) => r.data),

  crear: (datos: {
    planeacionId: string;
    porcentaje: number;
    fechaInicio: string;
    fechaFin: string;
    observaciones?: string;
  }) => cliente.post<Avance>('/avances', datos).then((r) => r.data),

  actualizar: (
    id: string,
    datos: {
      porcentaje?: number;
      fechaInicio?: string;
      fechaFin?: string;
      observaciones?: string;
    },
  ) => cliente.patch<Avance>(`/avances/${id}`, datos).then((r) => r.data),

  eliminar: (id: string) =>
    cliente.delete<{ mensaje: string }>(`/avances/${id}`).then((r) => r.data),
};

// --- Web Service 4: Evidencias de capacitación -----------------------------

export const evidencias = {
  listar: (filtros: { periodoId?: string; estado?: EstadoEvidencia } = {}) =>
    cliente.get<Evidencia[]>('/evidencias', { params: filtros }).then((r) => r.data),

  /**
   * La carga usa multipart porque incluye el archivo de la constancia. No se
   * fija la cabecera Content-Type a mano: el navegador la escribe con el
   * delimitador correcto.
   */
  crear: (datos: {
    nombreCurso: string;
    institucion: string;
    fecha: string;
    horas: number;
    periodoId: string;
    archivo: File;
  }) => {
    const formulario = new FormData();
    formulario.append('nombreCurso', datos.nombreCurso);
    formulario.append('institucion', datos.institucion);
    formulario.append('fecha', datos.fecha);
    formulario.append('horas', String(datos.horas));
    formulario.append('periodoId', datos.periodoId);
    formulario.append('archivo', datos.archivo);

    return cliente.post<Evidencia>('/evidencias', formulario).then((r) => r.data);
  },

  validar: (id: string, datos: { estado: EstadoEvidencia; motivoRechazo?: string }) =>
    cliente.patch<Evidencia>(`/evidencias/${id}/validacion`, datos).then((r) => r.data),

  eliminar: (id: string) =>
    cliente.delete<{ mensaje: string }>(`/evidencias/${id}`).then((r) => r.data),
};

// --- Web Service 5: Reportes institucionales -------------------------------

/**
 * Nombre con el que se guarda el archivo descargado.
 *
 * El criterio aplicado viaja en el nombre: de otro modo, dos descargas del
 * mismo dia con acotaciones distintas se sobrescriben en la carpeta de
 * descargas y quien las recibe no sabe cual es cual.
 */
function sufijoDeArchivo(filtro: FiltroReporte): string {
  const partes: string[] = [];
  if (filtro.parcial) partes.push(`parcial${filtro.parcial}`);
  if (filtro.docenteId) partes.push('docente');
  return partes.length > 0 ? `-${partes.join('-')}` : '';
}

export const reportes = {
  indicadores: (filtro: FiltroReporte = {}) =>
    cliente
      .get<IndicadoresGlobales>('/reportes/indicadores', { params: filtro })
      .then((r) => r.data),

  porDocente: (filtro: FiltroReporte = {}) =>
    cliente
      .get<FilaReporteDocente[]>('/reportes/por-docente', { params: filtro })
      .then((r) => r.data),

  porParcial: (filtro: FiltroReporte = {}) =>
    cliente
      .get<FilaReportePorParcial[]>('/reportes/por-parcial', { params: filtro })
      .then((r) => r.data),

  porMateria: (filtro: FiltroReporte = {}) =>
    cliente
      .get<FilaReportePorMateria[]>('/reportes/por-materia', { params: filtro })
      .then((r) => r.data),

  /**
   * Descarga el reporte. La respuesta es binaria, así que se solicita como
   * blob y se dispara la descarga desde un enlace temporal.
   */
  descargar: async (formato: 'excel' | 'pdf', filtro: FiltroReporte = {}) => {
    const respuesta = await cliente.get(`/reportes/exportar/${formato}`, {
      params: filtro,
      responseType: 'blob',
    });

    const extension = formato === 'excel' ? 'xlsx' : 'pdf';
    const fecha = new Date().toISOString().slice(0, 10);
    const url = URL.createObjectURL(respuesta.data as Blob);

    const enlace = document.createElement('a');
    enlace.href = url;
    enlace.download = `siplad-reporte${sufijoDeArchivo(filtro)}-${fecha}.${extension}`;
    document.body.appendChild(enlace);
    enlace.click();
    document.body.removeChild(enlace);
    URL.revokeObjectURL(url);
  },
};

// --- Catálogos de apoyo ----------------------------------------------------

export const catalogos = {
  materias: () => cliente.get<Materia[]>('/catalogos/materias').then((r) => r.data),

  periodos: () =>
    cliente.get<PeriodoAcademico[]>('/catalogos/periodos').then((r) => r.data),

  periodoActivo: () =>
    cliente
      .get<PeriodoAcademico | null>('/catalogos/periodos/activo')
      .then((r) => r.data),
};
