import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QualitySelect } from './QualitySelect';

describe('QualitySelect', () => {
  it('предлагает оценки от одного до пяти и пустую', () => {
    render(<QualitySelect value={null} onChange={vi.fn()} />);

    const options = screen.getAllByRole('option');
    expect(options).toHaveLength(6);
    expect(options[0]).toHaveTextContent('—');
  });

  it('показывает заданную оценку', () => {
    render(<QualitySelect value={4} onChange={vi.fn()} />);

    expect(screen.getByLabelText('Качество сна')).toHaveValue('4');
  });

  it('отдаёт выбранную оценку числом', async () => {
    const onChange = vi.fn();
    render(<QualitySelect value={null} onChange={onChange} />);

    await userEvent.selectOptions(screen.getByLabelText('Качество сна'), '3');

    expect(onChange).toHaveBeenCalledWith(3);
  });

  it('пустой выбор отдаёт отсутствие значения, а не ноль', async () => {
    const onChange = vi.fn();
    render(<QualitySelect value={4} onChange={onChange} />);

    await userEvent.selectOptions(screen.getByLabelText('Качество сна'), '');

    expect(onChange).toHaveBeenCalledWith(null);
  });
});
