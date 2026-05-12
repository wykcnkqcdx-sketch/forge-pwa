import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colours, typography } from '../theme';
import {
  type CoordinateFormat,
  coordinateFormatOptions,
} from '../utils/coordinates';
import {
  type MapLayerKey,
  mapLayerOptions,
} from '../utils/mapTiles';

export function RuckTacticalOptionsDrawer({
  coordinateFormat,
  mapLayer,
  tapMarkMode,
  hasSelectedCheckpoint,
  isDownloadingMap,
  downloadProgress,
  onCoordinateFormatChange,
  onMapLayerChange,
  onToggleTapMark,
  onMoveCheckpointHere,
  onDownloadOfflineMap,
  onClearOfflineMap,
}: {
  coordinateFormat: CoordinateFormat;
  mapLayer: MapLayerKey;
  tapMarkMode: boolean;
  hasSelectedCheckpoint: boolean;
  isDownloadingMap: boolean;
  downloadProgress: number;
  onCoordinateFormatChange: (format: CoordinateFormat) => void;
  onMapLayerChange: (layer: MapLayerKey) => void;
  onToggleTapMark: () => void;
  onMoveCheckpointHere: () => void;
  onDownloadOfflineMap: () => void;
  onClearOfflineMap: () => void;
}) {
  return (
    <View style={styles.tacticalDrawer}>
      <View style={styles.drawerSection}>
        <Text style={styles.drawerLabel}>Coordinates</Text>
        <View style={styles.coordinateSelector}>
          {coordinateFormatOptions.map((option) => {
            const selected = coordinateFormat === option.key;
            return (
              <Pressable
                key={option.key}
                style={[styles.coordinateOption, selected && styles.coordinateOptionActive]}
                onPress={() => onCoordinateFormatChange(option.key)}
              >
                <Text style={[styles.coordinateOptionText, selected && styles.coordinateOptionTextActive]}>{option.label}</Text>
              </Pressable>
            );
          })}
        </View>
      </View>

      <View style={styles.drawerSection}>
        <Text style={styles.drawerLabel}>Map Layer</Text>
        <View style={styles.layerSelector}>
          {mapLayerOptions.map((option) => {
            const selected = mapLayer === option.key;
            return (
              <Pressable
                key={option.key}
                style={[styles.layerOption, selected && styles.layerOptionActive]}
                onPress={() => onMapLayerChange(option.key)}
              >
                <Text style={[styles.layerOptionText, selected && styles.layerOptionTextActive]}>{option.label}</Text>
              </Pressable>
            );
          })}
        </View>
      </View>

      <View style={styles.drawerActions}>
        <Pressable style={[styles.drawerButton, tapMarkMode && styles.drawerButtonActive]} onPress={onToggleTapMark}>
          <Ionicons name="finger-print-outline" size={15} color={tapMarkMode ? colours.background : colours.cyan} />
          <Text style={[styles.drawerButtonText, tapMarkMode && styles.drawerButtonTextActive]}>Tap Mark</Text>
        </Pressable>
        {hasSelectedCheckpoint ? (
          <Pressable style={styles.drawerButton} onPress={onMoveCheckpointHere}>
            <Ionicons name="pin" size={15} color={colours.cyan} />
            <Text style={styles.drawerButtonText}>Move CP</Text>
          </Pressable>
        ) : null}
        {isDownloadingMap ? (
          <View style={[styles.drawerButton, styles.drawerButtonActive]}>
            <Text style={styles.drawerButtonTextActive}>{downloadProgress}%</Text>
          </View>
        ) : (
          <Pressable style={styles.drawerButton} onPress={onDownloadOfflineMap}>
            <Ionicons name="cloud-download-outline" size={15} color={colours.cyan} />
            <Text style={styles.drawerButtonText}>Offline</Text>
          </Pressable>
        )}
        <Pressable style={styles.drawerButton} onPress={onClearOfflineMap}>
          <Ionicons name="trash-outline" size={15} color={colours.red} />
          <Text style={[styles.drawerButtonText, { color: colours.red }]}>Clear</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  tacticalDrawer: {
    marginTop: 10,
    borderRadius: 12,
    padding: 10,
    gap: 10,
    backgroundColor: colours.panel,
    borderWidth: 1,
    borderColor: colours.borderSoft,
  },
  drawerSection: { gap: 7 },
  drawerLabel: { ...typography.label, color: colours.muted, letterSpacing: 1.1 },
  coordinateSelector: {
    flexDirection: 'row',
    gap: 6,
    padding: 4,
    borderRadius: 8,
    backgroundColor: 'rgba(255,255,255,0.04)',
  },
  coordinateOption: {
    flex: 1,
    minHeight: 34,
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  coordinateOptionActive: { backgroundColor: colours.cyan },
  coordinateOptionText: { ...typography.label, color: colours.muted },
  coordinateOptionTextActive: { color: colours.background },
  layerSelector: {
    flexDirection: 'row',
    gap: 6,
  },
  layerOption: {
    flex: 1,
    minHeight: 32,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: colours.borderSoft,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.04)',
    paddingHorizontal: 4,
  },
  layerOptionActive: {
    borderColor: 'rgba(74,222,128,0.55)',
    backgroundColor: 'rgba(74,222,128,0.14)',
  },
  layerOptionText: { ...typography.label, color: colours.muted },
  layerOptionTextActive: { color: colours.green },
  drawerActions: { flexDirection: 'row', flexWrap: 'wrap', gap: 7 },
  drawerButton: {
    minHeight: 34,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(103,232,249,0.24)',
    backgroundColor: 'rgba(103,232,249,0.08)',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    paddingHorizontal: 10,
  },
  drawerButtonActive: { backgroundColor: colours.cyan, borderColor: colours.cyan },
  drawerButtonText: { ...typography.label, color: colours.cyan },
  drawerButtonTextActive: { ...typography.label, color: colours.background },
});
