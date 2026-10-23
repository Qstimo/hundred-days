import type { components } from '@/api-client';

export interface IProps {
  /** Вычисленный сервером период. */
  period: components['schemas']['Period'];
}
