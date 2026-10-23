import type { StatsTracker } from '../../hooks';

/** Сколько серий показываем цветом. Хвост сворачивается в «Другое». */
export const MAX_SERIES = 4;

/** Подпись свёрнутого хвоста. */
export const OTHER_LABEL = 'Другое';

/** Точка графика: дата и часы по каждой серии. */
export interface IHoursPoint {
  date: string;
  [series: string]: string | number;
}

/** Серия: название и слот цвета. */
export interface ISeries {
  name: string;
  slot: number;
}

/**
 * Собирает накопительные столбики часов по трекерам.
 *
 * Серий не больше четырёх: девятый цвет не отличается от существующего при
 * дальтонизме, и решать «слишком много серий» новыми тонами нельзя. Хвост
 * сворачивается в «Другое» — трекеры с наименьшей суммой часов.
 *
 * Берутся только трекеры с часами: у трекера с одной галочкой часов нет, и
 * нулевая серия добавила бы в легенду пустое имя.
 *
 * Цвет закрепляется за трекером по месту в списке, а не по его текущей
 * величине: иначе смена отрезка перекрашивала бы выживших, и читатель,
 * запомнивший «чтение синее», был бы обманут.
 */
export function buildHoursSeries(trackers: readonly StatsTracker[]): {
  series: ISeries[];
  points: IHoursPoint[];
} {
  const withHours = trackers
    .filter((t) => t.mode === 'check_hours' && t.totalHours > 0)
    .sort((a, b) => b.totalHours - a.totalHours);

  if (withHours.length === 0) return { series: [], points: [] };

  const head = withHours.slice(0, MAX_SERIES);
  const tail = withHours.slice(MAX_SERIES);

  const series: ISeries[] = head.map((t, i) => ({ name: t.title, slot: i + 1 }));
  if (tail.length > 0) {
    series.push({ name: OTHER_LABEL, slot: Math.min(MAX_SERIES, head.length) + 1 });
  }

  const dates = withHours[0].days.map((d) => d.date);

  const points = dates.map((date, dayIndex) => {
    const point: IHoursPoint = { date };

    for (const t of head) {
      point[t.title] = t.days[dayIndex]?.hours ?? 0;
    }
    if (tail.length > 0) {
      point[OTHER_LABEL] = tail.reduce(
        (sum, t) => sum + (t.days[dayIndex]?.hours ?? 0),
        0,
      );
    }

    return point;
  });

  return { series, points };
}
