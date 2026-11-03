import { ApiProperty } from '@nestjs/swagger';
import { IsInt, IsString, IsUUID, Max, MaxLength, Min, MinLength } from 'class-validator';

export class CrearPlaneacionDto {
  @ApiProperty({ example: 1, minimum: 1, maximum: 3 })
  @IsInt()
  @Min(1, { message: 'El parcial debe estar entre 1 y 3.' })
  @Max(3, { message: 'El parcial debe estar entre 1 y 3.' })
  parcial: number;

  @ApiProperty({
    example: 'Objetivos, secuencia didactica, recursos e instrumentos de evaluacion.',
  })
  @IsString()
  @MinLength(20, {
    message: 'El contenido debe describir la planeacion con al menos 20 caracteres.',
  })
  @MaxLength(5000, { message: 'El contenido no puede exceder 5000 caracteres.' })
  contenido: string;

  @ApiProperty()
  @IsUUID('4', { message: 'La materia indicada no es valida.' })
  materiaId: string;

  @ApiProperty()
  @IsUUID('4', { message: 'El periodo academico indicado no es valido.' })
  periodoId: string;

  // La direccion del archivo no se acepta desde el cliente de forma
  // deliberada: llega como adjunto y la produce la capa de integracion. Si se
  // admitiera como texto, un cliente podria apuntar el registro a cualquier
  // direccion externa.
}
