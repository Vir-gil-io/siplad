import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

/**
 * Capa de datos del modulo de planeaciones.
 *
 * Patron estructural aplicado: Repository. Encapsula el acceso a persistencia
 * de modo que la capa de logica de negocio exprese intenciones del dominio
 * ("registrar una planeacion") en lugar de sentencias de consulta. Permite
 * sustituir el motor de persistencia sin alterar las reglas de negocio y
 * sustituir el repositorio por un doble en las pruebas unitarias.
 */
@Injectable()
export class PlaneacionesRepository {
  /** Relaciones que se incluyen en toda lectura, para evitar consultas N+1. */
  private readonly relaciones = {
    materia: { select: { id: true, clave: true, nombre: true } },
    // Las fechas del periodo viajan con la planeacion porque el formulario de
    // avance acota con ellas el tramo que el docente puede informar.
    periodo: {
      select: {
        id: true,
        nombre: true,
        anio: true,
        activo: true,
        fechaInicio: true,
        fechaFin: true,
      },
    },
    usuario: { select: { id: true, nombre: true, email: true } },
    revisadoPor: { select: { id: true, nombre: true } },
    avance: true,
  };

  constructor(private readonly prisma: PrismaService) {}

  crear(datos: Prisma.PlaneacionUncheckedCreateInput) {
    return this.prisma.planeacion.create({
      data: datos,
      include: this.relaciones,
    });
  }

  buscarPorId(id: string) {
    return this.prisma.planeacion.findUnique({
      where: { id },
      include: this.relaciones,
    });
  }

  buscarDuplicada(parametros: {
    usuarioId: string;
    materiaId: string;
    periodoId: string;
    parcial: number;
  }) {
    return this.prisma.planeacion.findUnique({
      where: { planeacion_unica: parametros },
    });
  }

  listar(filtro: Prisma.PlaneacionWhereInput) {
    return this.prisma.planeacion.findMany({
      where: filtro,
      include: this.relaciones,
      orderBy: [{ creadaEn: 'desc' }, { parcial: 'asc' }],
    });
  }

  actualizar(id: string, datos: Prisma.PlaneacionUpdateInput) {
    return this.prisma.planeacion.update({
      where: { id },
      data: datos,
      include: this.relaciones,
    });
  }

  eliminar(id: string) {
    return this.prisma.planeacion.delete({ where: { id } });
  }
}
