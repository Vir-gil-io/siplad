import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Rol } from '@prisma/client';
import { CLAVE_ROLES } from '../decorators/roles.decorator';
import { CLAVE_PUBLICO } from '../decorators/publico.decorator';
import { PeticionAutenticada } from '../decorators/usuario-actual.decorator';

/**
 * Segundo eslabon de la cadena de responsabilidad de seguridad.
 *
 * OWASP A01 — Verifica que el rol del usuario autenticado figure entre los
 * roles declarados para la ruta. Una ruta sin declaracion de roles queda
 * accesible a cualquier usuario autenticado.
 */
@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(contexto: ExecutionContext): boolean {
    const esPublico = this.reflector.getAllAndOverride<boolean>(CLAVE_PUBLICO, [
      contexto.getHandler(),
      contexto.getClass(),
    ]);
    if (esPublico) return true;

    const rolesRequeridos = this.reflector.getAllAndOverride<Rol[]>(CLAVE_ROLES, [
      contexto.getHandler(),
      contexto.getClass(),
    ]);

    if (!rolesRequeridos || rolesRequeridos.length === 0) return true;

    const { user } = contexto.switchToHttp().getRequest<PeticionAutenticada>();

    if (!user || !rolesRequeridos.includes(user.rol)) {
      throw new ForbiddenException(
        'No cuenta con los permisos necesarios para realizar esta operacion.',
      );
    }

    return true;
  }
}
