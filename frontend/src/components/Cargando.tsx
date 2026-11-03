export function Cargando({ mensaje = 'Cargando' }: { mensaje?: string }) {
  return (
    <div
      className="flex items-center justify-center gap-3 px-6 py-16 text-grafito"
      role="status"
      aria-live="polite"
    >
      <span
        className="inline-block h-3 w-3 animate-pulse rounded-full bg-sello"
        aria-hidden="true"
      />
      <span className="text-sm">{mensaje}…</span>
    </div>
  );
}
