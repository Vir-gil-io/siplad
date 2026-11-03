import { ApiProperty } from '@nestjs/swagger';
import { IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class ActualizarPlaneacionDto {
  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  @MinLength(20)
  @MaxLength(5000)
  contenido?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  archivoUrl?: string;
}
