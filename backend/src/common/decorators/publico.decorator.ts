import { SetMetadata } from '@nestjs/common';

export const CLAVE_PUBLICO = 'esPublico';

/**
 * Marca una ruta como accesible sin token.
 *
 * Patron estructural aplicado: Decorator. El metadato se adjunta al manejador
 * sin modificar su implementacion, y la cadena de guards lo consulta.
 */
export const Publico = () => SetMetadata(CLAVE_PUBLICO, true);
