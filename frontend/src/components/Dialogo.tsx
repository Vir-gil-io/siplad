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
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-tinta/50 px-4 py-8 backdrop-blur-[2px]"
      onClick={onCerrar}
    >
      {/* La hoja del diálogo se levanta más que las de la página: sombra más
          abierta y desplazada, que es como se ve un papel sostenido sobre el
          escritorio y no apoyado en él. */}
      <div
        ref={contenedor}
        role="dialog"
        aria-modal="true"
        aria-label={titulo}
        tabIndex={-1}
        className="hoja hoja-alzada w-full max-w-xl focus:outline-none"
        onClick={(evento) => evento.stopPropagation()}
      >
        <header className="hoja-encabezado flex items-center justify-between border-b-2 border-tinta px-5 py-3">
          <h2 className="font-titulo text-lg font-semibold text-tinta">{titulo}</h2>
          <button
            type="button"
            onClick={onCerrar}
            aria-label="Cerrar"
            className="-mr-1 rounded-md px-2 py-0.5 text-xl leading-none text-grafito transition-colors hover:bg-papel hover:text-tinta"
          >
            ×
          </button>
        </header>
        <div className="px-5 py-4">{children}</div>
      </div>
    </div>
  );
}
