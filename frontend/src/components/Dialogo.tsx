import { useEffect, useId, useRef, type ReactNode } from 'react';

/**
 * Pila de diálogos abiertos.
 *
 * Un diálogo puede abrir otro encima —el visor de documentos se abre desde el
 * de dictamen, por ejemplo—. Sin llevar la cuenta, cada instancia escucharía
 * Escape por su lado y una sola pulsación cerraría toda la pila de golpe.
 * Registrando cuál está arriba, Escape cierra únicamente ese.
 */
const pila: string[] = [];

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
  subtitulo,
  onCerrar,
  ancho = 'normal',
  sinRelleno = false,
  children,
}: {
  titulo: string;
  /** Segunda línea del encabezado, para precisar qué se está viendo. */
  subtitulo?: string;
  onCerrar: () => void;
  /** 'amplio' para contenido que necesita espacio, como un documento. */
  ancho?: 'normal' | 'amplio';
  /** Suprime el relleno del cuerpo cuando el contenido llega hasta el borde. */
  sinRelleno?: boolean;
  children: ReactNode;
}) {
  const contenedor = useRef<HTMLDivElement>(null);
  const identificador = useId();

  useEffect(() => {
    pila.push(identificador);

    const alPresionar = (evento: KeyboardEvent) => {
      // Solo responde el diálogo que está arriba de la pila.
      if (evento.key === 'Escape' && pila[pila.length - 1] === identificador) {
        onCerrar();
      }
    };

    document.addEventListener('keydown', alPresionar);
    const desbordeOriginal = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    contenedor.current?.focus();

    return () => {
      document.removeEventListener('keydown', alPresionar);
      const posicion = pila.indexOf(identificador);
      if (posicion !== -1) pila.splice(posicion, 1);
      // El desplazamiento solo se devuelve cuando se cierra el último.
      if (pila.length === 0) document.body.style.overflow = desbordeOriginal;
    };
  }, [identificador, onCerrar]);

  return (
    <div
      className={[
        'fixed inset-0 flex items-start justify-center overflow-y-auto',
        'bg-tinta/50 px-4 py-8 backdrop-blur-[2px]',
        ancho === 'amplio' ? 'z-[60]' : 'z-50',
      ].join(' ')}
      onClick={onCerrar}
    >
      {/* La hoja del diálogo se levanta más que las de la página: sombra más
          abierta y desplazada, que es como se ve un papel sostenido sobre el
          escritorio y no apoyado en él. */}
      <div
        ref={contenedor}
        role="dialog"
        aria-modal="true"
        aria-label={subtitulo ? `${titulo}. ${subtitulo}` : titulo}
        tabIndex={-1}
        className={[
          'hoja hoja-alzada w-full focus:outline-none',
          ancho === 'amplio' ? 'max-w-5xl' : 'max-w-xl',
        ].join(' ')}
        onClick={(evento) => evento.stopPropagation()}
      >
        <header className="hoja-encabezado flex items-start justify-between gap-3 border-b-2 border-tinta px-5 py-3">
          <div className="min-w-0">
            <h2 className="font-titulo text-lg font-semibold text-tinta">{titulo}</h2>
            {subtitulo ? (
              <p className="mt-0.5 truncate text-sm text-grafito">{subtitulo}</p>
            ) : null}
          </div>
          <button
            type="button"
            onClick={onCerrar}
            aria-label="Cerrar"
            className="-mr-1 shrink-0 rounded-md px-2 py-0.5 text-xl leading-none text-grafito transition-colors hover:bg-papel hover:text-tinta"
          >
            ×
          </button>
        </header>
        <div className={sinRelleno ? '' : 'px-5 py-4'}>{children}</div>
      </div>
    </div>
  );
}
