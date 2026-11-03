import { ApiProperty } from '@nestjs/swagger';
import {
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

export class CrearAvanceDto {
  @ApiProperty({ description: 'Planeacion aprobada a la que corresponde el avance' })
  @IsUUID('4', { message: 'La planeacion indicada no es valida.' })
  planeacionId: string;

  @ApiProperty({ example: 85, minimum: 0, maximum: 100 })
  @IsInt({ message: 'El porcentaje debe ser un numero entero.' })
  @Min(0, { message: 'El porcentaje no puede ser negativo.' })
  @Max(100, { message: 'El porcentaje no puede exceder 100.' })
  porcentaje: number;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  observaciones?: string;
}
