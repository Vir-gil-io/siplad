import { ApiProperty } from '@nestjs/swagger';
import {
  IsDateString,
  IsInt,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

export class CrearEvidenciaDto {
  @ApiProperty({ example: 'Evaluacion formativa en el aula' })
  @IsString()
  @MinLength(5)
  @MaxLength(200)
  nombreCurso: string;

  @ApiProperty({ example: 'Secretaria de Educacion de Guanajuato' })
  @IsString()
  @MinLength(3)
  @MaxLength(200)
  institucion: string;

  @ApiProperty({ example: '2026-09-15' })
  @IsDateString({}, { message: 'La fecha debe tener el formato AAAA-MM-DD.' })
  fecha: string;

  @ApiProperty({ example: 40, minimum: 1, maximum: 500 })
  @IsInt({ message: 'Las horas acreditadas deben ser un numero entero.' })
  @Min(1, { message: 'Las horas acreditadas deben ser mayores que cero.' })
  @Max(500, { message: 'Las horas acreditadas no pueden exceder 500.' })
  horas: number;

  @ApiProperty()
  @IsUUID('4', { message: 'El periodo academico indicado no es valido.' })
  periodoId: string;
}
