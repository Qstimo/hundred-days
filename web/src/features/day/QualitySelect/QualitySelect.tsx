'use client';

import { useId } from 'react';
import { EMPTY_LABEL, QUALITY_OPTIONS } from './constants';
import type { IProps } from './types';

/**
 * Оценка сна от одного до пяти.
 *
 * Обычный `select`, а не компонент из shadcn: тот рисует список своим
 * слоем, и на телефоне теряется родная прокрутка выбора. Пять коротких
 * значений — ровно тот случай, когда браузерный элемент лучше.
 */
export function QualitySelect({ value, onChange }: IProps) {
  const id = useId();

  return (
    <div className="flex flex-col gap-2">
      <label htmlFor={id} className="text-sm font-medium">
        Качество сна
      </label>
      <select
        id={id}
        value={value ?? ''}
        onChange={(e) => onChange(e.target.value === '' ? null : Number(e.target.value))}
        className="h-9 rounded-md border bg-transparent px-3 text-sm"
      >
        <option value="">{EMPTY_LABEL}</option>
        {QUALITY_OPTIONS.map((v) => (
          <option key={v} value={v}>
            {v}
          </option>
        ))}
      </select>
    </div>
  );
}
