import { Injectable } from '@nestjs/common';
import { EstadoAvance, EstadoEvidencia, EstadoPlaneacion } from '@prisma/client';

import { PrismaService } from '../../prisma/prisma.service';
import { FestivosService } from '../../integrations/festivos/festivos.service';
import type { FiltroReporte } from './dto/filtrar-reporte.dto';

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

/**
 * Web Service 5 de 5 — Reportes y seguimiento institucional.
 *
 * Capa de logica de negocio. Agrega los indicadores de cumplimiento por
 * docente, por materia y por parcial, y produce los conjuntos de datos que
 * alimentan tanto las graficas de la capa de presentacion como la exportacion
 * a PDF y a Excel.
 */
@Injectable()
export class ReportesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly festivos: FestivosService,
  ) {}

  /** Resuelve el periodo solicitado o, en su defecto, el periodo activo. */
  /**
   * Construye el fragmento de filtrado que comparten todas las consultas.
   *
   * El parcial y el docente acotan planeaciones; las evidencias no tienen
   * parcial, de modo que para ellas solo aplica el docente. Separar los dos
   * fragmentos evita filtrar por una propiedad que ese modelo no posee.
   */
  private filtroPlaneaciones(periodoId: string | undefined, filtro: FiltroReporte) {
    return {
      ...(periodoId && { periodoId }),
      ...(filtro.parcial && { parcial: filtro.parcial }),
      ...(filtro.docenteId && { usuarioId: filtro.docenteId }),
    };
  }

  private filtroEvidencias(periodoId: string | undefined, filtro: FiltroReporte) {
    return {
      ...(periodoId && { periodoId }),
      ...(filtro.docenteId && { usuarioId: filtro.docenteId }),
    };
  }

  private async resolverPeriodo(periodoId?: string) {
    if (periodoId) {
      return this.prisma.periodoAcademico.findUnique({ where: { id: periodoId } });
    }
    return this.prisma.periodoAcademico.findFirst({ where: { activo: true } });
  }

  async indicadoresGlobales(filtro: FiltroReporte = {}): Promise<IndicadoresGlobales> {
    const periodo = await this.resolverPeriodo(filtro.periodoId);
    const dePlaneacion = this.filtroPlaneaciones(periodo?.id, filtro);
    const deEvidencia = this.filtroEvidencias(periodo?.id, filtro);

    const [planeaciones, avances, evidencias] = await Promise.all([
      this.prisma.planeacion.findMany({
        where: dePlaneacion,
        select: { estado: true },
      }),
      this.prisma.avance.findMany({
        where: { planeacion: dePlaneacion },
        select: { estado: true, porcentaje: true },
      }),
      this.prisma.evidencia.findMany({
        where: deEvidencia,
        select: { estado: true, horas: true, usuarioId: true },
      }),
    ]);

    const aprobadas = planeaciones.filter(
      (p) => p.estado === EstadoPlaneacion.APROBADA,
    ).length;

    const validadas = evidencias.filter((e) => e.estado === EstadoEvidencia.VALIDADA);

    // Los dias habiles provienen de la capa de integracion. Si el servicio
    // externo no responde, el indicador se informa como no disponible en lugar
    // de bloquear el reporte completo.
    let diasHabiles: number | null = null;
    if (periodo) {
      const conteo = await this.festivos.contarDiasHabiles(
        periodo.fechaInicio,
        periodo.fechaFin,
      );
      diasHabiles = conteo > 0 ? conteo : null;
    }

    return {
      periodo: periodo
        ? { id: periodo.id, nombre: periodo.nombre, anio: periodo.anio }
        : null,
      planeaciones: {
        total: planeaciones.length,
        aprobadas,
        enviadas: planeaciones.filter((p) => p.estado === EstadoPlaneacion.ENVIADA)
          .length,
        ajustesSolicitados: planeaciones.filter(
          (p) => p.estado === EstadoPlaneacion.AJUSTES_SOLICITADOS,
        ).length,
        porcentajeCumplimiento: this.porcentaje(aprobadas, planeaciones.length),
      },
      avances: {
        total: avances.length,
        cumplidos: avances.filter((a) => a.estado === EstadoAvance.CUMPLIDO).length,
        parciales: avances.filter((a) => a.estado === EstadoAvance.PARCIAL).length,
        noCumplidos: avances.filter((a) => a.estado === EstadoAvance.NO_CUMPLIDO).length,
        porcentajePromedio: this.promedio(avances.map((a) => a.porcentaje)),
      },
      capacitacion: {
        evidenciasValidadas: validadas.length,
        evidenciasPendientes: evidencias.filter(
          (e) => e.estado === EstadoEvidencia.PENDIENTE,
        ).length,
        evidenciasRechazadas: evidencias.filter(
          (e) => e.estado === EstadoEvidencia.RECHAZADA,
        ).length,
        horasAcreditadas: validadas.reduce((suma, e) => suma + e.horas, 0),
        docentesConCapacitacion: new Set(validadas.map((e) => e.usuarioId)).size,
      },
      diasHabilesDelPeriodo: diasHabiles,
    };
  }

  async porDocente(filtro: FiltroReporte = {}): Promise<FilaReporteDocente[]> {
    const periodo = await this.resolverPeriodo(filtro.periodoId);
    const dePlaneacion = this.filtroPlaneaciones(periodo?.id, filtro);
    const deEvidencia = this.filtroEvidencias(periodo?.id, filtro);

    const docentes = await this.prisma.usuario.findMany({
      where: {
        rol: 'PROFESOR',
        activo: true,
        ...(filtro.docenteId && { id: filtro.docenteId }),
      },
      include: {
        planeaciones: {
          where: dePlaneacion,
          include: { avance: true },
        },
        evidencias: {
          where: { ...deEvidencia, estado: EstadoEvidencia.VALIDADA },
          select: { horas: true },
        },
      },
      orderBy: { nombre: 'asc' },
    });

    return docentes.map((d) => {
      const aprobadas = d.planeaciones.filter(
        (p) => p.estado === EstadoPlaneacion.APROBADA,
      ).length;

      const avances = d.planeaciones
        .map((p) => p.avance)
        .filter((a) => a !== null && a !== undefined);

      return {
        docenteId: d.id,
        docente: d.nombre,
        email: d.email,
        planeacionesRegistradas: d.planeaciones.length,
        planeacionesAprobadas: aprobadas,
        porcentajeCumplimientoPlaneacion: this.porcentaje(
          aprobadas,
          d.planeaciones.length,
        ),
        avancesRegistrados: avances.length,
        promedioAvance: this.promedio(avances.map((a) => a.porcentaje)),
        horasAcreditadas: d.evidencias.reduce((suma, e) => suma + e.horas, 0),
      };
    });
  }

  async porParcial(filtro: FiltroReporte = {}): Promise<FilaReportePorParcial[]> {
    const periodo = await this.resolverPeriodo(filtro.periodoId);

    const planeaciones = await this.prisma.planeacion.findMany({
      where: this.filtroPlaneaciones(periodo?.id, filtro),
      include: { avance: true },
    });

    // Cuando se acota a un parcial, el desglose conserva solo esa fila.
    const parciales = filtro.parcial ? [filtro.parcial] : [1, 2, 3];

    return parciales.map((parcial) => {
      const delParcial = planeaciones.filter((p) => p.parcial === parcial);
      const avances = delParcial
        .map((p) => p.avance)
        .filter((a) => a !== null && a !== undefined);

      return {
        parcial,
        planeaciones: delParcial.length,
        aprobadas: delParcial.filter((p) => p.estado === EstadoPlaneacion.APROBADA)
          .length,
        avancesRegistrados: avances.length,
        cumplidos: avances.filter((a) => a.estado === EstadoAvance.CUMPLIDO).length,
        parciales: avances.filter((a) => a.estado === EstadoAvance.PARCIAL).length,
        noCumplidos: avances.filter((a) => a.estado === EstadoAvance.NO_CUMPLIDO).length,
        promedioAvance: this.promedio(avances.map((a) => a.porcentaje)),
      };
    });
  }

  async porMateria(filtro: FiltroReporte = {}) {
    const periodo = await this.resolverPeriodo(filtro.periodoId);

    const materias = await this.prisma.materia.findMany({
      where: { activa: true },
      include: {
        planeaciones: {
          where: this.filtroPlaneaciones(periodo?.id, filtro),
          include: { avance: true },
        },
      },
      orderBy: { clave: 'asc' },
    });

    return materias.map((m) => {
      const avances = m.planeaciones
        .map((p) => p.avance)
        .filter((a) => a !== null && a !== undefined);

      return {
        materiaId: m.id,
        clave: m.clave,
        materia: m.nombre,
        planeaciones: m.planeaciones.length,
        aprobadas: m.planeaciones.filter((p) => p.estado === EstadoPlaneacion.APROBADA)
          .length,
        promedioAvance: this.promedio(avances.map((a) => a.porcentaje)),
      };
    });
  }

  private porcentaje(parte: number, total: number): number {
    if (total === 0) return 0;
    return Math.round((parte / total) * 1000) / 10;
  }

  private promedio(valores: number[]): number {
    if (valores.length === 0) return 0;
    const suma = valores.reduce((a, b) => a + b, 0);
    return Math.round((suma / valores.length) * 10) / 10;
  }
}
