import { ApiProperty } from '@nestjs/swagger';
import { EstadoEvidencia } from '@prisma/client';
import { IsEnum, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class ValidarEvidenciaDto {
  @ApiProperty({
    enum: [EstadoEvidencia.VALIDADA, EstadoEvidencia.RECHAZADA],
    example: EstadoEvidencia.VALIDADA,
  })
  @IsEnum(EstadoEvidencia, { message: 'El estado de validacion no es valido.' })
  estado: EstadoEvidencia;

  @ApiProperty({
    required: false,
    description: 'Obligatorio cuando la evidencia se rechaza.',
  })
  @IsOptional()
  @IsString()
  @MinLength(10, { message: 'El motivo debe tener al menos 10 caracteres.' })
  @MaxLength(1000)
  motivoRechazo?: string;
}
