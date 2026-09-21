import type { EvaluationBundle } from './evaluation/catalog';

export type RegionId =
  | 'old-town-wolyeonggyo'
  | 'hahoemaeul'
  | 'dosan-yekki';

export type EvidenceStatus =
  | 'verified'
  | 'inferred'
  | 'field-required'
  | 'unknown'
  | 'example';

export type SnapshotMode = 'demo' | 'live';

export type TourismPlaceCategory =
  | 'attraction'
  | 'accommodation'
  | 'food'
  | 'event'
  | 'accessibility';

export type RegionRecommendation =
  | 'business-planning'
  | 'field-validation'
  | 'long-term-observation'
  | 'pending';

export type ValidationTaskStatus =
  | 'not-started'
  | 'in-progress'
  | 'completed'
  | 'needs-improvement';

export type SnapshotStatusType = 'ready' | 'stale' | 'empty' | 'error';

export interface GeoPoint {
  latitude: number;
  longitude: number;
}

export interface RegionDefinition {
  id: RegionId;
  name: string;
  center: GeoPoint;
  radiusMeters: number;
}

export interface RegionOverview {
  evaluation?: EvaluationBundle;
  id: RegionId;
  potentialScore: number | null;
  confidenceScore: number | null;
  evidenceStatus: EvidenceStatus;
  recommendation: RegionRecommendation;
  summary: string;
  reasons: string[];
  bottleneck: string;
  missingDataCount: number | null;
}

export interface TourismPlace {
  id: string;
  name: string;
  category: TourismPlaceCategory;
  latitude: number;
  longitude: number;
  regionId: RegionId | null;
  evidenceStatus: EvidenceStatus;
  source: string;
  address: string | null;
}

export interface ValidationChecklistItem {
  id: string;
  label: string;
  completed: boolean;
}

export interface ValidationTask {
  id: string;
  regionId: RegionId;
  title: string;
  location: string;
  question: string;
  status: ValidationTaskStatus;
  assignedTo: string | null;
  scheduledFor: string | null;
  notes: string | null;
  result: string | null;
  relatedAction: string | null;
  checklist: ValidationChecklistItem[];
}

export interface VisitorContext {
  scope: '안동시';
  source: string;
  period: {
    start: string;
    end: string;
  };
  visitorCount: number | null;
  evidenceStatus: EvidenceStatus;
  note: string;
}

export interface SnapshotStatus {
  type: SnapshotStatusType;
  message: string;
  lastAttemptAt: string | null;
  affectedData: string[];
}

export interface PublishedSnapshot {
  mode: SnapshotMode;
  publishedAt: string;
  disclaimer: string;
  visitorContext: VisitorContext;
  regions: RegionOverview[];
  places: TourismPlace[];
  limitations: string[];
  status: SnapshotStatus;
}

export const REGIONS: readonly RegionDefinition[] = [
  {
    id: 'old-town-wolyeonggyo',
    name: '원도심·월영교권',
    center: { latitude: 36.5652, longitude: 128.7364 },
    radiusMeters: 4200,
  },
  {
    id: 'hahoemaeul',
    name: '하회마을권',
    center: { latitude: 36.5392, longitude: 128.5185 },
    radiusMeters: 5000,
  },
  {
    id: 'dosan-yekki',
    name: '도산·예끼마을권',
    center: { latitude: 36.7434, longitude: 128.8432 },
    radiusMeters: 6000,
  },
];
