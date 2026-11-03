import { ExtractJwt, Strategy } from 'passport-jwt';
import { PassportStrategy } from '@nestjs/passport';
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AuthService } from '../auth.service';

/**
 * Estrategia local con JWT.
 *
 * Patron de comportamiento aplicado: Strategy. Comparte interfaz con la
 * estrategia federada, de modo que el resto de la aplicacion desconoce por
 * cual de las dos se autentico el usuario.
 */
@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, 'jwt') {
  constructor(
    config: ConfigService,
    private readonly authService: AuthService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: config.get<string>('JWT_SECRET') ?? 'secreto-de-desarrollo',
    });
  }

  /**
   * Se consulta la base de datos en cada peticion para que una cuenta
   * desactivada deje de tener acceso de inmediato, sin esperar a que expire
   * su token.
   */
  async validate(payload: { sub: string }) {
    return this.authService.validarUsuarioDelToken(payload.sub);
  }
}
