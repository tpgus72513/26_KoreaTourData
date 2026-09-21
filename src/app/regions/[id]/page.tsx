import '@/styles/discovery.css';

import { notFound } from 'next/navigation';

import { EvidenceDetail } from '@/components/discovery/EvidenceDetail';
import { REGIONS, type RegionId } from '@/lib/domain';
import { loadSnapshot } from '@/lib/snapshot';

export const dynamic = 'force-dynamic';

export default async function RegionPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!REGIONS.some((region) => region.id === id)) notFound();

  const snapshot = await loadSnapshot();
  return <EvidenceDetail snapshot={snapshot} regionId={id as RegionId} />;
}
