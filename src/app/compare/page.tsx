import '@/styles/discovery.css';

import { ComparisonView } from '@/components/discovery/ComparisonView';
import { loadSnapshot } from '@/lib/snapshot';

export const dynamic = 'force-dynamic';

export default async function ComparePage() {
  const snapshot = await loadSnapshot();
  return <ComparisonView snapshot={snapshot} />;
}
