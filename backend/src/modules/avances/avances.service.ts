import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { EstadoAvance, EstadoPlaneacion, Rol } from '@prisma/client';

import { PrismaService } from '../../prisma/prisma.service';
import { FestivosService } from '../../integrations/festivos/festivos.service';
import { CrearAvanceDto } from './dto/crear-avance.dto';
import { ActualizarAvanceDto } from './dto/actualizar-avance.dto';
import { UsuarioAutenticado } from '../../common/decorators/usuario-actual.decorator';

/**
 * Web Service 3 de 5 — Control de avances por parcial.
 *
 * Capa de logica de negocio. Deriva el estado de cumplimiento a partir del
 * porcentaje informado y garantiza que el avance se registre unicamente sobre
 * planeaciones ya aprobadas por la coordinacion.
 */
@Injectable()
export class AvancesService {
  /** Umbrales institucionales de clasificacion del cumplimiento. */
  private static readonly UMBRAL_CUMPLIDO = 85;
  private static readonly UMBRAL_PARCIAL = 60;

  private readonly relaciones = {
    planeacion: {
      include: {
        materia: { select: { id: true, clave: true, nombre: true } },
        periodo: {
          select: {
            id: true,
            nombre: true,
            anio: true,
            fechaInicio: true,
            fechaFin: true,
          },
        },
        usuario: { select: { id: true, nombre: true, email: true } },
      },
    },
  };

  constructor(
    private readonly prisma: PrismaService,
    private readonly festivos: FestivosService,
  ) {}

  /**
   * Comprueba el tramo informado contra el periodo academico de la planeacion.
   *
   * Las fechas llegan como 'AAAA-MM-DD' y se interpretan en UTC de forma
   * deliberada: el servidor de produccion corre en UTC y el equipo del docente
   * no, de modo que comparar con la hora local desplazaria el limite un dia
   * segun quien registre y desde donde.
   */
  private validarTramo(
    inicio: string,
    fin: string,
    periodo: { nombre: string; fechaInicio: Date; fechaFin: Date },
  ): { fechaInicio: Date; fechaFin: Date } {
    const fechaInicio = new Date(`${inicio.slice(0, 10)}T00:00:00.000Z`);
    const fechaFin = new Date(`${fin.slice(0, 10)}T23:59:59.999Z`);

    if (fechaFin < fechaInicio) {
      throw new BadRequestException(
        'La fecha de fin no puede ser anterior a la de inicio.',
      );
    }

    const hoy = new Date();
    if (fechaInicio > hoy) {
      throw new BadRequestException('El tramo informado no puede comenzar en el futuro.');
    }

    if (fechaInicio < periodo.fechaInicio || fechaFin > periodo.fechaFin) {
      throw new BadRequestException(
        `El tramo informado debe quedar dentro del periodo ${periodo.nombre}, ` +
          `del ${AvancesService.enTexto(periodo.fechaInicio)} al ` +
          `${AvancesService.enTexto(periodo.fechaFin)}.`,
      );
    }

    return { fechaInicio, fechaFin };
  }

  /** Fecha en formato corto para los mensajes de error. */
  private static enTexto(fecha: Date): string {
    return fecha.toISOString().slice(0, 10);
  }

  /**
   * Anade los dias habiles del tramo informado.
   *
   * Es lo que convierte el rango en informacion util para coordinacion: un
   * 60 % logrado en ocho dias habiles no dice lo mismo que el mismo 60 % en
   * treinta. El calculo descuenta los festivos oficiales que entrega la capa
   * de integracion, que los cachea por anio.
   */
  private async conDiasHabiles<T extends { fechaInicio: Date; fechaFin: Date }>(
    avance: T,
  ): Promise<T & { diasHabiles: number }> {
    const diasHabiles = await this.festivos.contarDiasHabiles(
      avance.fechaInicio,
      avance.fechaFin,
    );
    return { ...avance, diasHabiles };
  }

  /**
   * Regla de negocio central del modulo: la clasificacion no la decide el
   * usuario, se deriva del porcentaje para que el indicador institucional sea
   * comparable entre docentes.
   */
  static clasificar(porcentaje: number): EstadoAvance {
    if (porcentaje >= AvancesService.UMBRAL_CUMPLIDO) return EstadoAvance.CUMPLIDO;
    if (porcentaje >= AvancesService.UMBRAL_PARCIAL) return EstadoAvance.PARCIAL;
    return EstadoAvance.NO_CUMPLIDO;
  }

