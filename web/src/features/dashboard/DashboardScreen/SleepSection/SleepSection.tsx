import { ChartCard } from '@/components/ChartCard';
import { SleepChart } from '../../SleepChart';
import { SleepDurationChart } from '../../SleepDurationChart';
import { SleepTable } from '../tables';
import type { StatsSleep } from '../../hooks';

export interface IProps {
  sleep: StatsSleep[];
  isRefreshing: boolean;
}

/**
 * Сон — двумя графиками с общей осью дат.
 *
 * Время суток и длительность разведены нарочно: это разные шкалы, и вторая
 * ось на одном поле выдумала бы связь, которой в данных нет. Карточки стоят
 * рядом, и читаются они вместе.
 */
export function SleepSection({ sleep, isRefreshing }: IProps) {
  return (
    <>
      <ChartCard
        title="Когда лёг и когда встал"
        hint="ось считается от полудня, чтобы ночь шла непрерывно"
        isRefreshing={isRefreshing}
        table={<SleepTable sleep={sleep} />}
      >
        <SleepChart sleep={sleep} />
      </ChartCard>

      <ChartCard
        title="Сколько спал"
        hint="отдельным графиком: у часов своя шкала"
        isRefreshing={isRefreshing}
        table={<SleepTable sleep={sleep} />}
      >
        <SleepDurationChart sleep={sleep} />
      </ChartCard>
    </>
  );
}
