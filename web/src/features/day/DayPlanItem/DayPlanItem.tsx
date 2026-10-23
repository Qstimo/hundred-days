'use client';

import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import type { IProps } from './types';

/**
 * Пункт плана на день.
 *
 * Галочка пишется сразу — одно нажатие. Текст правится в выезжающей панели:
 * это уже не одно нажатие, и правило дизайна применяется.
 */
export function DayPlanItem({ plan, onToggle, onEdit }: IProps) {
  return (
    <li className="flex items-center gap-3 py-2">
      <Checkbox
        checked={plan.done}
        onCheckedChange={() => onToggle(!plan.done)}
        aria-label={plan.title}
      />

      <span className={plan.done ? 'flex-1 line-through text-muted-foreground' : 'flex-1'}>
        {plan.title}
      </span>

      {plan.carriedFromId != null && (
        <span className="rounded bg-muted px-2 py-0.5 text-xs text-muted-foreground">
          со вчера
        </span>
      )}

      <Button variant="ghost" size="sm" onClick={onEdit} aria-label="Правка пункта">
        Правка
      </Button>
    </li>
  );
}
