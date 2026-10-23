import { requireUser } from '@/features/auth/server';
import { TrackersScreen } from '@/features/trackers/TrackersScreen';

/** Экран реестров трекеров и навыков. */
export default async function TrackersPage() {
  await requireUser();
  return <TrackersScreen />;
}
