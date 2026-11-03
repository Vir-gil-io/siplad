import { ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AuthGuard } from '@nestjs/passport';
import { CLAVE_PUBLICO } from '../decorators/publico.decorator';

/**
 * Primer eslabon de la cadena de responsabilidad de seguridad.
 *
 * Verifica la firma y la vigencia del token en toda peticion, salvo en las
 * rutas marcadas de forma explicita con @Publico(). El criterio es cerrado por
 * omision: una ruta nueva queda protegida sin intervencion del desarrollador.
 */
@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  constructor(private readonly reflector: Reflector) {
    super();
  }

  canActivate(contexto: ExecutionContext) {
    const esPublico = this.reflector.getAllAndOverride<boolean>(CLAVE_PUBLICO, [
      contexto.getHandler(),
      contexto.getClass(),
    ]);

    if (esPublico) return true;
    return super.canActivate(contexto);
  }
}
