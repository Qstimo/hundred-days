import { useCallback, useEffect, useRef, useState } from 'react';

/** Состояние черновика формы. */
export interface IDraftState<T> {
  /** Текущие значения полей. */
  draft: T;
  /** Есть ли несохранённые изменения. */
  isDirty: boolean;
  /** Правка одного поля. */
  setField: <K extends keyof T>(key: K, value: T[K]) => void;
  /** Замена черновика целиком. */
  setDraft: (value: T) => void;
  /** Возврат к исходным данным. */
  reset: () => void;
}

/**
 * Собирает поля формы в черновик, который уходит одной кнопкой «Сохранить».
 *
 * Пришедшие с сервера данные подхватываются только в чистый черновик:
 * начатую правку обновление затирать не должно, иначе набранный текст
 * исчезал бы от чужого перезапроса — ровно то, за что ругают формы, живущие
 * прямо на данных запроса.
 *
 * Отметка изменения считается сравнением с исходными данными, а не
 * выставляется флагом: возврат значения к прежнему должен снимать её, иначе
 * «Сохранить» оставалась бы доступной после отмены правки руками.
 */
export function useDraft<T extends object>(initial: T): IDraftState<T> {
  const [draft, setDraftState] = useState<T>(initial);
  const [isDirty, setIsDirty] = useState(false);
  const baseline = useRef(initial);

  useEffect(() => {
    if (isDirty) return;
    baseline.current = initial;
    setDraftState(initial);
  }, [initial, isDirty]);

  const apply = useCallback((next: T) => {
    setDraftState(next);
    setIsDirty(!shallowEqual(next, baseline.current));
  }, []);

  const setField = useCallback(
    <K extends keyof T>(key: K, value: T[K]) => {
      apply({ ...draft, [key]: value });
    },
    [apply, draft],
  );

  const reset = useCallback(() => {
    setDraftState(baseline.current);
    setIsDirty(false);
  }, []);

  return { draft, isDirty, setField, setDraft: apply, reset };
}

/**
 * Поверхностное сравнение. Глубокого не нужно: в черновике лежат поля формы
 * — строки, числа и флаги, — а вложенный объект был бы признаком того, что
 * форма делает слишком много.
 */
function shallowEqual<T extends object>(a: T, b: T): boolean {
  const keys = new Set([...Object.keys(a), ...Object.keys(b)]);

  for (const key of keys) {
    if (a[key as keyof T] !== b[key as keyof T]) return false;
  }
  return true;
}
