import { useState } from 'react';

import { Boton } from './Controles';
import { Dialogo } from './Dialogo';

/* ---------------------------------------------------------------------------
   Visor de documentos.

   El documento se muestra sin sacar a la persona de la pantalla en la que
   está. Importa sobre todo en la bandeja de coordinación: dictaminar exige
   leer el documento y volver al formulario, y abrirlo en otra pestaña rompe
   esa secuencia.

   El encabezado nombra siempre qué se está viendo, porque una vez abierto el
   visor el contexto de la fila que lo originó queda tapado.
   --------------------------------------------------------------------------- */

type Clase = 'pdf' | 'imagen' | 'descargable';

/**
 * Deduce cómo mostrar el archivo a partir de su extensión.
 *
 * Se usa la extensión y no el tipo declarado por el servidor porque la
 * dirección es lo único que viaja con el registro; el navegador resolverá el
 * tipo real al pedirla.
 */
function clasificar(url: string): Clase {
  const limpia = url.split('?')[0].toLowerCase();
  if (limpia.endsWith('.pdf')) return 'pdf';
  if (/\.(jpe?g|png|gif|webp)$/.test(limpia)) return 'imagen';
  return 'descargable';
}

/** Nombre del archivo tal como viaja en la dirección. */
function nombreDelArchivo(url: string): string {
  const limpia = url.split('?')[0];
  return decodeURIComponent(limpia.slice(limpia.lastIndexOf('/') + 1)) || 'documento';
}

export function VisorDocumento({
  url,
  titulo,
  subtitulo,
  onCerrar,
}: {
  url: string;
  /** Qué documento es: «Documento de la planeación», «Constancia»… */
  titulo: string;
  /** A qué registro pertenece: materia, parcial, docente. */
  subtitulo?: string;
  onCerrar: () => void;
}) {
  const clase = clasificar(url);
  const [fallo, establecerFallo] = useState(false);

  return (
    <Dialogo
      titulo={titulo}
      subtitulo={subtitulo}
      onCerrar={onCerrar}
      ancho="amplio"
      sinRelleno
    >
      <div className="bg-papel px-5 py-4">
        {clase === 'descargable' ? (
          <Aviso
            texto="Este formato no puede mostrarse dentro del navegador. Descárgalo para abrirlo con el programa que corresponda."
            nombre={nombreDelArchivo(url)}
          />
        ) : fallo ? (
          <Aviso
            texto="El documento no pudo mostrarse aquí. Puede deberse a que el proveedor de almacenamiento no permite incrustarlo; ábrelo en una pestaña nueva."
            nombre={nombreDelArchivo(url)}
          />
        ) : clase === 'imagen' ? (
          <div className="recuadro flex max-h-[70vh] items-center justify-center overflow-auto p-3">
            <img
              src={url}
              alt={subtitulo ? `${titulo}. ${subtitulo}` : titulo}
              className="max-h-full max-w-full object-contain"
              onError={() => establecerFallo(true)}
            />
          </div>
        ) : (
          /* La altura se fija en unidades de ventana para que el documento
             ocupe lo que la pantalla permita sin desbordar el diálogo. */
          <iframe
            src={url}
            title={subtitulo ? `${titulo}. ${subtitulo}` : titulo}
            className="recuadro h-[70vh] w-full bg-panel"
            onError={() => establecerFallo(true)}
          />
        )}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-regla px-5 py-3">
        <p className="cifra truncate text-xs text-grafito">{nombreDelArchivo(url)}</p>
        <div className="flex gap-2">
          <a
            href={url}
            target="_blank"
            rel="noreferrer"
            className="rounded-md border border-regla-fuerte bg-panel px-3.5 py-2 font-texto text-sm font-medium text-tinta shadow-[0_1px_1px_rgba(35,38,59,.06)] transition-all duration-100 hover:border-sello hover:text-sello active:translate-y-px"
          >
            Abrir en pestaña nueva
          </a>
          <Boton type="button" onClick={onCerrar}>
            Cerrar
          </Boton>
        </div>
      </div>
    </Dialogo>
  );
}

/** Panel para los casos en que el documento no se puede mostrar incrustado. */
function Aviso({ texto, nombre }: { texto: string; nombre: string }) {
  return (
    <div className="recuadro flex flex-col items-center gap-3 px-6 py-12 text-center">
      <span aria-hidden="true" className="text-4xl">
        📄
      </span>
      <p className="cifra text-sm font-medium text-tinta">{nombre}</p>
      <p className="max-w-md text-sm text-grafito">{texto}</p>
    </div>
  );
}
