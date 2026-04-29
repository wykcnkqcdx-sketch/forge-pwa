import React from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import Svg, { Circle, Rect, Text as SvgText } from 'react-native-svg';
import { colours, touchTarget } from '../theme';

export type BodyMapView = 'anterior' | 'posterior';
export type PainMap = Record<string, number>;

type Segment = {
  id: string;
  label: string;
  view: BodyMapView;
  x: number;
  y: number;
  width: number;
  height: number;
};

function makeSegments(view: BodyMapView, count: number, prefix: 'A' | 'P'): Segment[] {
  return Array.from({ length: count }, (_, index) => {
    const pair = Math.floor(index / 2);
    const side = index % 2 === 0 ? -1 : 1;
    const band = Math.floor(pair / 3);
    const slot = pair % 3;
    const centerX = 120 + side * (24 + slot * 24);
    return {
      id: `${prefix}${String(index + 1).padStart(2, '0')}`,
      label: `${view === 'anterior' ? 'Anterior' : 'Posterior'} ${index + 1}`,
      view,
      x: centerX - 22,
      y: 22 + band * 48,
      width: 44,
      height: 44,
    };
  });
}

const anteriorSegments = makeSegments('anterior', 36, 'A');
const posteriorSegments = makeSegments('posterior', 38, 'P');
export const choirSegments = [...anteriorSegments, ...posteriorSegments];

function painColour(level: number) {
  if (level <= 0) return 'rgba(143,166,59,0.10)';
  if (level <= 3) return '#8FA63B';
  if (level <= 6) return '#D7A84B';
  if (level <= 8) return '#D9824B';
  return colours.red;
}

export function BodyMap({
  activeView,
  painMap,
  selectedSegment,
  selectedPainLevel,
  onChangeView,
  onSelect,
}: {
  activeView: BodyMapView;
  painMap: PainMap;
  selectedSegment: string | null;
  selectedPainLevel: number;
  onChangeView: (view: BodyMapView) => void;
  onSelect: (segmentId: string) => void;
}) {
  const visibleSegments = activeView === 'anterior' ? anteriorSegments : posteriorSegments;
  const activeCount = choirSegments.filter((segment) => painMap[segment.id] > 0).length;

  return (
    <View style={styles.shell}>
      <View style={styles.toggleRow}>
        {(['anterior', 'posterior'] as const).map((view) => {
          const active = activeView === view;
          return (
            <Pressable
              key={view}
              style={[styles.toggleButton, active && styles.toggleButtonActive]}
              onPress={() => onChangeView(view)}
              accessibilityRole="button"
              accessibilityState={{ selected: active }}
            >
              <Text style={[styles.toggleText, active && styles.toggleTextActive]}>
                {view === 'anterior' ? 'Anterior 36' : 'Posterior 38'}
              </Text>
            </Pressable>
          );
        })}
      </View>

      <Svg width="100%" height={430} viewBox="0 0 240 430">
        <Circle cx="120" cy="35" r="22" stroke={colours.muted} strokeWidth="2" fill="rgba(143,166,59,0.05)" />
        <Rect x="88" y="66" width="64" height="96" rx="18" stroke={colours.muted} strokeWidth="2" fill="rgba(143,166,59,0.04)" />
        <Rect x="52" y="76" width="30" height="132" rx="14" stroke={colours.muted} strokeWidth="2" fill="rgba(143,166,59,0.04)" />
        <Rect x="158" y="76" width="30" height="132" rx="14" stroke={colours.muted} strokeWidth="2" fill="rgba(143,166,59,0.04)" />
        <Rect x="88" y="174" width="26" height="174" rx="12" stroke={colours.muted} strokeWidth="2" fill="rgba(143,166,59,0.04)" />
        <Rect x="126" y="174" width="26" height="174" rx="12" stroke={colours.muted} strokeWidth="2" fill="rgba(143,166,59,0.04)" />

        {visibleSegments.map((segment) => {
          const level = painMap[segment.id] ?? 0;
          const active = selectedSegment === segment.id;
          return (
            <React.Fragment key={segment.id}>
              <Rect
                x={segment.x}
                y={segment.y}
                width={segment.width}
                height={segment.height}
                rx="7"
                fill={painColour(level)}
                stroke={active ? colours.text : level > 0 ? painColour(level) : colours.borderHot}
                strokeWidth={active ? 3 : 1}
                opacity={level > 0 || active ? 0.96 : 0.44}
                onPress={() => onSelect(segment.id)}
              />
              <SvgText
                x={segment.x + segment.width / 2}
                y={segment.y + 24}
                fill={active ? colours.background : colours.text}
                fontSize="10"
                fontWeight="900"
                textAnchor="middle"
                onPress={() => onSelect(segment.id)}
              >
                {segment.id}
              </SvgText>
            </React.Fragment>
          );
        })}

        <SvgText x="120" y="404" fill={colours.muted} fontSize="12" fontWeight="900" textAnchor="middle">
          CHOIR CBM: {activeView === 'anterior' ? '36 anterior' : '38 posterior'} segments
        </SvgText>
      </Svg>

      <View style={styles.selection}>
        <View>
          <Text style={styles.selectionLabel}>PAIN PAINT</Text>
          <Text style={styles.selectionValue}>
            {selectedSegment ? `${selectedSegment} | ${selectedPainLevel}/10` : 'SELECT A SEGMENT'}
          </Text>
        </View>
        <Text style={styles.selectionCount}>{activeCount}/74</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  shell: {
    borderWidth: 1,
    borderColor: colours.borderSoft,
    borderRadius: 8,
    backgroundColor: 'rgba(21,24,22,0.88)',
    overflow: 'hidden',
  },
  toggleRow: {
    flexDirection: 'row',
    gap: 8,
    padding: 10,
  },
  toggleButton: {
    minHeight: touchTarget,
    flex: 1,
    borderWidth: 1,
    borderColor: colours.borderSoft,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#151816',
  },
  toggleButtonActive: {
    borderColor: colours.borderHot,
    backgroundColor: '#3C4B2A',
  },
  toggleText: {
    color: colours.muted,
    fontSize: 16,
    fontWeight: '900',
  },
  toggleTextActive: {
    color: colours.text,
  },
  selection: {
    minHeight: touchTarget,
    borderTopWidth: 1,
    borderColor: colours.borderSoft,
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  selectionLabel: {
    color: colours.muted,
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: 1.4,
  },
  selectionValue: {
    color: colours.text,
    fontSize: 18,
    fontWeight: '900',
    marginTop: 2,
  },
  selectionCount: {
    color: colours.cyan,
    fontSize: 18,
    fontWeight: '900',
  },
});
