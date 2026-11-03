import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { FestivosService } from '../../integrations/festivos/festivos.service';

/**
 * Catalogos de apoyo — materias y periodos academicos.
 *
 * Alimenta los selectores de la capa de presentacion. El detalle del periodo
 * incorpora los dias inhabiles oficiales obtenidos de la capa de integracion.
 */
@Injectable()
export class CatalogosService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly festivos: FestivosService,
  ) {}

  listarMaterias() {
    return this.prisma.materia.findMany({
      where: { activa: true },
      orderBy: { clave: 'asc' },
    });
  }

  listarPeriodos() {
    return this.prisma.periodoAcademico.findMany({
      orderBy: [{ anio: 'desc' }, { fechaInicio: 'desc' }],
    });
  }

  periodoActivo() {
    return this.prisma.periodoAcademico.findFirst({ where: { activo: true } });
  }

  /**
   * Devuelve el periodo con su calendario de dias habiles, descontando
   * sabados, domingos y los dias inhabiles oficiales del pais.
   */
  async detallePeriodo(id: string) {
    const periodo = await this.prisma.periodoAcademico.findUnique({
      where: { id },
    });

    if (!periodo) {
      throw new NotFoundException('El periodo academico solicitado no existe.');
    }

    const [diasHabiles, festivos] = await Promise.all([
      this.festivos.contarDiasHabiles(periodo.fechaInicio, periodo.fechaFin),
      this.festivos.obtenerFestivos(periodo.anio),
    ]);

    // Solo se informan los dias inhabiles que caen dentro del periodo.
    const dentroDelPeriodo = festivos.filter((f) => {
      const fecha = new Date(f.fecha);
      return fecha >= periodo.fechaInicio && fecha <= periodo.fechaFin;
    });

    return { ...periodo, diasHabiles, diasInhabiles: dentroDelPeriodo };
  }
}
