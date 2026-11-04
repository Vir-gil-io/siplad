import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsOptional, IsUUID, Max, Min } from 'class-validator';

/**
 * Acotacion de un reporte.
 *
 * Los tres criterios son los que tienen sentido para quien consulta: el
 * periodo academico, un parcial concreto y un docente concreto. No se admite
 * filtrar por materia porque el desglose por materia ya es una de las
 * secciones del propio reporte.
 */
export class FiltrarReporteDto {
  @ApiPropertyOptional({ description: 'Periodo academico; por omision, el activo' })
  @IsOptional()
  @IsUUID('4', { message: 'El periodo indicado no es valido.' })
  periodoId?: string;

  @ApiPropertyOptional({ minimum: 1, maximum: 3 })
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'El parcial debe ser un numero entero.' })
  @Min(1, { message: 'El parcial debe estar entre 1 y 3.' })
  @Max(3, { message: 'El parcial debe estar entre 1 y 3.' })
  parcial?: number;

  @ApiPropertyOptional({ description: 'Acota el reporte a un solo docente' })
  @IsOptional()
  @IsUUID('4', { message: 'El docente indicado no es valido.' })
  docenteId?: string;
}

/** Forma que consumen el servicio de reportes y el de exportacion. */
export interface FiltroReporte {
  periodoId?: string;
  parcial?: number;
  docenteId?: string;
}
