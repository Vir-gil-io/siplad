import type {
  ButtonHTMLAttributes,
  InputHTMLAttributes,
  ReactNode,
  SelectHTMLAttributes,
  TextareaHTMLAttributes,
} from 'react';

import { tamanoLegible } from '../utils/validacion';

/* ---------------------------------------------------------------------------
   Controles de formulario.

   Los contenedores de registro tienen esquina suave, como una hoja; lo
   interactivo lleva radio y relieve. Es una distinción deliberada: lo que se
   puede pulsar se reconoce por la forma antes que por el color.
   --------------------------------------------------------------------------- */

type Variante = 'solida' | 'contorno' | 'texto' | 'peligro';

const VARIANTES: Record<Variante, string> = {
  solida:
    'bg-sello text-white shadow-[0_1px_2px_rgba(35,38,59,.28),inset_0_1px_0_rgba(255,255,255,.16)] ' +
    'hover:bg-[#4a2f78] active:translate-y-px disabled:bg-grafito disabled:shadow-none',
  contorno:
    'border border-regla-fuerte bg-panel text-tinta shadow-[0_1px_1px_rgba(35,38,59,.06)] ' +
    'hover:border-sello hover:text-sello active:translate-y-px',
  texto: 'text-sello hover:underline underline-offset-2',
  peligro:
    'border border-lapiz bg-panel text-lapiz shadow-[0_1px_1px_rgba(35,38,59,.06)] ' +
    'hover:bg-lapiz-claro active:translate-y-px',
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
      : 'rounded-md px-3.5 py-2 font-texto text-sm font-medium transition-all duration-100 disabled:cursor-not-allowed';

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
  oculta = false,
}: {
  htmlFor: string;
  children: ReactNode;
  requerido?: boolean;
  /** La etiqueta sigue existiendo para los lectores de pantalla, sin ocupar espacio. */
  oculta?: boolean;
}) {
  return (
    <label
      htmlFor={htmlFor}
      className={oculta ? 'sr-only' : 'mb-1.5 block text-sm font-medium text-tinta'}
    >
      {children}
      {requerido ? (
        <span className="ml-0.5 text-lapiz" aria-label="obligatorio">
          *
        </span>
      ) : null}
    </label>
  );
}

/** Mensaje de error de un campo, anunciado a los lectores de pantalla. */
function MensajeError({ id, texto }: { id: string; texto: string }) {
  return (
    <p id={id} role="alert" className="mt-1 flex items-start gap-1 text-xs text-lapiz">
      <span aria-hidden="true" className="mt-px font-semibold">
        !
      </span>
      {texto}
    </p>
  );
}

const ENTRADA_BASE =
  'w-full rounded-md border bg-panel px-3 py-2 text-sm transition-colors ' +
  'shadow-[inset_0_1px_2px_rgba(35,38,59,.05)] placeholder:text-grafito focus:outline-none';

const ENTRADA_NORMAL =
  'border-regla-fuerte focus:border-sello focus:ring-2 focus:ring-sello/20';
const ENTRADA_ERROR =
  'border-lapiz bg-lapiz-claro/40 focus:border-lapiz focus:ring-2 focus:ring-lapiz/20';

function clasesEntrada(error?: string) {
  return [ENTRADA_BASE, error ? ENTRADA_ERROR : ENTRADA_NORMAL].join(' ');
}

/** Reúne los identificadores de los textos que describen al campo. */
function descritoPor(id: string, ayuda?: string, error?: string) {
  const ids = [ayuda ? `${id}-ayuda` : null, error ? `${id}-error` : null].filter(
    Boolean,
  );
  return ids.length ? ids.join(' ') : undefined;
}

export function Campo({
  id,
  etiqueta,
  ayuda,
  error,
  requerido,
  ...resto
}: InputHTMLAttributes<HTMLInputElement> & {
  id: string;
  etiqueta: string;
  ayuda?: string;
  error?: string;
  requerido?: boolean;
}) {
  return (
    <div>
      <Etiqueta htmlFor={id} requerido={requerido}>
        {etiqueta}
      </Etiqueta>
      <input
        id={id}
        className={clasesEntrada(error)}
        aria-invalid={error ? true : undefined}
        aria-describedby={descritoPor(id, ayuda, error)}
        {...resto}
      />
      {ayuda && !error ? (
        <p id={`${id}-ayuda`} className="mt-1 text-xs text-grafito">
          {ayuda}
        </p>
      ) : null}
      {error ? <MensajeError id={`${id}-error`} texto={error} /> : null}
    </div>
  );
}

