import { requireUser } from '@/features/auth/server';
import { createServerClient } from '@/api-client/serverClient';
import { TrackersScreen } from '@/features/trackers/TrackersScreen';

/**
 * Экран реестров трекеров и навыков.
 *
 * Списки берутся на сервере и передаются экрану начальными: иначе первая
 * отрисовка сказала бы «трекеров пока нет» при непустом реестре — не
 * задержка, а ложь.
 */
export default async function TrackersPage() {
  await requireUser();

  const client = await createServerClient();
  const [trackers, skills] = await Promise.all([
    client.GET('/trackers'),
    client.GET('/skills'),
  ]);

  return (
    <TrackersScreen
      initialTrackers={trackers.data ?? []}
      initialSkills={skills.data ?? []}
    />
  );
}
