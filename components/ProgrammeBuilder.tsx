import React, { useMemo, useState } from 'react';
import { View, Text, StyleSheet, Pressable, TextInput } from 'react-native';
import { Card } from './Card';
import { buildProgrammeRecommendation, ProgrammeBuilderInput } from '../lib/aiGuidance';
import { colours } from '../theme';
import { exerciseLibrary, ProgrammeTemplate, SquadMember, TrainingGroup, trainingModes, AssignedExerciseBlock } from '../data/mockData';
import { showAlert } from '../lib/dialogs';
import { buildAssignedExerciseBlock } from '../screens/InstructorScreen';

interface ProgrammeBuilderProps {
  groups: TrainingGroup[];
  members: SquadMember[];
  programmeTemplates: ProgrammeTemplate[];
  activeAssignmentExercises: AssignedExerciseBlock[];
  assignmentLabel: string;
  assignmentNote: string;
  selectedAssignmentMode: (typeof trainingModes)[0] | null;
  onAddProgrammeTemplate: (template: ProgrammeTemplate) => void;
  onDeleteProgrammeTemplate: (id: string) => void;
  onUpdateMember: (id: string, updates: Partial<SquadMember>) => void;
  onLoadIntoStage: (title: string, note: string, exercises: AssignedExerciseBlock[]) => void;
  onSetFeedback: (feedback: string) => void;
}

