'use client';

import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import type { IProps } from './types';

/** Поля навыка: название, цель в поинтах, подпись единицы. */
export function SkillFields({ draft, isValid, onChange }: IProps) {
  return (
    <>
      <div className="flex flex-col gap-2">
        <Label htmlFor="skill-title">Название</Label>
        <Input
          id="skill-title"
          value={draft.title}
          onChange={(e) => onChange('title', e.target.value)}
          autoFocus
        />
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="skill-target">Цель в поинтах</Label>
        <Input
          id="skill-target"
          inputMode="decimal"
          value={draft.targetPoints}
          onChange={(e) => onChange('targetPoints', e.target.value)}
        />
        {!isValid && draft.targetPoints !== '' && (
          <span role="alert" className="text-xs text-destructive">
            Цель должна быть больше нуля
          </span>
        )}
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="skill-unit">Подпись единицы</Label>
        <Input
          id="skill-unit"
          placeholder="занятие"
          value={draft.unitLabel}
          onChange={(e) => onChange('unitLabel', e.target.value)}
        />
      </div>
    </>
  );
}
