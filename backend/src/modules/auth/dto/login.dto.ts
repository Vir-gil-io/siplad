import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsString, MinLength, MaxLength } from 'class-validator';

export class LoginDto {
  @ApiProperty({ example: 'coordinacion@utng.edu.mx' })
  @IsEmail({}, { message: 'El correo electronico no tiene un formato valido.' })
  @MaxLength(120)
  email: string;

  @ApiProperty({ example: 'Siplad2026*' })
  @IsString()
  @MinLength(8, { message: 'La contrasena debe tener al menos 8 caracteres.' })
  @MaxLength(72)
  password: string;
}
