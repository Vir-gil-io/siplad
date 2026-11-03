import type {
  ButtonHTMLAttributes,
  InputHTMLAttributes,
  ReactNode,
  SelectHTMLAttributes,
  TextareaHTMLAttributes,
} from 'react';

/* ---------------------------------------------------------------------------
   Controles de formulario.

   Los contenedores de registro tienen esquina cuadrada, como un acta; lo
   interactivo lleva radio. Es una distinción deliberada: lo que se puede
   pulsar se reconoce por la forma.
   --------------------------------------------------------------------------- */

type Variante = 'solida' | 'contorno' | 'texto' | 'peligro';

const VARIANTES: Record<Variante, string> = {
  solida: 'bg-sello text-white hover:bg-[#4a2f78] disabled:bg-grafito',
  contorno:
    'border border-regla-fuerte bg-panel text-tinta hover:border-sello hover:text-sello',
  texto: 'text-sello hover:underline',
  peligro: 'border border-lapiz bg-panel text-lapiz hover:bg-lapiz-claro',
};

export function Boton({
  variante = 'solida',
  children,
  className = '',
  ...resto
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variante?: Variante;
  children: ReactNode;
}) {
  const base =
    variante === 'texto'
      ? 'font-texto text-sm font-medium disabled:opacity-50'
      : 'rounded-[3px] px-3.5 py-2 font-texto text-sm font-medium transition-colors disabled:cursor-not-allowed';

  return (
    <button className={[base, VARIANTES[variante], className].join(' ')} {...resto}>
      {children}
    </button>
  );
}

function Etiqueta({
  htmlFor,
  children,
  requerido,
}: {
  htmlFor: string;
  children: ReactNode;
  requerido?: boolean;
}) {
  return (
    <label htmlFor={htmlFor} className="mb-1.5 block text-sm font-medium text-tinta">
      {children}
      {requerido ? <span className="ml-0.5 text-lapiz">*</span> : null}
    </label>
  );
}

const ENTRADA =
  'w-full rounded-[3px] border border-regla-fuerte bg-panel px-3 py-2 text-sm ' +
  'placeholder:text-grafito focus:border-sello focus:outline-none';

export function Campo({
  id,
  etiqueta,
  ayuda,
  requerido,
  ...resto
}: InputHTMLAttributes<HTMLInputElement> & {
  id: string;
  etiqueta: string;
  ayuda?: string;
  requerido?: boolean;
}) {
  return (
    <div>
      <Etiqueta htmlFor={id} requerido={requerido}>
        {etiqueta}
      </Etiqueta>
      <input
        id={id}
        className={ENTRADA}
        aria-describedby={ayuda ? `${id}-ayuda` : undefined}
        {...resto}
      />
      {ayuda ? (
        <p id={`${id}-ayuda`} className="mt-1 text-xs text-grafito">
          {ayuda}
        </p>
      ) : null}
    </div>
  );
}

export function AreaTexto({
  id,
  etiqueta,
  ayuda,
  requerido,
  ...resto
}: TextareaHTMLAttributes<HTMLTextAreaElement> & {
  id: string;
  etiqueta: string;
  ayuda?: string;
  requerido?: boolean;
}) {
  return (
    <div>
      <Etiqueta htmlFor={id} requerido={requerido}>
        {etiqueta}
      </Etiqueta>
      <textarea
        id={id}
        className={`${ENTRADA} min-h-28 resize-y leading-relaxed`}
        aria-describedby={ayuda ? `${id}-ayuda` : undefined}
        {...resto}
      />
      {ayuda ? (
        <p id={`${id}-ayuda`} className="mt-1 text-xs text-grafito">
          {ayuda}
        </p>
      ) : null}
    </div>
  );
}

export function Selector({
  id,
  etiqueta,
  requerido,
  children,
  ...resto
}: SelectHTMLAttributes<HTMLSelectElement> & {
  id: string;
  etiqueta: string;
  requerido?: boolean;
  children: ReactNode;
}) {
  return (
    <div>
      <Etiqueta htmlFor={id} requerido={requerido}>
        {etiqueta}
      </Etiqueta>
      <select id={id} className={ENTRADA} {...resto}>
        {children}
      </select>
    </div>
  );
}
