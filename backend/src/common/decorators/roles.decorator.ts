import { SetMetadata } from '@nestjs/common';
import { Rol } from '@prisma/client';

export const CLAVE_ROLES = 'rolesRequeridos';

/**
 * Declara los roles autorizados para una ruta.
 *
 * OWASP A01 — Control de acceso declarativo y verificado de forma central por
 * RolesGuard, en lugar de comprobaciones dispersas en cada controlador.
 */
export const Roles = (...roles: Rol[]) => SetMetadata(CLAVE_ROLES, roles);
