import { ApiProperty } from '@nestjs/swagger';
import { IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class ActualizarPlaneacionDto {
  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  @MinLength(20, {
    message: 'El contenido debe describir la planeacion con al menos 20 caracteres.',
  })
  @MaxLength(5000, { message: 'El contenido no puede exceder 5000 caracteres.' })
  contenido?: string;
}
