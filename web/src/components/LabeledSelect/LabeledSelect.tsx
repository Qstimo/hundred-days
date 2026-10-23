'use client';

import { Label } from '@/components/ui/label';
import type { IProps } from './types';

/**
 * Подписанный выбор из списка.
 *
 * Обычный `select`, а не компонент из shadcn: тот рисует список своим слоем
 * и на телефоне теряет родную прокрутку выбора. Здесь выбирают из коротких
 * списков, и браузерный элемент лучше.
 *
 * Собран в один компонент, потому что повторялся в панели трекера четыре
 * раза подряд — ровно тот случай, когда третье повторение пора вынести.
 */
export function LabeledSelect({ id, label, value, options, onChange }: IProps) {
  return (
    <div className="flex flex-col gap-2">
      <Label htmlFor={id}>{label}</Label>
      <select
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="h-9 rounded-md border bg-transparent px-3 text-sm"
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </div>
  );
}
