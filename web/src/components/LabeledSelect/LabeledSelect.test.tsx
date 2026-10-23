import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { LabeledSelect } from './LabeledSelect';

const options = [
  { value: 'a', label: 'Первый' },
  { value: 'b', label: 'Второй' },
];

describe('LabeledSelect', () => {
  it('подпись связана с полем', () => {
    render(
      <LabeledSelect
        id="x"
        label="Выбор"
        value="a"
        options={options}
        onChange={vi.fn()}
      />,
    );

    expect(screen.getByLabelText('Выбор')).toHaveValue('a');
  });

  it('показывает все варианты', () => {
    render(
      <LabeledSelect
        id="x"
        label="Выбор"
        value="a"
        options={options}
        onChange={vi.fn()}
      />,
    );

    expect(screen.getAllByRole('option')).toHaveLength(2);
  });

  it('отдаёт выбранное значение строкой', async () => {
    const onChange = vi.fn();
    render(
      <LabeledSelect
        id="x"
        label="Выбор"
        value="a"
        options={options}
        onChange={onChange}
      />,
    );

    await userEvent.selectOptions(screen.getByLabelText('Выбор'), 'b');

    expect(onChange).toHaveBeenCalledWith('b');
  });
});
