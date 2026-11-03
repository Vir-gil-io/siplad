import { ApiProperty } from '@nestjs/swagger';
import { Rol } from '@prisma/client';
import {
  IsEmail,
  IsEnum,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';

export class RegistrarUsuarioDto {
  @ApiProperty({ example: 'nuevo.docente@utng.edu.mx' })
  @IsEmail({}, { message: 'El correo electronico no tiene un formato valido.' })
  @MaxLength(120)
  email: string;

  @ApiProperty({ example: 'Ana Patricia Robles Cortes' })
  @IsString()
  @MinLength(5)
  @MaxLength(120)
  nombre: string;

  @ApiProperty({ example: 'Siplad2026*' })
  @IsString()
  @MinLength(8, { message: 'La contrasena debe tener al menos 8 caracteres.' })
  @MaxLength(72)
  password: string;

  @ApiProperty({ enum: Rol, required: false, default: Rol.PROFESOR })
  @IsOptional()
  @IsEnum(Rol)
  rol?: Rol;
}
