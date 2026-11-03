import { ApiProperty } from '@nestjs/swagger';
import { EstadoPlaneacion } from '@prisma/client';
import { IsEnum, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class RevisarPlaneacionDto {
  @ApiProperty({
    enum: [EstadoPlaneacion.APROBADA, EstadoPlaneacion.AJUSTES_SOLICITADOS],
    example: EstadoPlaneacion.APROBADA,
  })
  @IsEnum(EstadoPlaneacion, { message: 'El estado de revision no es valido.' })
  estado: EstadoPlaneacion;

  @ApiProperty({
    required: false,
    description: 'Obligatorio cuando se solicitan ajustes.',
  })
  @IsOptional()
  @IsString()
  @MinLength(10, { message: 'El comentario debe tener al menos 10 caracteres.' })
  @MaxLength(1000)
  comentarioRevision?: string;
}
