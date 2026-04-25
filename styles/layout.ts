import { StyleSheet } from 'react-native';
import { colours, spacing, radius } from '../theme';

export const layout = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colours.background,
  },
  scrollContent: {
    paddingHorizontal: spacing.xl,
    paddingTop: 60,
    paddingBottom: 110,
    flexGrow: 1,
  },
  stack: {
    gap: 14,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: spacing.md,
  },
  rowStart: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  grid2: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  card: {
    backgroundColor: colours.panel,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colours.border,
    padding: spacing.lg,
    gap: 10,
  },
  cardHot: {
    backgroundColor: colours.panelHot,
    borderRadius: radius.md,
    borderWidth: 1,
    borderLeftWidth: 3,
    borderColor: colours.borderHot,
    padding: spacing.lg,
    gap: 10,
  },
  cardTint: (tint: string) => ({
    backgroundColor: tint,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colours.border,
    padding: spacing.lg,
  }),
  section: {
    marginBottom: spacing.xl,
  },
  divider: {
    height: 1,
    backgroundColor: colours.border,
    marginVertical: spacing.sm,
  },
  centred: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  spacer: (size: number) => ({ height: size }),
});
