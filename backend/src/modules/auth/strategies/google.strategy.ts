import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ConfigService } from '@nestjs/config';
import { Strategy, Profile, VerifyCallback } from 'passport-google-oauth20';

/**
 * Integracion 1 de 3 con servicios de terceros — Google OAuth2.
 *
 * Capa de integracion. Traduce el perfil que devuelve el proveedor externo al
 * modelo del dominio (patron Adapter), de modo que la capa de logica de
 * negocio nunca manipula la estructura propietaria del proveedor.
 */
@Injectable()
export class GoogleStrategy extends PassportStrategy(Strategy, 'google') {
  constructor(config: ConfigService) {
    super({
      clientID: config.get<string>('GOOGLE_CLIENT_ID') || 'sin-configurar',
      clientSecret: config.get<string>('GOOGLE_CLIENT_SECRET') || 'sin-configurar',
      callbackURL:
        config.get<string>('GOOGLE_CALLBACK_URL') ||
        'http://localhost:3000/api/auth/google/callback',
      scope: ['email', 'profile'],
    });
  }

  validate(
    _accessToken: string,
    _refreshToken: string,
    perfil: Profile,
    done: VerifyCallback,
  ): void {
    const correo = perfil.emails?.[0]?.value;

    if (!correo) {
      done(new Error('El proveedor de identidad no proporciono un correo electronico.'));
      return;
    }

    done(null, {
      googleId: perfil.id,
      email: correo,
      nombre: perfil.displayName || correo.split('@')[0],
    });
  }
}
