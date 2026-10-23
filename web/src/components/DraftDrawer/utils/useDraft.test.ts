import { describe, expect, it } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { useDraft } from './useDraft';

interface IForm {
  title: string;
  weeklyTarget: number;
}

const initial: IForm = { title: 'Занятие', weeklyTarget: 3 };

describe('useDraft', () => {
  it('начинается без изменений', () => {
    const { result } = renderHook(() => useDraft(initial));

    expect(result.current.draft).toEqual(initial);
    expect(result.current.isDirty).toBe(false);
  });

  it('помечает черновик изменённым', () => {
    const { result } = renderHook(() => useDraft(initial));

    act(() => result.current.setField('title', 'Чтение'));

    expect(result.current.draft.title).toBe('Чтение');
    expect(result.current.isDirty).toBe(true);
  });

  it('возврат к исходному значению снимает отметку изменения', () => {
    const { result } = renderHook(() => useDraft(initial));

    act(() => result.current.setField('title', 'Чтение'));
    act(() => result.current.setField('title', 'Занятие'));

    expect(result.current.isDirty).toBe(false);
  });

  it('сброс возвращает исходное', () => {
    const { result } = renderHook(() => useDraft(initial));

    act(() => result.current.setField('weeklyTarget', 7));
    act(() => result.current.reset());

    expect(result.current.draft).toEqual(initial);
    expect(result.current.isDirty).toBe(false);
  });

  it('правит несколько полей подряд', () => {
    const { result } = renderHook(() => useDraft(initial));

    act(() => result.current.setField('title', 'Чтение'));
    act(() => result.current.setField('weeklyTarget', 5));

    expect(result.current.draft).toEqual({ title: 'Чтение', weeklyTarget: 5 });
    expect(result.current.isDirty).toBe(true);
  });

  it('setDraft заменяет черновик целиком', () => {
    const { result } = renderHook(() => useDraft(initial));

    act(() => result.current.setDraft({ title: 'Фильм', weeklyTarget: 1 }));

    expect(result.current.draft).toEqual({ title: 'Фильм', weeklyTarget: 1 });
    expect(result.current.isDirty).toBe(true);
  });

  it('смена исходных данных подхватывается, пока черновик чист', () => {
    const { result, rerender } = renderHook(({ v }) => useDraft(v), {
      initialProps: { v: initial },
    });

    rerender({ v: { title: 'Другое', weeklyTarget: 5 } });

    expect(result.current.draft.title).toBe('Другое');
    expect(result.current.isDirty).toBe(false);
  });

  // Главный случай: ответ сервера, пришедший во время набора текста, не
  // должен стирать набранное. Это ровно то, за что ругают формы, живущие
  // прямо на данных запроса.
  it('смена исходных данных не затирает начатую правку', () => {
    const { result, rerender } = renderHook(({ v }) => useDraft(v), {
      initialProps: { v: initial },
    });

    act(() => result.current.setField('title', 'Моя правка'));
    rerender({ v: { title: 'Пришло с сервера', weeklyTarget: 5 } });

    expect(result.current.draft.title).toBe('Моя правка');
    expect(result.current.isDirty).toBe(true);
  });

  // После сохранения форма становится чистой, и тогда свежие данные с
  // сервера должны подхватиться — иначе панель показывала бы старое.
  it('после сброса подхватывает данные, пришедшие во время правки', () => {
    const { result, rerender } = renderHook(({ v }) => useDraft(v), {
      initialProps: { v: initial },
    });

    act(() => result.current.setField('title', 'Моя правка'));
    rerender({ v: { title: 'Пришло с сервера', weeklyTarget: 5 } });
    act(() => result.current.reset());
    rerender({ v: { title: 'Пришло с сервера', weeklyTarget: 5 } });

    expect(result.current.draft.title).toBe('Пришло с сервера');
    expect(result.current.isDirty).toBe(false);
  });
});
