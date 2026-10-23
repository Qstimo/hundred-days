import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { HoursField } from './HoursField';

describe('HoursField', () => {
  it('подписано и показывает значение', () => {
    render(
      <HoursField value="1.5" isEditable onChange={vi.fn()} onCommit={vi.fn()} />,
    );

    expect(screen.getByLabelText('Часы')).toHaveValue(1.5);
  });

  it('отдаёт набранное как строку', async () => {
    const onChange = vi.fn();
    render(<HoursField value="" isEditable onChange={onChange} onCommit={vi.fn()} />);

    await userEvent.type(screen.getByLabelText('Часы'), '2');

    expect(onChange).toHaveBeenCalledWith('2');
  });

  it('записывает по уходу фокуса, а не по набору', async () => {
    const onCommit = vi.fn();
    render(<HoursField value="" isEditable onChange={vi.fn()} onCommit={onCommit} />);

    await userEvent.type(screen.getByLabelText('Часы'), '2');
    expect(onCommit).not.toHaveBeenCalled();

    await userEvent.tab();
    expect(onCommit).toHaveBeenCalled();
  });

  it('в недоступном дне выключено', () => {
    render(
      <HoursField value="" isEditable={false} onChange={vi.fn()} onCommit={vi.fn()} />,
    );

    expect(screen.getByLabelText('Часы')).toBeDisabled();
  });
});
