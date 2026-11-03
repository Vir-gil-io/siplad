import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { Rol } from '@prisma/client';

export interface UsuarioAutenticado {
  id: string;
  email: string;
  nombre: string;
  rol: Rol;
}

/**
 * Inyecta el usuario autenticado en el parametro de un manejador.
 *
 * Evita que los controladores lean el objeto de la peticion directamente, lo
 * que mantiene la capa de presentacion desacoplada del transporte HTTP.
 */
/** Forma de la peticion una vez que Passport adjunto el usuario validado. */
export interface PeticionAutenticada {
  user?: UsuarioAutenticado;
}

export const UsuarioActual = createParamDecorator(
  (dato: keyof UsuarioAutenticado | undefined, ctx: ExecutionContext) => {
    const peticion = ctx.switchToHttp().getRequest<PeticionAutenticada>();
    const usuario = peticion.user;
    return dato ? usuario?.[dato] : usuario;
  },
);