  async crear(dto: CrearAvanceDto, usuario: UsuarioAutenticado) {
    const planeacion = await this.prisma.planeacion.findUnique({
      where: { id: dto.planeacionId },
      include: { avance: true, periodo: true },
    });

    if (!planeacion) {
      throw new NotFoundException('La planeacion indicada no existe.');
    }

    if (planeacion.usuarioId !== usuario.id) {
      throw new ForbiddenException(
        'Solo puede registrar avances sobre sus propias planeaciones.',
      );
    }

    if (planeacion.estado !== EstadoPlaneacion.APROBADA) {
      throw new BadRequestException(
        'El avance solo puede registrarse sobre una planeacion aprobada.',
      );
    }

    if (planeacion.avance) {
      throw new BadRequestException(
        `Ya existe un avance registrado para el parcial ${planeacion.parcial} de esa materia.`,
      );
    }

    const tramo = this.validarTramo(dto.fechaInicio, dto.fechaFin, planeacion.periodo);

    const creado = await this.prisma.avance.create({
      data: {
        planeacionId: dto.planeacionId,
        porcentaje: dto.porcentaje,
        estado: AvancesService.clasificar(dto.porcentaje),
        fechaInicio: tramo.fechaInicio,
        fechaFin: tramo.fechaFin,
        observaciones: dto.observaciones,
      },
      include: this.relaciones,
    });

    return this.conDiasHabiles(creado);
  }

  async listar(usuario: UsuarioAutenticado, periodoId?: string) {
    const avances = await this.prisma.avance.findMany({
      where: {
        planeacion: {
          ...(usuario.rol === Rol.PROFESOR && { usuarioId: usuario.id }),
          ...(periodoId && { periodoId }),
        },
      },
      include: this.relaciones,
      orderBy: [{ fechaFin: 'desc' }, { registradoEn: 'desc' }],
    });

    return Promise.all(avances.map((avance) => this.conDiasHabiles(avance)));
  }

  async obtenerPorId(id: string, usuario: UsuarioAutenticado) {
    const avance = await this.prisma.avance.findUnique({
      where: { id },
      include: this.relaciones,
    });

    if (!avance) {
      throw new NotFoundException('El avance solicitado no existe.');
    }

    if (usuario.rol === Rol.PROFESOR && avance.planeacion.usuarioId !== usuario.id) {
      throw new ForbiddenException('No tiene acceso a la informacion de otro docente.');
    }

    return avance;
  }

  async actualizar(id: string, dto: ActualizarAvanceDto, usuario: UsuarioAutenticado) {
    const avance = await this.obtenerPorId(id, usuario);

    if (avance.planeacion.usuarioId !== usuario.id) {
      throw new ForbiddenException('Solo el autor puede modificar el avance registrado.');
    }

    // El tramo se revalida completo aunque solo se envie uno de los dos
    // extremos: corregir solo la fecha de fin podria invertir el intervalo.
    let tramo: { fechaInicio: Date; fechaFin: Date } | undefined;

    if (dto.fechaInicio !== undefined || dto.fechaFin !== undefined) {
      const periodo = await this.prisma.periodoAcademico.findUniqueOrThrow({
        where: { id: avance.planeacion.periodoId },
      });

      tramo = this.validarTramo(
        dto.fechaInicio ?? AvancesService.enTexto(avance.fechaInicio),
        dto.fechaFin ?? AvancesService.enTexto(avance.fechaFin),
        periodo,
      );
    }

    const actualizado = await this.prisma.avance.update({
      where: { id },
      data: {
        ...(dto.porcentaje !== undefined && {
          porcentaje: dto.porcentaje,
          estado: AvancesService.clasificar(dto.porcentaje),
        }),
        ...(tramo && { fechaInicio: tramo.fechaInicio, fechaFin: tramo.fechaFin }),
        ...(dto.observaciones !== undefined && {
          observaciones: dto.observaciones,
        }),
      },
      include: this.relaciones,
    });

    return this.conDiasHabiles(actualizado);
  }

  async eliminar(id: string, usuario: UsuarioAutenticado) {
    const avance = await this.obtenerPorId(id, usuario);

    if (avance.planeacion.usuarioId !== usuario.id && usuario.rol !== Rol.COORDINADOR) {
      throw new ForbiddenException(
        'Solo el autor o la coordinacion pueden eliminar el avance.',
      );
    }

    await this.prisma.avance.delete({ where: { id } });
    return { mensaje: 'Avance eliminado.' };
  }
}
