import {
  Body,
  Controller,
  Get,
  Post,
  Req,
  Res,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ConfigService } from '@nestjs/config';
import {
  ApiTags,
  ApiOperation,
  ApiBearerAuth,
  ApiExcludeEndpoint,
} from '@nestjs/swagger';
import { Response } from 'express';

import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { RegistrarUsuarioDto } from './dto/registrar-usuario.dto';
import { Publico } from '../../common/decorators/publico.decorator';
import {
  UsuarioActual,
  UsuarioAutenticado,
} from '../../common/decorators/usuario-actual.decorator';

/**
 * Forma de la peticion en el retorno del proveedor externo de identidad.
 * La estrategia de Google deposita aqui el perfil ya traducido al dominio.
 */
interface PeticionConPerfilExterno {
  user: { email: string; nombre: string; googleId: string };
}

/**
 * Web Service 1 de 5 — Autenticacion.
 *
 * Capa de presentacion del modulo. Expone el contrato HTTP y delega toda
 * decision de negocio en AuthService.
 */
@ApiTags('1. Autenticacion')
@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly config: ConfigService,
  ) {}

  @Publico()
  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Inicia sesion con credenciales institucionales' })
  iniciarSesion(@Body() dto: LoginDto) {
    return this.authService.iniciarSesion(dto);
  }

  @Publico()
  @Post('registro')
  @ApiOperation({ summary: 'Registra una cuenta nueva' })
  registrar(@Body() dto: RegistrarUsuarioDto) {
    return this.authService.registrar(dto);
  }

  @Publico()
  @Get('google')
  @UseGuards(AuthGuard('google'))
  @ApiOperation({
    summary: 'Inicia el flujo de autenticacion federada con Google OAuth2',
  })
  iniciarFlujoGoogle() {
    // El guard redirige al proveedor externo; este cuerpo nunca se ejecuta.
  }

  @Publico()
  @Get('google/callback')
  @UseGuards(AuthGuard('google'))
  @ApiExcludeEndpoint()
  async callbackGoogle(
    @Req() peticion: PeticionConPerfilExterno,
    @Res() respuesta: Response,
  ) {
    const resultado = await this.authService.autenticarConProveedorExterno(peticion.user);

    const destino = this.config.get<string>('FRONTEND_URL') ?? 'http://localhost:5173';

    // El token viaja en el fragmento de la URL para que no quede registrado en
    // las bitacoras del servidor ni en el historial de referencias.
    return respuesta.redirect(`${destino}/auth/callback#token=${resultado.accessToken}`);
  }

  @ApiBearerAuth()
  @Get('perfil')
  @ApiOperation({ summary: 'Devuelve el perfil del usuario autenticado' })
  perfil(@UsuarioActual() usuario: UsuarioAutenticado) {
    return this.authService.obtenerPerfil(usuario.id);
  }
}
