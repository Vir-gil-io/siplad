import { useEffect, useRef, type ReactNode } from 'react';

/**
 * Diálogo modal.
 *
 * Se renderiza solo cuando está abierto, de modo deliberado: así cada
 * apertura monta una instancia nueva y el formulario que contiene arranca con
 * valores limpios, sin sincronizar estado desde las props en un efecto.
 *
 * Cierra con Escape, lleva el foco al abrirse y bloquea el desplazamiento del
 * fondo.
 */
export function Dialogo({
  titulo,
  onCerrar,
  children,
}: {
  titulo: string;
  onCerrar: () => void;
  children: ReactNode;
}) {
  const contenedor = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const alPresionar = (evento: KeyboardEvent) => {
      if (evento.key === 'Escape') onCerrar();
    };

    document.addEventListener('keydown', alPresionar);
    const desbordeOriginal = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    contenedor.current?.focus();

    return () => {
      document.removeEventListener('keydown', alPresionar);
      document.body.style.overflow = desbordeOriginal;
    };
  }, [onCerrar]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-tinta/40 px-4 py-8"
      onClick={onCerrar}
    >
      <div
        ref={contenedor}
        role="dialog"
        aria-modal="true"
        aria-label={titulo}
        tabIndex={-1}
        className="w-full max-w-xl border border-regla-fuerte bg-panel shadow-lg focus:outline-none"
        onClick={(evento) => evento.stopPropagation()}
      >
        <header className="flex items-center justify-between border-b-2 border-tinta px-5 py-3">
          <h2 className="font-titulo text-lg font-semibold text-tinta">{titulo}</h2>
          <button
            type="button"
            onClick={onCerrar}
            aria-label="Cerrar"
            className="rounded-[3px] px-2 py-1 text-xl leading-none text-grafito hover:text-tinta"
          >
            ×
          </button>
        </header>
        <div className="px-5 py-4">{children}</div>
      </div>
    </div>
  );
}
