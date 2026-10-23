'use client';

import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { LabeledSelect } from '@/components/LabeledSelect';
import { MODE_OPTIONS, RULE_OPTIONS, WEEKLY_TARGETS } from '../constants';
import type { IProps } from './types';

/**
 * Поля трекера.
 *
 * Выбор правила «за час» показывается только у режима с часами: сочетание
 * «за час» без часов сервер отвергает, и предлагать его значило бы вести к
 * отказу. Сброс правила при смене режима делает trackerInputFromDraft.
 */
export function TrackerFields({ draft, skills, onChange }: IProps) {
  const wantsHours = draft.mode === 'check_hours';

  return (
    <>
      <div className="flex flex-col gap-2">
        <Label htmlFor="tracker-title">Название</Label>
        <Input
          id="tracker-title"
          value={draft.title}
          onChange={(e) => onChange('title', e.target.value)}
          autoFocus
        />
      </div>

      <LabeledSelect
        id="tracker-mode"
        label="Что отмечается"
        value={draft.mode}
        options={MODE_OPTIONS.map((o) => ({ value: o.value, label: o.label }))}
        onChange={(v) => onChange('mode', v as typeof draft.mode)}
      />

      <LabeledSelect
        id="tracker-rule"
        label="Поинты начисляются"
        value={draft.pointsRule}
        options={RULE_OPTIONS.filter((o) => wantsHours || o.value !== 'per_hour').map(
          (o) => ({ value: o.value, label: o.label }),
        )}
        onChange={(v) => onChange('pointsRule', v as typeof draft.pointsRule)}
      />

      <div className="flex flex-col gap-2">
        <Label htmlFor="tracker-value">Сколько поинтов</Label>
        <Input
          id="tracker-value"
          inputMode="decimal"
          value={draft.pointsValue}
          onChange={(e) => onChange('pointsValue', e.target.value)}
        />
      </div>

      <LabeledSelect
        id="tracker-skill"
        label="Навык"
        value={draft.skillId}
        options={[
          { value: '', label: 'Без навыка' },
          ...skills.map((s) => ({ value: s.id, label: s.title })),
        ]}
        onChange={(v) => onChange('skillId', v)}
      />

      <LabeledSelect
        id="tracker-target"
        label="Раз в неделю"
        value={draft.weeklyTarget}
        options={WEEKLY_TARGETS.map((v) => ({ value: v, label: String(v) }))}
        onChange={(v) => onChange('weeklyTarget', v)}
      />
    </>
  );
}
