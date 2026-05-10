import type { SquadMember } from '../data/mockData';
import type { WorkoutCompletion } from '../data/domain';

export function buildAssignmentDeliveryRows(input: {
  assignmentTitle: string;
  assignedAt: string;
  targetMemberIds?: string[];
  targetNames: string[];
  cloudReadyMemberIds?: string[];
  completedMemberIds?: string[];
  members: SquadMember[];
  workoutCompletions: WorkoutCompletion[];
}) {
  const {
    assignmentTitle,
    assignedAt,
    targetMemberIds = [],
    targetNames,
    cloudReadyMemberIds = [],
    completedMemberIds = [],
    members,
    workoutCompletions,
  } = input;
  const cloudReadySet = new Set(cloudReadyMemberIds);
  const completedSet = new Set(completedMemberIds);
  const assignedAtMs = new Date(assignedAt).getTime();

  const rows = targetNames.map((name, index) => {
    const memberId = targetMemberIds[index];
    const member = members.find((item) => item.id === memberId);
    const cloudDelivered = Boolean(memberId && (cloudReadySet.has(memberId) || member?.cloudMembershipId));
    const completion = workoutCompletions.find((item) => (
      item.memberId === memberId
      && item.assignment === assignmentTitle
      && new Date(item.completedAt).getTime() >= assignedAtMs
    ));
    const completed = Boolean((memberId && completedSet.has(memberId)) || completion);

    return {
      key: memberId ?? `${assignmentTitle}-${index}`,
      name,
      memberId,
      deliveryLabel: cloudDelivered ? 'Cloud delivered' : 'Local only',
      deliveryToneKey: cloudDelivered ? 'success' : 'warning',
      completionLabel: completed ? 'Completed' : 'Pending',
      completionToneKey: completed ? 'success' : 'warning',
      effort: completion?.effort,
      note: completion?.note,
    };
  });

  return {
    rows,
    cloudDeliveredCount: rows.filter((row) => row.deliveryLabel === 'Cloud delivered').length,
    localOnlyCount: rows.filter((row) => row.deliveryLabel === 'Local only').length,
    completedCount: rows.filter((row) => row.completionLabel === 'Completed').length,
  };
}
