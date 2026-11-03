import {
  Injectable,
  UnauthorizedException,
  ConflictException,
  Logger,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Rol, Usuario } from '@prisma/client';
import * as bcrypt from 'bcryptjs';

import { PrismaService } from '../../prisma/prisma.service';
import { LoginDto } from './dto/login.dto';
import { RegistrarUsuarioDto } from './dto/registrar-usuario.dto';

export interface PerfilPublico {
  id: string;
  email: string;
  nombre: string;
  rol: Rol;
}

export interface RespuestaAutenticacion {
  accessToken: string;
  usuario: PerfilPublico;
}

/**
 * Web Service 1 de 5 — Autenticacion y autorizacion.
 *
 * Capa de logica de negocio. Admite dos estrategias de autenticacion
 * intercambiables (patron Strategy): credenciales locales con JWT propio y
 * federacion con un proveedor externo de identidad mediante OAuth2.
 */
@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);
  private readonly rondasHash = 10;

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
  ) {}

  /**
   * OWASP A07 — La respuesta es identica ante correo inexistente y ante
   * contrasena incorrecta, para no revelar que cuentas existen.
   */
  async iniciarSesion(dto: LoginDto): Promise<RespuestaAutenticacion> {
    const usuario = await this.prisma.usuario.findUnique({
      where: { email: dto.email.toLowerCase().trim() },
    });

    const credencialesInvalidas = new UnauthorizedException(
      'Las credenciales proporcionadas no son correctas.',
    );

    if (!usuario || !usuario.password || !usuario.activo) {
      throw credencialesInvalidas;
    }

    const coincide = await bcrypt.compare(dto.password, usuario.password);
    if (!coincide) {
      this.logger.warn(`Intento de acceso fallido para ${dto.email}`);
      throw credencialesInvalidas;
    }

    return this.emitirToken(usuario);
  }

  /**
   * OWASP A02 — La contrasena se almacena unicamente como hash bcrypt; el
   * valor en claro nunca se persiste ni se registra en bitacora.
   */
  async registrar(dto: RegistrarUsuarioDto): Promise<RespuestaAutenticacion> {
    const email = dto.email.toLowerCase().trim();

    const existente = await this.prisma.usuario.findUnique({ where: { email } });
    if (existente) {
      throw new ConflictException('Ya existe una cuenta con ese correo electronico.');
    }

    const usuario = await this.prisma.usuario.create({
      data: {
        email,
        nombre: dto.nombre.trim(),
        password: await bcrypt.hash(dto.password, this.rondasHash),
        rol: dto.rol ?? Rol.PROFESOR,
      },
    });

    return this.emitirToken(usuario);
  }

  /**
   * Capa de integracion — alta o recuperacion del usuario proveniente del
   * proveedor externo de identidad. En el primer acceso la cuenta se crea de
   * forma automatica; en los siguientes se vincula por identificador externo.
   */
  async autenticarConProveedorExterno(datos: {
    email: string;
    nombre: string;
    googleId: string;
  }): Promise<RespuestaAutenticacion> {
    const email = datos.email.toLowerCase().trim();

    let usuario = await this.prisma.usuario.findFirst({
      where: { OR: [{ googleId: datos.googleId }, { email }] },
    });

    if (!usuario) {
      usuario = await this.prisma.usuario.create({
        data: {
          email,
          nombre: datos.nombre,
          googleId: datos.googleId,
          rol: Rol.PROFESOR,
        },
      });
      this.logger.log(`Cuenta creada por federacion para ${email}`);
    } else if (!usuario.googleId) {
      usuario = await this.prisma.usuario.update({
        where: { id: usuario.id },
        data: { googleId: datos.googleId },
      });
    }

    if (!usuario.activo) {
      throw new UnauthorizedException('La cuenta se encuentra desactivada.');
    }

    return this.emitirToken(usuario);
  }

  /** Validacion invocada por la estrategia JWT en cada peticion protegida. */
  async validarUsuarioDelToken(id: string): Promise<PerfilPublico> {
    const usuario = await this.prisma.usuario.findUnique({ where: { id } });

    if (!usuario || !usuario.activo) {
      throw new UnauthorizedException('La sesion no es valida.');
    }

    return this.aPerfilPublico(usuario);
  }

  async obtenerPerfil(id: string): Promise<PerfilPublico> {
    return this.validarUsuarioDelToken(id);
  }

  private emitirToken(usuario: Usuario): RespuestaAutenticacion {
    const accessToken = this.jwt.sign({
      sub: usuario.id,
      email: usuario.email,
      rol: usuario.rol,
    });

    return { accessToken, usuario: this.aPerfilPublico(usuario) };
  }

  /**
   * Patron estructural: Data Transfer Object de salida. Excluye el hash de la
   * contrasena y el identificador externo de toda respuesta de la API.
   */
  private aPerfilPublico(usuario: Usuario): PerfilPublico {
    return {
      id: usuario.id,
      email: usuario.email,
      nombre: usuario.nombre,
      rol: usuario.rol,
    };
  }
}
