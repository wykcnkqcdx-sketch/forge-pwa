import { Ionicons } from '@expo/vector-icons';
import type { RuckCheckpoint } from '../data/domain';
import { colours } from '../theme';

export type FieldMarkType = NonNullable<RuckCheckpoint['markType']>;

export const fieldMarkTypes: {
  key: FieldMarkType;
  label: string;
  shortLabel: string;
  icon: keyof typeof Ionicons.glyphMap;
  tone: string;
}[] = [
  { key: 'checkpoint', label: 'Checkpoint', shortLabel: 'CP', icon: 'flag-outline', tone: colours.cyan },
  { key: 'rv', label: 'Rendezvous', shortLabel: 'RV', icon: 'people-outline', tone: colours.green },
  { key: 'hazard', label: 'Hazard', shortLabel: 'HZ', icon: 'warning-outline', tone: colours.red },
  { key: 'water', label: 'Water', shortLabel: 'WT', icon: 'water-outline', tone: '#60a5fa' },
  { key: 'medic', label: 'Medic', shortLabel: 'MED', icon: 'medical-outline', tone: colours.amber },
  { key: 'observation', label: 'Observation', shortLabel: 'OP', icon: 'eye-outline', tone: '#a78bfa' },
  { key: 'objective', label: 'Objective', shortLabel: 'OBJ', icon: 'radio-button-on-outline', tone: '#f97316' },
];

export function getFieldMarkType(markType?: RuckCheckpoint['markType']) {
  return fieldMarkTypes.find((type) => type.key === markType) ?? fieldMarkTypes[0];
}

export function formatFieldMarkLabel(checkpoint: RuckCheckpoint) {
  const meta = getFieldMarkType(checkpoint.markType);
  return checkpoint.label.toUpperCase().startsWith(meta.shortLabel)
    ? checkpoint.label
    : `${meta.shortLabel} ${checkpoint.label}`;
}
