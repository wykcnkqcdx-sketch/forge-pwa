import { StyleSheet } from 'react-native';
import { colours, spacing, radius, fontSize } from '../theme';

export const components = StyleSheet.create({
  /* ── Buttons ──────────────────────────────────────────────── */
  primaryBtn: {
    backgroundColor: colours.cyan,
    borderRadius: radius.xl,
    paddingVertical: spacing.lg,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: spacing.sm,
  },
  primaryBtnText: {
    color: '#07111E',
    fontWeight: '900',
    fontSize: fontSize.lg,
  },
  secondaryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    paddingVertical: 13,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colours.cyan,
    backgroundColor: colours.cyanDim,
  },
  secondaryBtnText: {
    color: colours.cyan,
    fontWeight: '900',
    fontSize: fontSize.md,
  },
  dangerBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    paddingVertical: 13,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colours.red,
    backgroundColor: colours.redDim,
  },
  dangerBtnText: {
    color: colours.red,
    fontWeight: '900',
    fontSize: fontSize.md,
  },
  iconBtn: {
    width: 36,
    height: 36,
    borderRadius: radius.sm,
    backgroundColor: colours.cyan,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconBtnText: {
    color: '#07111E',
    fontSize: 20,
    fontWeight: '900',
  },

  /* ── Tags / Badges ────────────────────────────────────────── */
  tag: {
    borderWidth: 1,
    borderRadius: radius.pill,
    paddingVertical: 3,
    paddingHorizontal: spacing.sm,
    fontSize: fontSize.xs,
    fontWeight: '800',
  },
  tagCyan: {
    borderColor: 'rgba(103, 232, 249, 0.28)',
    color: colours.cyan,
    backgroundColor: colours.cyanDim,
  },
  tagAmber: {
    borderColor: 'rgba(253, 230, 138, 0.28)',
    color: colours.amber,
    backgroundColor: colours.amberDim,
  },
  tagViolet: {
    borderColor: 'rgba(196, 181, 253, 0.28)',
    color: colours.violet,
    backgroundColor: colours.violetDim,
  },
  tagRed: {
    borderColor: 'rgba(252, 165, 165, 0.28)',
    color: colours.red,
    backgroundColor: colours.redDim,
  },
  tagGreen: {
    borderColor: 'rgba(110, 231, 183, 0.28)',
    color: colours.green,
    backgroundColor: colours.greenDim,
  },

  /* ── Source Badge (HR indicator etc.) ─────────────────────── */
  sourceBadge: {
    borderWidth: 1,
    borderRadius: radius.sm,
    paddingVertical: 2,
    paddingHorizontal: 6,
  },
  sourceBadgeText: {
    fontSize: fontSize.xs,
    fontWeight: '800',
  },

  /* ── Steppers ─────────────────────────────────────────────── */
  stepperRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginVertical: 10,
    gap: spacing.md,
  },
  stepperButtons: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },

  /* ── Progress Bar ─────────────────────────────────────────── */
  progressTrack: {
    height: 8,
    backgroundColor: colours.panelSoft,
    borderRadius: radius.pill,
    overflow: 'hidden',
    marginTop: spacing.sm,
  },
  progressFill: {
    height: '100%' as unknown as number,
    borderRadius: radius.pill,
    backgroundColor: colours.cyan,
  },

  /* ── Modal Bottom Sheet ───────────────────────────────────── */
  modalOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0, 0, 0, 0.72)',
  },
  modalSheet: {
    backgroundColor: colours.panel,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    maxHeight: '85%' as unknown as number,
    paddingTop: spacing.md,
  },
  modalHandle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: colours.border,
    alignSelf: 'center',
    marginBottom: spacing.sm,
  },
  modalContent: {
    padding: spacing.xl,
    paddingBottom: 40,
    flexGrow: 1,
  },

  /* ── Session Row ──────────────────────────────────────────── */
  sessionRow: {
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: colours.border,
    gap: 4,
  },
  sessionTitle: {
    color: colours.text,
    fontWeight: '900',
    fontSize: fontSize.md,
  },
  sessionMeta: {
    color: colours.muted,
    fontSize: fontSize.sm,
  },
  sessionScore: {
    color: colours.cyan,
    fontWeight: '950',
    fontSize: 22,
  },

  /* ── Empty State ──────────────────────────────────────────── */
  emptyState: {
    color: colours.muted,
    textAlign: 'center',
    paddingVertical: 24,
    paddingHorizontal: spacing.sm,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: colours.border,
    borderRadius: radius.sm,
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    fontSize: fontSize.sm,
  },
});
