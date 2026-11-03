import type { ComponentType } from 'react';
import type { HazardCategory, HazardStatus } from '@/types';
import {
  IconAccessibility, IconCone, IconDots, IconIntersection, IconObstacle, IconSidewalk, IconStreetlight, type IconProps,
} from '@/components/icons';

export interface CategoryMeta {
  label: string;
  short: string;
  description: string;
  icon: ComponentType<IconProps>;
  color: string;
  filter: FilterGroup;
}

export type FilterGroup = 'lighting' | 'construction' | 'sidewalk' | 'accessibility' | 'intersection' | 'other';

export const HAZARD_CATEGORIES: Record<HazardCategory, CategoryMeta> = {
  lighting: { label: 'Broken streetlight', short: 'Lighting', description: 'A streetlight is out or an area is unusually dark.', icon: IconStreetlight, color: '#D69A2D', filter: 'lighting' },
  construction: { label: 'Construction area', short: 'Construction', description: 'Works, closures or detours affecting pedestrians.', icon: IconCone, color: '#C47B2B', filter: 'construction' },
  sidewalk: { label: 'Damaged sidewalk or path', short: 'Sidewalk', description: 'Cracks, potholes, uneven or poorly maintained surfaces.', icon: IconSidewalk, color: '#6B7A99', filter: 'sidewalk' },
  accessibility: { label: 'Accessibility obstacle', short: 'Accessibility', description: 'Missing curb ramp, narrow passage or other barrier.', icon: IconAccessibility, color: '#3E7CB1', filter: 'accessibility' },
  intersection: { label: 'Difficult intersection', short: 'Intersection', description: 'A crossing that is hard to see or hard to cross.', icon: IconIntersection, color: '#B9604A', filter: 'intersection' },
  obstacle: { label: 'Blocked path or obstacle', short: 'Obstacle', description: 'Fallen tree, debris or something blocking the way.', icon: IconObstacle, color: '#4D8A5B', filter: 'other' },
  other: { label: 'Other hazard', short: 'Other', description: 'Anything else pedestrians should know about.', icon: IconDots, color: '#6E6A86', filter: 'other' },
};

export const FILTER_GROUPS: { id: FilterGroup; label: string }[] = [
  { id: 'lighting', label: 'Street lighting' },
  { id: 'construction', label: 'Construction' },
  { id: 'sidewalk', label: 'Sidewalk damage' },
  { id: 'accessibility', label: 'Accessibility' },
  { id: 'intersection', label: 'Intersections' },
  { id: 'other', label: 'Other hazards' },
];

export const STATUS_META: Record<HazardStatus, { label: string; tone: 'teal' | 'navy' | 'grey' | 'amber' }> = {
  active: { label: 'Active', tone: 'amber' },
  resolved: { label: 'Resolved', tone: 'teal' },
  outdated: { label: 'Outdated', tone: 'grey' },
  hidden: { label: 'Hidden by moderation', tone: 'grey' },
};
