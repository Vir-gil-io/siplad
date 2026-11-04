import type { ReactNode } from 'react';

/* ---------------------------------------------------------------------------
   El acta.

   Estructura tomada del acta académica: un bloque de encabezado con los datos
   del periodo, y debajo los renglones reglados. La regla separa registros, de
   modo que la línea es información y no adorno.

   El tratamiento de hoja —relieve, canto iluminado, esquina suave— vive en la
   clase `.hoja` de la hoja de estilos, para que el componente describa la
   estructura y no el acabado.
   --------------------------------------------------------------------------- */

export function Acta({
  titulo,
  referencia,
  acciones,
  children,
}: {
  titulo: string;
  referencia?: string;
  acciones?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="hoja aparece">
      <header className="hoja-encabezado flex flex-wrap items-end justify-between gap-3 px-4 py-3 sm:px-5">
        <div>
          <h2 className="font-titulo text-lg font-semibold text-tinta sm:text-xl">
            {titulo}
          </h2>
          {referencia ? (
            <p className="mt-0.5 text-sm text-grafito">{referencia}</p>
          ) : null}
        </div>
        {acciones ? <div className="flex flex-wrap gap-2">{acciones}</div> : null}
      </header>
      <div>{children}</div>
    </section>
  );
}

export function Renglon({
  children,
  interactivo = false,
}: {
  children: ReactNode;
  interactivo?: boolean;
}) {
  return (
    <div
      className={[
        'renglon px-4 py-3.5 sm:px-5',
        interactivo ? 'renglon-interactivo' : '',
      ].join(' ')}
    >
      {children}
    </div>
  );
}

/**
 * Cifra con su concepto.
 *
 * Se usa en la franja de indicadores. La cifra manda y el concepto va debajo
 * en texto normal, sin mayúsculas forzadas.
 */
export function Cifra({
  valor,
  concepto,
  unidad,
  tono = 'tinta',
}: {
  valor: number | string;
  concepto: string;
  unidad?: string;
  tono?: 'tinta' | 'sello' | 'lapiz';
}) {
  const colores = {
    tinta: 'text-tinta',
    sello: 'text-sello',
    lapiz: 'text-lapiz',
  };

  return (
    <div>
      <p className={`cifra font-titulo text-3xl font-semibold ${colores[tono]}`}>
        {valor}
        {unidad ? (
          <span className="ml-0.5 text-lg font-medium text-grafito">{unidad}</span>
        ) : null}
      </p>
      <p className="mt-0.5 text-sm text-grafito">{concepto}</p>
    </div>
  );
}
