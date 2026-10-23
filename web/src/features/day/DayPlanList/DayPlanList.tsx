'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { DayPlanItem } from '../DayPlanItem';
import { DayPlanDrawer } from '../DayPlanDrawer';
import { useMutationDayPlan } from '../hooks';
import type { DayPlan } from '../hooks';
import type { IProps } from './types';

/**
 * Планы на день: добавление, закрытие, перенос со вчера.
 *
 * Добавление и закрытие — прямо в списке, одним нажатием. Правка текста и
 * удаление — в выезжающей панели: это уже не одно нажатие.
 *
 * Кнопка переноса показывается только когда переносить есть что: постоянная
 * кнопка, которая обычно ничего не делает, учит её не замечать.
 */
export function DayPlanList({ plans, date, carryOverAvailable }: IProps) {
  const mutation = useMutationDayPlan(date);
  const [newTitle, setNewTitle] = useState('');
  const [editing, setEditing] = useState<DayPlan | null>(null);

  function handleAdd() {
    const title = newTitle.trim();
    if (title === '') return;

    mutation.create.mutate(title);
    setNewTitle('');
  }

  return (
    <section className="flex flex-col gap-2">
      <div className="flex items-center justify-between gap-4">
        <h2 className="text-lg font-semibold">Планы на день</h2>

        {carryOverAvailable && (
          <Button variant="outline" size="sm" onClick={() => mutation.carryOver.mutate()}>
            Подтянуть незакрытые со вчера
          </Button>
        )}
      </div>

      {plans.length === 0 ? (
        <p className="text-sm text-muted-foreground">Планов на этот день нет</p>
      ) : (
        <ul className="divide-y">
          {plans.map((plan) => (
            <DayPlanItem
              key={plan.id}
              plan={plan}
              onToggle={(done) => mutation.patch.mutate({ id: plan.id, done })}
              onEdit={() => setEditing(plan)}
            />
          ))}
        </ul>
      )}

      {/* Кнопка рядом с полем, а не только Enter: по одному полю ввода не
          видно, что оно вообще что-то добавляет, и человек набирает текст,
          уходит и считает, что пункт не добавился. */}
      <div className="flex gap-2">
        <Input
          aria-label="Новый пункт"
          placeholder="Что сделать сегодня"
          value={newTitle}
          onChange={(e) => setNewTitle(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') handleAdd();
          }}
        />
        <Button onClick={handleAdd} disabled={newTitle.trim() === ''}>
          Добавить
        </Button>
      </div>

      <DayPlanDrawer
        plan={editing}
        onSave={async (title) => {
          await mutation.patch.mutateAsync({ id: editing!.id, title });
          setEditing(null);
        }}
        onDelete={async () => {
          await mutation.remove.mutateAsync(editing!.id);
          setEditing(null);
        }}
        onClose={() => setEditing(null)}
      />
    </section>
  );
}