export function AreaTexto({
  id,
  etiqueta,
  ayuda,
  error,
  requerido,
  maximo,
  value,
  ...resto
}: TextareaHTMLAttributes<HTMLTextAreaElement> & {
  id: string;
  etiqueta: string;
  ayuda?: string;
  error?: string;
  requerido?: boolean;
  /** Cuando se indica, se muestra el conteo de caracteres restantes. */
  maximo?: number;
}) {
  const usados = typeof value === 'string' ? value.trim().length : 0;
  const cerca = maximo !== undefined && usados > maximo * 0.9;

  return (
    <div>
      <div className="flex items-end justify-between">
        <Etiqueta htmlFor={id} requerido={requerido}>
          {etiqueta}
        </Etiqueta>
        {maximo !== undefined ? (
          <span
            className={`mb-1.5 cifra text-xs ${cerca ? 'font-medium text-lapiz' : 'text-grafito'}`}
            aria-live="polite"
          >
            {usados} / {maximo}
          </span>
        ) : null}
      </div>
      <textarea
        id={id}
        value={value}
        className={`${clasesEntrada(error)} min-h-28 resize-y leading-relaxed`}
        aria-invalid={error ? true : undefined}
        aria-describedby={descritoPor(id, ayuda, error)}
        {...resto}
      />
      {ayuda && !error ? (
        <p id={`${id}-ayuda`} className="mt-1 text-xs text-grafito">
          {ayuda}
        </p>
      ) : null}
      {error ? <MensajeError id={`${id}-error`} texto={error} /> : null}
    </div>
  );
}

export function Selector({
  id,
  etiqueta,
  etiquetaOculta = false,
  error,
  requerido,
  children,
  ...resto
}: SelectHTMLAttributes<HTMLSelectElement> & {
  id: string;
  etiqueta: string;
  /** Para filtros, donde el valor elegido ya dice lo que el control hace. */
  etiquetaOculta?: boolean;
  error?: string;
  requerido?: boolean;
  children: ReactNode;
}) {
  return (
    <div>
      <Etiqueta htmlFor={id} requerido={requerido} oculta={etiquetaOculta}>
        {etiqueta}
      </Etiqueta>
      <select
        id={id}
        className={clasesEntrada(error)}
        aria-invalid={error ? true : undefined}
        aria-describedby={descritoPor(id, undefined, error)}
        {...resto}
      >
        {children}
      </select>
      {error ? <MensajeError id={`${id}-error`} texto={error} /> : null}
    </div>
  );
}

/**
 * Selector de archivo.
 *
 * Muestra el nombre y el peso de lo elegido, porque el control nativo deja al
 * usuario adivinando si su archivo se adjuntó de verdad.
 */
export function CampoArchivo({
  id,
  etiqueta,
  ayuda,
  error,
  requerido,
  archivo,
  onArchivo,
  accept,
}: {
  id: string;
  etiqueta: string;
  ayuda?: string;
  error?: string;
  requerido?: boolean;
  archivo: File | null;
  onArchivo: (archivo: File | null) => void;
  accept: string;
}) {
  return (
    <div>
      <Etiqueta htmlFor={id} requerido={requerido}>
        {etiqueta}
      </Etiqueta>

      <input
        id={id}
        type="file"
        accept={accept}
        onChange={(e) => onArchivo(e.target.files?.[0] ?? null)}
        aria-invalid={error ? true : undefined}
        aria-describedby={descritoPor(id, ayuda, error)}
        className={
          `${clasesEntrada(error)} cursor-pointer file:mr-3 file:cursor-pointer file:rounded ` +
          'file:border-0 file:bg-sello-claro file:px-3 file:py-1.5 file:text-sm ' +
          'file:font-medium file:text-sello hover:file:bg-[#e2d8f2]'
        }
      />

      {archivo ? (
        <p className="mt-1.5 flex items-center gap-2 text-xs text-sello">
          <span aria-hidden="true">✓</span>
          <span className="truncate font-medium">{archivo.name}</span>
          <span className="cifra shrink-0 text-grafito">
            {tamanoLegible(archivo.size)}
          </span>
          <button
            type="button"
            onClick={() => onArchivo(null)}
            className="shrink-0 text-grafito underline underline-offset-2 hover:text-lapiz"
          >
            quitar
          </button>
        </p>
      ) : null}

      {ayuda && !error ? (
        <p id={`${id}-ayuda`} className="mt-1 text-xs text-grafito">
          {ayuda}
        </p>
      ) : null}
      {error ? <MensajeError id={`${id}-error`} texto={error} /> : null}
    </div>
  );
}

/**
 * Disparador del visor de documentos.
 *
 * Es un boton y no un enlace a proposito: el documento se abre en un visor
 * dentro de la misma pantalla, no en otra pestana. Mantener la apariencia de
 * enlace confundiria sobre lo que va a ocurrir al pulsarlo.
 */
export function BotonDocumento({
  onVer,
  etiqueta = 'Ver documento adjunto',
}: {
  onVer: () => void;
  etiqueta?: string;
}) {
  return (
    <button
      type="button"
      onClick={onVer}
      className="inline-flex items-center gap-1.5 rounded border border-regla bg-papel px-2.5 py-1 text-sm font-medium text-sello shadow-[0_1px_1px_rgba(35,38,59,.05)] transition-all duration-100 hover:border-sello hover:bg-sello-claro active:translate-y-px"
    >
      <span aria-hidden="true">📄</span>
      {etiqueta}
    </button>
  );
}
