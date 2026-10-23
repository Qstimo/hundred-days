import { CELL, GAP } from '../constants';
import { cellShade } from '../utils';

/**
 * Шкала теплокарты: от «ничего» к «много».
 *
 * У секвенциальной шкалы легенда обязательна: без неё насыщенность клетки
 * ни о чём не говорит.
 */
export function HeatLegend() {
  return (
    <p className="mt-2 flex items-center gap-2 text-xs text-muted-foreground">
      <span>меньше</span>
      {[0, 1, 2, 3, 4].map((i) => (
        <span
          key={i}
          aria-hidden="true"
          style={{
            width: CELL,
            height: CELL,
            borderRadius: 2,
            marginRight: GAP,
            background: cellShade(i === 0 ? 0 : i, 4),
          }}
        />
      ))}
      <span>больше</span>
    </p>
  );
}
