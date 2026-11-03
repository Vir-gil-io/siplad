import { Module } from '@nestjs/common';
import { JwtModule, JwtSignOptions } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { ConfigModule, ConfigService } from '@nestjs/config';

import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { JwtStrategy } from './strategies/jwt.strategy';
import { GoogleStrategy } from './strategies/google.strategy';

@Module({
  imports: [
    PassportModule,
    // Patron creacional aplicado: Factory Method. El secreto y la vigencia del
    // token se resuelven en tiempo de arranque a partir del entorno, de modo
    // que el mismo artefacto se despliega en desarrollo, pruebas y nube.
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.get<string>('JWT_SECRET') ?? 'secreto-de-desarrollo',
        signOptions: {
          // La vigencia se declara como cadena de duracion ("8h", "30m").
          expiresIn: (config.get<string>('JWT_EXPIRACION') ??
            '8h') as JwtSignOptions['expiresIn'],
        },
      }),
    }),
  ],
  controllers: [AuthController],
  providers: [AuthService, JwtStrategy, GoogleStrategy],
  exports: [AuthService],
})
export class AuthModule {}
