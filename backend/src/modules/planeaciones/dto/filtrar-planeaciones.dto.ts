import { ApiProperty } from '@nestjs/swagger';
import { EstadoPlaneacion } from '@prisma/client';
import { IsEnum, IsInt, IsOptional, IsUUID, Max, Min } from 'class-validator';

export class FiltrarPlaneacionesDto {
  @ApiProperty({ required: false })
  @IsOptional()
  @IsUUID('4')
  periodoId?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsUUID('4')
  materiaId?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsUUID('4')
  usuarioId?: string;

  @ApiProperty({ required: false, enum: EstadoPlaneacion })
  @IsOptional()
  @IsEnum(EstadoPlaneacion)
  estado?: EstadoPlaneacion;

  @ApiProperty({ required: false, minimum: 1, maximum: 3 })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(3)
  parcial?: number;
}
