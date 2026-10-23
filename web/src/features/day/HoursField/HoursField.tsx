'use client';

import { useId } from 'react';
import { Input } from '@/components/ui/input';
import type { IProps } from './types';

/**
 * Поле часов у трекера.
 *
 * Значение хранится строкой: в процессе набора «1.» числом не является, и
 * приведение к числу на каждом нажатии стирало бы точку.
 */
export function HoursField({ value, isEditable, onChange, onCommit }: IProps) {
  const id = useId();

  return (
    <div className="flex items-center gap-2">
      <label htmlFor={id} className="text-xs text-muted-foreground">
        Часы
      </label>
      <Input
        id={id}
        type="number"
        inputMode="decimal"
        step="0.25"
        min="0"
        max="24"
        value={value}
        disabled={!isEditable}
        onChange={(e) => onChange(e.target.value)}
        onBlur={onCommit}
        className="w-20"
      />
    </div>
  );
}
