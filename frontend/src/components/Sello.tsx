import type { EstadoAvance, EstadoEvidencia, EstadoPlaneacion } from '../types';

/**
 * El sello de estado.
 *
 * El estado de un registro se comunica como marca de tinta sobre el acta, no
 * como etiqueta de color: la tinta violeta aprueba, el lápiz rojo pide
 * ajustes y el grafito indica que aún no se ha resuelto.
 *
 * `estampado` activa la animación, y se pasa únicamente cuando el estado
 * acaba de cambiar por una acción del usuario.
 */

type Estado = EstadoPlaneacion | EstadoAvance | EstadoEvidencia;

const LEYENDAS: Record<Estado, { texto: string; color: string }> = {
  // Planeación
  ENVIADA: { texto: 'En revisión', color: 'text-grafito' },
  APROBADA: { texto: 'Aprobada', color: 'text-sello' },
  AJUSTES_SOLICITADOS: { texto: 'Ajustes solicitados', color: 'text-lapiz' },

  // Avance
  CUMPLIDO: { texto: 'Cumplido', color: 'text-sello' },
  PARCIAL: { texto: 'Parcial', color: 'text-grafito' },
  NO_CUMPLIDO: { texto: 'No cumplido', color: 'text-lapiz' },

  // Evidencia
  PENDIENTE: { texto: 'Pendiente', color: 'text-grafito' },
  VALIDADA: { texto: 'Validada', color: 'text-sello' },
  RECHAZADA: { texto: 'Rechazada', color: 'text-lapiz' },
};

export function Sello({
  estado,
  estampado = false,
}: {
  estado: Estado;
  estampado?: boolean;
}) {
  const leyenda = LEYENDAS[estado];

  return (
    <span
      className={['sello', leyenda.color, estampado ? 'sello-estampado' : ''].join(' ')}
    >
      {leyenda.texto}
    </span>
  );
}
