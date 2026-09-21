import '@/styles/discovery.css';

import { DiscoveryShell } from '@/components/discovery/DiscoveryShell';
import { loadSnapshot } from '@/lib/snapshot';

export const dynamic = 'force-dynamic';

export default async function HomePage() {
  const snapshot = await loadSnapshot();
  return <DiscoveryShell snapshot={snapshot} />;
}
