import type { ReactNode } from 'react';

export interface IProps {
  /** Открыта ли панель. */
  isOpen: boolean;
  /** Заголовок панели. */
  title: string;
  /** Есть ли несохранённые изменения: от этого зависят кнопка и вопрос при закрытии. */
  isDirty: boolean;
  /** Сохранение. Отказ оставляет панель открытой. */
  onSave: () => Promise<void>;
  /** Закрытие панели. */
  onClose: () => void;
  /** Поля формы. */
  children: ReactNode;
}
