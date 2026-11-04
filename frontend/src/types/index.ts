/**
 * Contratos compartidos con la API.
 *
 * Reflejan uno a uno los DTO de salida del backend. Tenerlos declarados aquí
 * es lo que permite que un cambio de nombre de campo en la API aparezca como
 * error de compilación en la interfaz, y no como un dato vacío en pantalla.
 */

export type Rol = 'PROFESOR' | 'COORDINADOR';

export type EstadoPlaneacion = 'ENVIADA' | 'APROBADA' | 'AJUSTES_SOLICITADOS';

export type EstadoAvance = 'CUMPLIDO' | 'PARCIAL' | 'NO_CUMPLIDO';

export type EstadoEvidencia = 'PENDIENTE' | 'VALIDADA' | 'RECHAZADA';

export interface Perfil {
  id: string;
  email: string;
  nombre: string;
  rol: Rol;
}

export interface RespuestaAutenticacion {
  accessToken: string;
  usuario: Perfil;
}

export interface Materia {
  id: string;
  clave: string;
  nombre: string;
  activa: boolean;
}

export interface PeriodoAcademico {
  id: string;
  nombre: string;
  anio: number;
  fechaInicio: string;
  fechaFin: string;
  activo: boolean;
}

export interface ResumenUsuario {
  id: string;
  nombre: string;
  email?: string;
}

export interface Avance {
  id: string;
  porcentaje: number;
  estado: EstadoAvance;
  /** Tramo que cubre el avance informado. */
  fechaInicio: string;
  fechaFin: string;
  /**
   * Dias habiles del tramo, descontando festivos oficiales. Lo calcula el
   * servidor con la capa de integracion de calendario.
   */
  diasHabiles?: number;
  observaciones: string | null;
  registradoEn: string;
  planeacionId: string;
  planeacion?: Planeacion;
}

export interface Planeacion {
  id: string;
  parcial: number;
  contenido: string;
  archivoUrl: string | null;
  estado: EstadoPlaneacion;
  comentarioRevision: string | null;
  revisadoEn: string | null;
  creadaEn: string;
  usuarioId: string;
  materiaId: string;
  periodoId: string;
  materia: Pick<Materia, 'id' | 'clave' | 'nombre'>;
  periodo: Pick<PeriodoAcademico, 'id' | 'nombre' | 'anio' | 'fechaInicio' | 'fechaFin'>;
  usuario: ResumenUsuario;
  revisadoPor: ResumenUsuario | null;
  avance: Avance | null;
}

export interface Evidencia {
  id: string;
  nombreCurso: string;
  institucion: string;
  fecha: string;
  horas: number;
  archivoUrl: string;
  estado: EstadoEvidencia;
  motivoRechazo: string | null;
  validadoEn: string | null;
  creadaEn: string;
  usuarioId: string;
  usuario: ResumenUsuario;
  periodo: Pick<PeriodoAcademico, 'id' | 'nombre' | 'anio'>;
  validadoPor: ResumenUsuario | null;
}

export interface IndicadoresGlobales {
  periodo: { id: string; nombre: string; anio: number } | null;
  planeaciones: {
    total: number;
    aprobadas: number;
    enviadas: number;
    ajustesSolicitados: number;
    porcentajeCumplimiento: number;
  };
  avances: {
    total: number;
    cumplidos: number;
    parciales: number;
    noCumplidos: number;
    porcentajePromedio: number;
  };
  capacitacion: {
    evidenciasValidadas: number;
    evidenciasPendientes: number;
    evidenciasRechazadas: number;
    horasAcreditadas: number;
    docentesConCapacitacion: number;
  };
  diasHabilesDelPeriodo: number | null;
}

export interface FilaReporteDocente {
  docenteId: string;
  docente: string;
  email: string;
  planeacionesRegistradas: number;
  planeacionesAprobadas: number;
  porcentajeCumplimientoPlaneacion: number;
  avancesRegistrados: number;
  promedioAvance: number;
  horasAcreditadas: number;
}

export interface FilaReportePorParcial {
  parcial: number;
  planeaciones: number;
  aprobadas: number;
  avancesRegistrados: number;
  cumplidos: number;
  parciales: number;
  noCumplidos: number;
  promedioAvance: number;
}

export interface FilaReportePorMateria {
  materiaId: string;
  clave: string;
  materia: string;
  planeaciones: number;
  aprobadas: number;
  promedioAvance: number;
}

/**
 * Acotacion de un reporte.
 *
 * Son los tres criterios que el servidor admite. El periodo se omite cuando
 * se consulta el activo, que es el caso normal.
 */
export interface FiltroReporte {
  periodoId?: string;
  parcial?: number;
  docenteId?: string;
}