export function ProgrammeBuilder({
  groups,
  members,
  programmeTemplates,
  activeAssignmentExercises,
  assignmentLabel,
  assignmentNote,
  selectedAssignmentMode,
  onAddProgrammeTemplate,
  onDeleteProgrammeTemplate,
  onUpdateMember,
  onLoadIntoStage,
  onSetFeedback,
}: ProgrammeBuilderProps) {
  const [templateName, setTemplateName] = useState('');
  const [programmeGoal, setProgrammeGoal] = useState<ProgrammeBuilderInput['goal']>('Tactical Hybrid');
  const [programmeDays, setProgrammeDays] = useState<ProgrammeBuilderInput['daysPerWeek']>(3);
  const [programmeMinutes, setProgrammeMinutes] = useState<ProgrammeBuilderInput['sessionMinutes']>(45);
  const [programmeEquipment, setProgrammeEquipment] = useState<ProgrammeBuilderInput['equipment']>('Full Gym');
  const [programmeReadiness, setProgrammeReadiness] = useState<ProgrammeBuilderInput['readiness']>('Standard');

  const programmeRecommendation = useMemo(
    () =>
      buildProgrammeRecommendation({
        goal: programmeGoal,
        daysPerWeek: programmeDays,
        sessionMinutes: programmeMinutes,
        equipment: programmeEquipment,
        readiness: programmeReadiness,
      }),
    [programmeDays, programmeEquipment, programmeGoal, programmeMinutes, programmeReadiness]
  );

  function loadProgrammeIntoStage() {
    const mode = trainingModes.find((item) => item.title === programmeRecommendation.assignmentTitle) ?? trainingModes[0];
    const nextExercises = programmeRecommendation.exerciseIds
      .map((id) => exerciseLibrary.find((exercise) => exercise.id === id))
      .filter((exercise): exercise is NonNullable<typeof exercise> => Boolean(exercise))
      .map((exercise) => buildAssignedExerciseBlock(exercise, mode.coachPinnedExerciseIds?.includes(exercise.id) ?? false));

    onLoadIntoStage(programmeRecommendation.assignmentTitle, programmeRecommendation.coachNote, nextExercises);
    onSetFeedback(`AI plan loaded: ${programmeRecommendation.assignmentTitle}. Review the staged session, then deploy.`);
  }

  function saveProgrammeTemplate() {
    const exercisesToSave = activeAssignmentExercises.length ? activeAssignmentExercises : programmeRecommendation.exerciseIds
      .map((id) => exerciseLibrary.find((exercise) => exercise.id === id))
      .filter((exercise): exercise is NonNullable<typeof exercise> => Boolean(exercise))
      .map((exercise) => buildAssignedExerciseBlock(exercise, programmeRecommendation.exerciseIds.slice(0, 2).includes(exercise.id)));

    const name = templateName.trim() || `${programmeGoal} ${programmeEquipment} ${programmeMinutes}m`;
    onAddProgrammeTemplate({
      id: `template-${Date.now()}`,
      name,
      assignmentTitle: assignmentLabel || programmeRecommendation.assignmentTitle,
      type: selectedAssignmentMode?.type ?? (programmeRecommendation.assignmentTitle === 'Cardio Training' ? 'Cardio' : programmeRecommendation.assignmentTitle === 'Mobility Reset' ? 'Mobility' : programmeRecommendation.assignmentTitle === 'Resistance Training' ? 'Resistance' : programmeRecommendation.assignmentTitle === 'Strength Training' ? 'Strength' : 'Workout'),
      evidenceLabel: programmeRecommendation.evidencePack.label,
      evidenceUpdatedAt: programmeRecommendation.evidencePack.updatedAt,
      evidenceSummary: programmeRecommendation.evidencePack.summary,
      evidenceSources: programmeRecommendation.evidencePack.sources,
      coachNote: assignmentNote.trim() || programmeRecommendation.coachNote,
      summary: programmeRecommendation.summary,
      weeklyVolume: programmeRecommendation.weeklyVolume,
      intensity: programmeRecommendation.intensity,
      weeklyStructure: programmeRecommendation.weeklyStructure,
      scienceNotes: programmeRecommendation.scienceNotes,
      exercises: exercisesToSave,
      createdAt: new Date().toISOString(),
    });
    setTemplateName('');
    onSetFeedback(`Template saved: ${name}`);
  }

  function loadTemplateIntoStage(template: ProgrammeTemplate) {
    onLoadIntoStage(template.assignmentTitle, template.coachNote ?? '', template.exercises);
    onSetFeedback(`Template loaded: ${template.name}`);
  }

  function assignTemplateToGroup(template: ProgrammeTemplate, groupId: string) {
    const group = groups.find((item) => item.id === groupId);
    const targetMembers = members.filter((member) => member.groupId === groupId);
    if (!group || !targetMembers.length) {
      showAlert('No team members', 'Choose a group that has members before assigning a template.');
      return;
    }

    targetMembers.forEach((member) => {
      onUpdateMember(member.id, {
        assignment: template.assignmentTitle,
        pinnedExerciseIds: template.exercises.filter((exercise) => exercise.coachPinned).map((exercise) => exercise.exerciseId),
        assignmentSession: {
          id: `assign-${member.id}-${Date.now()}`,
          title: template.assignmentTitle,
          type: template.type,
          status: 'assigned',
          assignedAt: new Date().toISOString(),
          coachNote: template.coachNote,
          exercises: template.exercises.map((exercise) => ({
            ...exercise,
            actual: undefined,
            status: 'assigned',
          })),
        },
      });
    });

    onSetFeedback(`${template.name} assigned to ${targetMembers.length} members in ${group.name}.`);
  }

  return (
    <Card>
      <Text style={styles.cardTitle}>Programme Builder</Text>
      <Text style={styles.programmeCopy}>
        AI-assisted programme planning grounded in progressive overload, movement balance, and appropriate weekly volume.
      </Text>

      <Text style={styles.assignmentLabel}>Goal</Text>
      <View style={styles.assignmentWrap}>
        {(['Strength Base', 'Hypertrophy', 'Conditioning', 'Recovery', 'Tactical Hybrid'] as const).map((item) => {
          const active = item === programmeGoal;
          return (
            <Pressable key={item} style={[styles.assignmentPill, active && styles.assignmentPillActive]} onPress={() => setProgrammeGoal(item)}>
              <Text style={[styles.assignmentPillText, active && styles.assignmentPillTextActive]}>{item}</Text>
            </Pressable>
          );
        })}
      </View>

      <Text style={styles.assignmentLabel}>Days per week</Text>
      <View style={styles.assignmentWrap}>
        {[2, 3, 4, 5].map((item) => {
          const active = item === programmeDays;
          return (
            <Pressable key={item} style={[styles.assignmentPill, active && styles.assignmentPillActive]} onPress={() => setProgrammeDays(item as ProgrammeBuilderInput['daysPerWeek'])}>
              <Text style={[styles.assignmentPillText, active && styles.assignmentPillTextActive]}>{item} days</Text>
            </Pressable>
          );
        })}
      </View>

      <Text style={styles.assignmentLabel}>Session length</Text>
      <View style={styles.assignmentWrap}>
        {[30, 45, 60].map((item) => {
          const active = item === programmeMinutes;
          return (
            <Pressable key={item} style={[styles.assignmentPill, active && styles.assignmentPillActive]} onPress={() => setProgrammeMinutes(item as ProgrammeBuilderInput['sessionMinutes'])}>
              <Text style={[styles.assignmentPillText, active && styles.assignmentPillTextActive]}>{item} min</Text>
            </Pressable>
          );
        })}
      </View>

      <Text style={styles.assignmentLabel}>Equipment</Text>
      <View style={styles.assignmentWrap}>
        {(['Full Gym', 'Minimal Kit', 'Bodyweight'] as const).map((item) => {
          const active = item === programmeEquipment;
          return (
            <Pressable key={item} style={[styles.assignmentPill, active && styles.assignmentPillActive]} onPress={() => setProgrammeEquipment(item)}>
              <Text style={[styles.assignmentPillText, active && styles.assignmentPillTextActive]}>{item}</Text>
            </Pressable>
          );
        })}
      </View>

      <Text style={styles.assignmentLabel}>Readiness mode</Text>
      <View style={styles.assignmentWrap}>
        {(['Conservative', 'Standard', 'Push'] as const).map((item) => {
          const active = item === programmeReadiness;
          return (
            <Pressable key={item} style={[styles.assignmentPill, active && styles.assignmentPillActive]} onPress={() => setProgrammeReadiness(item)}>
              <Text style={[styles.assignmentPillText, active && styles.assignmentPillTextActive]}>{item}</Text>
            </Pressable>
          );
        })}
      </View>

      <View style={[styles.programmeInsight, { borderColor: `${programmeRecommendation.tone}40`, backgroundColor: `${programmeRecommendation.tone}10` }]}>
        <Text style={[styles.programmeTitle, { color: programmeRecommendation.tone }]}>{programmeRecommendation.assignmentTitle}</Text>
        <Text style={styles.programmeText}>{programmeRecommendation.summary}</Text>
        <Text style={styles.programmeMeta}>Evidence pack: {programmeRecommendation.evidencePack.label}</Text>
        <Text style={styles.programmeMeta}>Updated: {programmeRecommendation.evidencePack.updatedAt}</Text>
        <Text style={styles.programmeMeta}>Rationale: {programmeRecommendation.rationale}</Text>
        <Text style={styles.programmeMeta}>Weekly target: {programmeRecommendation.weeklyVolume}</Text>
        <Text style={styles.programmeMeta}>Intensity: {programmeRecommendation.intensity}</Text>
        <Text style={styles.programmeMeta}>Coach cue: {programmeRecommendation.coachNote}</Text>
      </View>

      <Text style={[styles.assignmentLabel, { marginTop: 12 }]}>Weekly structure</Text>
      <View style={styles.programmeScienceList}>
        {programmeRecommendation.weeklyStructure.map((item) => (
          <View key={item} style={styles.programmeScienceRow}><Text style={styles.programmeScienceBullet}>+</Text><Text style={styles.programmeScienceText}>{item}</Text></View>
        ))}
      </View>

      <View style={styles.programmeScienceList}>
        {programmeRecommendation.scienceNotes.map((item) => (
          <View key={item} style={styles.programmeScienceRow}><Text style={styles.programmeScienceBullet}>+</Text><Text style={styles.programmeScienceText}>{item}</Text></View>
        ))}
      </View>

      <Text style={[styles.assignmentLabel, { marginTop: 12 }]}>Evidence sources</Text>
      <View style={styles.programmeScienceList}>
        {programmeRecommendation.evidencePack.sources.map((source) => (
          <View key={source.url} style={styles.programmeScienceRow}><Text style={styles.programmeScienceBullet}>+</Text><Text style={styles.programmeScienceText}>{source.title}</Text></View>
        ))}
      </View>

      <View style={styles.programmeExerciseGrid}>
        {programmeRecommendation.exerciseIds.map((id) => {
          const exercise = exerciseLibrary.find((item) => item.id === id);
          if (!exercise) return null;
          return (
            <View key={id} style={styles.programmeExerciseChip}><Text style={styles.programmeExerciseName}>{exercise.name}</Text><Text style={styles.programmeExerciseDose}>{exercise.dose}</Text></View>
          );
        })}
      </View>

      <TextInput style={styles.memberInput} value={templateName} onChangeText={setTemplateName} placeholder="Template name" placeholderTextColor={colours.soft} />

      <View style={styles.programmeActionRow}>
        <Pressable style={styles.programmeLoadButton} onPress={loadProgrammeIntoStage}><Text style={styles.programmeLoadButtonText}>Load AI Plan Into Stage</Text></Pressable>
        <Pressable style={styles.programmeSaveButton} onPress={saveProgrammeTemplate}><Text style={styles.programmeSaveButtonText}>Save Template</Text></Pressable>
      </View>

      <Text style={[styles.assignmentLabel, { marginTop: 14 }]}>Saved templates</Text>
      <View style={styles.templateList}>
        {programmeTemplates.map((template) => (
          <View key={template.id} style={styles.templateCard}>
            <View style={styles.stageHeader}>
              <View style={styles.memberCopy}>
                <Text style={styles.memberName}>{template.name}</Text>
                <Text style={styles.muted}>{template.assignmentTitle} - {template.exercises.length} exercises</Text>
                {template.evidenceLabel ? <Text style={styles.memberDeviceSync}>{template.evidenceLabel} / {template.evidenceUpdatedAt}</Text> : null}
              </View>
              <Pressable style={styles.stageRemove} onPress={() => onDeleteProgrammeTemplate(template.id)}><Text style={styles.stageRemoveText}>Delete</Text></Pressable>
            </View>
            {template.summary ? <Text style={styles.programmeMeta}>{template.summary}</Text> : null}
            {template.evidenceSummary ? <Text style={styles.programmeMeta}>{template.evidenceSummary}</Text> : null}
            {template.weeklyStructure?.length ? (
              <View style={styles.programmeScienceList}>
                {template.weeklyStructure.map((item) => (
                  <View key={`${template.id}-${item}`} style={styles.programmeScienceRow}><Text style={styles.programmeScienceBullet}>+</Text><Text style={styles.programmeScienceText}>{item}</Text></View>
                ))}
              </View>
            ) : null}
            <View style={styles.templateActions}>
              <Pressable style={styles.templateActionButton} onPress={() => loadTemplateIntoStage(template)}><Text style={styles.templateActionText}>Load To Stage</Text></Pressable>
              {groups.map((group) => (
                <Pressable key={`${template.id}-${group.id}`} style={styles.templateActionButton} onPress={() => assignTemplateToGroup(template, group.id)}><Text style={styles.templateActionText}>Assign {group.name}</Text></Pressable>
              ))}
            </View>
          </View>
        ))}
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  cardTitle: { color: colours.text, fontSize: 19, fontWeight: '900', marginBottom: 12 },
  assignmentLabel: { color: colours.muted, fontSize: 11, fontWeight: '900', marginBottom: 8 },
  assignmentWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 12 },
  assignmentPill: { borderWidth: 1, borderColor: colours.borderSoft, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 7, backgroundColor: 'rgba(255,255,255,0.04)' },
  assignmentPillActive: { borderColor: `${colours.cyan}70`, backgroundColor: colours.cyanDim },
  assignmentPillText: { color: colours.muted, fontSize: 11, fontWeight: '900' },
  assignmentPillTextActive: { color: colours.cyan },
  programmeCopy: { color: colours.textSoft, fontSize: 13, lineHeight: 19, marginBottom: 12 },
  programmeInsight: { borderWidth: 1, borderRadius: 12, padding: 12, marginTop: 4 },
  programmeTitle: { fontSize: 18, fontWeight: '900', marginBottom: 8 },
  programmeText: { color: colours.text, fontSize: 13, lineHeight: 19, fontWeight: '800' },
  programmeMeta: { color: colours.textSoft, fontSize: 12, lineHeight: 18, marginTop: 8 },
  programmeScienceList: { gap: 8, marginTop: 12 },
  programmeScienceRow: { flexDirection: 'row', gap: 8, alignItems: 'flex-start' },
  programmeScienceBullet: { color: colours.cyan, fontSize: 12, fontWeight: '900', marginTop: 1 },
  programmeScienceText: { flex: 1, color: colours.textSoft, fontSize: 12, lineHeight: 18, fontWeight: '800' },
  programmeExerciseGrid: { gap: 8, marginTop: 12 },
  programmeExerciseChip: { borderWidth: 1, borderColor: colours.borderSoft, borderRadius: 12, padding: 10, backgroundColor: 'rgba(255,255,255,0.04)' },
  programmeExerciseName: { color: colours.text, fontSize: 13, fontWeight: '900' },
  programmeExerciseDose: { color: colours.muted, fontSize: 11, fontWeight: '800', marginTop: 4 },
  memberInput: { borderWidth: 1, borderColor: colours.borderSoft, borderRadius: 12, color: colours.text, backgroundColor: 'rgba(255,255,255,0.05)', paddingHorizontal: 12, paddingVertical: 11, fontSize: 15, fontWeight: '800', marginBottom: 10, marginTop: 12 },
  programmeActionRow: { flexDirection: 'row', gap: 10, marginTop: 4 },
  programmeLoadButton: { flex: 1, alignItems: 'center', backgroundColor: colours.green, borderRadius: 14, paddingVertical: 12 },
  programmeLoadButtonText: { color: colours.background, fontSize: 14, fontWeight: '900' },
  programmeSaveButton: { flex: 1, alignItems: 'center', backgroundColor: colours.cyan, borderRadius: 14, paddingVertical: 12 },
  programmeSaveButtonText: { color: colours.background, fontSize: 14, fontWeight: '900' },
  templateList: { gap: 8, marginTop: 8 },
  templateCard: { borderWidth: 1, borderColor: colours.borderSoft, borderRadius: 12, padding: 12, backgroundColor: 'rgba(255,255,255,0.04)' },
  stageHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 10 },
  memberCopy: { flex: 1 },
  memberName: { color: colours.text, fontWeight: '900' },
  muted: { color: colours.muted, fontSize: 13 },
  memberDeviceSync: { color: colours.violet, fontSize: 11, fontWeight: '800', marginTop: 3 },
  stageRemove: { borderWidth: 1, borderColor: `${colours.red}40`, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 5, backgroundColor: colours.redDim },
  stageRemoveText: { color: colours.red, fontSize: 11, fontWeight: '900' },
  templateActions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 10 },
  templateActionButton: { borderWidth: 1, borderColor: `${colours.cyan}40`, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 6, backgroundColor: colours.cyanDim },
  templateActionText: { color: colours.cyan, fontSize: 11, fontWeight: '900' },
});