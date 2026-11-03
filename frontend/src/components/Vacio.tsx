import type { ReactNode } from 'react';

/**
 * Estado vacío.
 *
 * Una pantalla sin registros es una invitación a actuar, no un aviso de
 * ausencia: dice qué falta y ofrece la acción que lo resuelve.
 */
export function Vacio({
  titulo,
  descripcion,
  accion,
}: {
  titulo: string;
  descripcion: string;
  accion?: ReactNode;
}) {
  return (
    <div className="px-6 py-14 text-center">
      <p className="font-titulo text-base font-semibold text-tinta">{titulo}</p>
      <p className="mx-auto mt-2 max-w-[52ch] text-sm text-grafito">{descripcion}</p>
      {accion ? <div className="mt-5">{accion}</div> : null}
    </div>
  );
}
