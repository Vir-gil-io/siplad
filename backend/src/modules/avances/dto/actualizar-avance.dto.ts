import { ApiProperty } from '@nestjs/swagger';
import {
  IsDateString,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

export class ActualizarAvanceDto {
  @ApiProperty({ required: false, minimum: 0, maximum: 100 })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(100)
  porcentaje?: number;

  @ApiProperty({ required: false, example: '2026-08-17' })
  @IsOptional()
  @IsDateString({}, { message: 'La fecha de inicio no es una fecha valida.' })
  fechaInicio?: string;

  @ApiProperty({ required: false, example: '2026-09-26' })
  @IsOptional()
  @IsDateString({}, { message: 'La fecha de fin no es una fecha valida.' })
  fechaFin?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  observaciones?: string;
}
