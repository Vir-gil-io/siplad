/**
 * Aviso de error o de confirmación.
 *
 * Explica qué pasó y qué hacer. No se disculpa ni usa lenguaje vago.
 */
export function Aviso({
  tipo = 'error',
  children,
}: {
  tipo?: 'error' | 'exito';
  children: React.ReactNode;
}) {
  const esError = tipo === 'error';

  return (
    <div
      role={esError ? 'alert' : 'status'}
      className={[
        'border-l-[3px] px-4 py-3 text-sm',
        esError
          ? 'border-lapiz bg-lapiz-claro text-lapiz'
          : 'border-sello bg-sello-claro text-sello',
      ].join(' ')}
    >
      {children}
    </div>
  );
}
