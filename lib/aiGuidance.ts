import { SquadMember, TrainingSession } from '../data/mockData';
import { colours } from '../theme';
import { buildPerformanceProfile } from './performance';

export type AiGuidance = {
  title: string;
  summary: string;
  action: string;
  tone: string;
};

export type ProgrammeGoal = 'Strength Base' | 'Hypertrophy' | 'Conditioning' | 'Recovery' | 'Tactical Hybrid';
export type ProgrammeEquipment = 'Full Gym' | 'Minimal Kit' | 'Bodyweight';
export type ProgrammeReadiness = 'Conservative' | 'Standard' | 'Push';

export type ProgrammeBuilderInput = {
  goal: ProgrammeGoal;
  daysPerWeek: 2 | 3 | 4 | 5;
  sessionMinutes: 30 | 45 | 60;
  equipment: ProgrammeEquipment;
  readiness: ProgrammeReadiness;
};

export type EvidenceSource = {
  title: string;
  url: string;
};

export type EvidencePack = {
  id: string;
  label: string;
  updatedAt: string;
  summary: string;
  sources: EvidenceSource[];
};

export type ProgrammeRecommendation = {
  assignmentTitle: string;
  tone: string;
  summary: string;
  rationale: string;
  weeklyVolume: string;
  intensity: string;
  weeklyStructure: string[];
  coachNote: string;
  scienceNotes: string[];
  exerciseIds: string[];
  evidencePack: EvidencePack;
};

const forgeEvidencePack202604: EvidencePack = {
  id: 'forge-evidence-2026-04',
  label: 'FORGE Evidence v2026.04',
  updatedAt: '2026-04-30',
  summary: 'Built from ACSM 2026 resistance training guidance, current strength-hypertrophy meta-analysis, WHO physical activity guidance, and 2024 concurrent training evidence.',
  sources: [
    {
      title: 'ACSM 2026 Position Stand: Resistance Training Prescription for Muscle Function, Hypertrophy, and Physical Performance in Healthy Adults',
      url: 'https://pmc.ncbi.nlm.nih.gov/articles/PMC12965823/',
    },
    {
      title: 'Currier et al. 2023: Resistance training prescription for muscle strength and hypertrophy',
      url: 'https://pmc.ncbi.nlm.nih.gov/articles/PMC10579494/',
    },
    {
      title: 'WHO physical activity guidance',
      url: 'https://www.who.int/health-topics/physical-activity/physical-activity',
    },
    {
      title: 'Huiberts et al. 2024: Concurrent strength and endurance training meta-analysis',
      url: 'https://pmc.ncbi.nlm.nih.gov/articles/PMC10933151/',
    },
  ],
};

export function buildAthleteGuidance(sessions: TrainingSession[]): AiGuidance {
  const profile = buildPerformanceProfile(sessions);

  if (sessions.length === 0) {
    return {
      title: 'Coach Guidance',
      summary: 'No recent sessions are logged yet, so the coach model is starting from a neutral baseline.',
      action: 'Log one ruck or one gym session to unlock sharper training and recovery guidance.',
      tone: colours.cyan,
    };
  }

  if (profile.loadRisk === 'High') {
    return {
      title: 'Coach Guidance',
      summary: `Load risk is high: ACWR ${profile.acuteChronicRatio}, monotony ${profile.monotony}, strain ${profile.strain}.`,
      action: profile.recommendation,
      tone: colours.red,
    };
  }

  if (profile.loadRisk === 'Low' && profile.readinessBand === 'GREEN') {
    return {
      title: 'Coach Guidance',
      summary: `Readiness is green with weekly load ${profile.weeklyLoad} and ${profile.ruckKm}km of ruck work in the last 7 days.`,
      action: profile.recommendation,
      tone: colours.green,
    };
  }

  return {
    title: 'Coach Guidance',
    summary: `Readiness is ${profile.readinessBand.toLowerCase()} with ${profile.loadRisk.toLowerCase()} load risk.`,
    action: profile.recommendation,
    tone: profile.riskTone,
  };
}

export function buildCoachGuidance(members: SquadMember[], sessions: TrainingSession[]): AiGuidance {
  const atRisk = members.filter((member) => member.risk !== 'Low').length;
  const unassigned = members.filter((member) => !member.assignment).length;
  const latestSession = sessions[0];

  if (atRisk >= 3) {
    return {
      title: 'AI Coach',
      summary: `${atRisk} members are flagged above low risk and need a tighter plan before adding more volume.`,
      action: 'Reassign the highest-risk athletes to lower-impact work and review hydration, sleep, and load compliance first.',
      tone: colours.red,
    };
  }

  if (unassigned > 0) {
    return {
      title: 'AI Coach',
      summary: `${unassigned} squad members still do not have a current assignment.`,
      action: 'Use Assign in the Coach screen to push a block and group placement so the dashboard stops drifting.',
      tone: colours.amber,
    };
  }

  return {
    title: 'AI Coach',
    summary: latestSession
      ? `Last logged session was ${latestSession.title} at RPE ${latestSession.rpe}. The squad picture looks stable.`
      : 'No remote or local session trend is driving a warning right now.',
    action: 'Keep assignments current, watch the medium-risk athletes, and sync again after today’s training block.',
    tone: colours.green,
  };
}

export function buildProgrammeRecommendation(input: ProgrammeBuilderInput): ProgrammeRecommendation {
  const readinessModifier = input.readiness === 'Conservative'
    ? 'Keep most work at RPE 6 to 7 and trim one accessory slot if movement quality fades.'
    : input.readiness === 'Push'
      ? 'Use the top end of the volume range and push the primary lift to RPE 8 when technique stays sharp.'
      : 'Sit in the middle of the volume range and keep one to two reps in reserve on most work.';

  if (input.goal === 'Strength Base') {
    return {
      assignmentTitle: 'Strength Training',
      tone: colours.cyan,
      summary: `Prioritise compound lifts, lower rep ranges, and longer rest periods across ${input.daysPerWeek} training days.`,
      rationale: 'Strength adaptations respond best to repeated exposures to high-force patterns, controlled fatigue, and enough rest to keep bar speed and motor unit recruitment high.',
      weeklyVolume: input.daysPerWeek <= 3 ? '10 to 14 hard sets per major movement per week' : '12 to 16 hard sets per major movement per week',
      intensity: 'Primary lifts at 75 to 88% effort, mostly 3 to 6 reps, with 2 to 4 min rest.',
      weeklyStructure: input.daysPerWeek <= 3
        ? ['Day 1: Lower strength + pull', 'Day 2: Upper push-pull + carries', 'Day 3: Secondary lower strength + trunk']
        : ['Day 1: Heavy lower', 'Day 2: Upper force', 'Day 3: Lower accessory + carries', 'Day 4: Upper assistance + trunk'],
      coachNote: `${readinessModifier} Focus on bracing, clean reps, and progressive overload before adding more exercise variety.`,
      scienceNotes: [
        'Use multi-joint lifts first while fatigue is lowest.',
        'Keep weekly hard-set volume moderate so quality stays high.',
        'Carries and pulls support tactical trunk and grip resilience.',
      ],
      evidencePack: forgeEvidencePack202604,
      exerciseIds: input.equipment === 'Bodyweight'
        ? ['pull-up', 'push-up-ladder', 'walking-lunge', 'bear-crawl']
        : input.equipment === 'Minimal Kit'
          ? ['goblet-squat', 'pull-up', 'farmer-carry', 'walking-lunge', 'anti-rotation']
          : ['trap-bar-deadlift', 'front-squat', 'pull-up', 'push-press', 'farmer-carry'],
    };
  }

  if (input.goal === 'Hypertrophy') {
    return {
      assignmentTitle: 'Resistance Training',
      tone: colours.violet,
      summary: `Bias moderate rep work, repeated muscular tension, and movement balance across ${input.daysPerWeek} weekly sessions.`,
      rationale: 'Hypertrophy tends to improve with enough weekly hard-set volume, moderate reps, and proximity to failure that still allows clean repeated efforts.',
      weeklyVolume: input.daysPerWeek <= 3 ? '12 to 16 hard sets per muscle group per week' : '14 to 18 hard sets per muscle group per week',
      intensity: 'Mostly 6 to 12 reps, 60 to 90 sec rest on accessories, 1 to 3 reps in reserve.',
      weeklyStructure: input.daysPerWeek <= 3
        ? ['Day 1: Lower push-pull', 'Day 2: Upper push-pull', 'Day 3: Single-leg + trunk + accessories']
        : ['Day 1: Lower A', 'Day 2: Upper A', 'Day 3: Lower B', 'Day 4: Upper B'],
      coachNote: `${readinessModifier} Pair push, pull, and single-leg work so the session grows tissue without burying recovery.`,
      scienceNotes: [
        'Volume drives growth more than constant load chasing.',
        'Balanced push-pull pairing helps shoulder tolerance.',
        'Accessory work is useful once primary movement quality is stable.',
      ],
      evidencePack: forgeEvidencePack202604,
      exerciseIds: input.equipment === 'Bodyweight'
        ? ['push-up-ladder', 'pull-up', 'walking-lunge', 'bear-crawl']
        : input.equipment === 'Minimal Kit'
          ? ['goblet-squat', 'band-row', 'suspension-press', 'hamstring-bridge', 'anti-rotation']
          : ['goblet-squat', 'band-row', 'suspension-press', 'hamstring-bridge', 'band-face-pull'],
    };
  }

  if (input.goal === 'Conditioning') {
    return {
      assignmentTitle: 'Cardio Training',
      tone: colours.green,
      summary: `Build the aerobic engine first, then layer in small higher-intensity doses that match the available ${input.sessionMinutes}-minute window.`,
      rationale: 'A strong aerobic base supports recovery, work capacity, and repeated high-intensity efforts. Most conditioning should stay submaximal, with brief targeted interval exposure.',
      weeklyVolume: input.daysPerWeek <= 3 ? '2 aerobic exposures plus 1 interval exposure' : '3 aerobic exposures plus 1 interval exposure',
      intensity: 'Roughly 80% easy aerobic work, 20% threshold or interval work.',
      weeklyStructure: input.daysPerWeek <= 3
        ? ['Day 1: Zone 2 aerobic', 'Day 2: Tempo or threshold', 'Day 3: Easy aerobic + strides']
        : ['Day 1: Zone 2 aerobic', 'Day 2: Tempo', 'Day 3: Recovery aerobic', 'Day 4: Intervals or hill work'],
      coachNote: `${readinessModifier} Keep the easy work actually easy, then place the hard interval piece on the day the squad is freshest.`,
      scienceNotes: [
        'Zone 2 work raises the floor for recovery and endurance.',
        'Intervals should be brief and purposeful rather than daily.',
        'Do not stack hard intervals beside the heaviest lower-body day when readiness is soft.',
      ],
      evidencePack: forgeEvidencePack202604,
      exerciseIds: input.equipment === 'Bodyweight'
        ? ['zone-2-run', 'tempo-run', 'strides']
        : ['zone-2-run', 'tempo-run', 'rower-base', 'bike-intervals', 'strides'],
    };
  }

  if (input.goal === 'Recovery') {
    return {
      assignmentTitle: 'Mobility Reset',
      tone: colours.amber,
      summary: `Use low-threat movement, tissue quality work, and light conditioning to restore readiness without adding much fatigue.`,
      rationale: 'When readiness is limited, recovery sessions work best when they preserve movement quality, gently raise circulation, and avoid adding large mechanical or nervous system stress.',
      weeklyVolume: 'Low volume by design, focused on restoration rather than overload',
      intensity: 'Easy effort, nasal breathing, relaxed tempo, low joint threat.',
      weeklyStructure: ['Block 1: Breathing + mobility', 'Block 2: Easy tissue-friendly movement', 'Block 3: Short easy aerobic flush'],
      coachNote: `${readinessModifier} The win today is leaving the session feeling better than the athlete arrived.`,
      scienceNotes: [
        'Mobility is more useful when paired with breathing and easy movement.',
        'Do not chase fatigue on a recovery day.',
        'Short easy aerobic work can help the next harder session land better.',
      ],
      evidencePack: forgeEvidencePack202604,
      exerciseIds: ['mobility-reset', 'hip-airplane', 'thoracic-rotation', 'calf-ankle-rock'],
    };
  }

  return {
    assignmentTitle: 'Field Workout',
    tone: colours.amber,
    summary: `Blend force, carries, trunk stiffness, and conditioning in a tactical hybrid session that respects the ${input.sessionMinutes}-minute window.`,
    rationale: 'Hybrid tactical work is strongest when it layers one or two force patterns with loaded locomotion and a simple conditioning demand instead of turning into random fatigue.',
    weeklyVolume: input.daysPerWeek <= 3 ? '2 strength-biased days plus 1 conditioning-biased day' : '2 strength-biased days plus 2 hybrid or aerobic days',
    intensity: 'Primary task at moderate-high effort, accessories and conditioning capped before technique falls apart.',
    weeklyStructure: input.daysPerWeek <= 3
      ? ['Day 1: Strength + carry', 'Day 2: Aerobic base', 'Day 3: Hybrid field circuit']
      : ['Day 1: Lower force + carry', 'Day 2: Aerobic base', 'Day 3: Upper force + trunk', 'Day 4: Hybrid field circuit'],
    coachNote: `${readinessModifier} Build the session around one main task, one support strength movement, then one clean conditioning finish.`,
    scienceNotes: [
      'Hybrid sessions work best when the movement menu is small and intentional.',
      'Carries and awkward-object work transfer well to tactical tasks.',
      'Cap density before quality drops into random exhaustion.',
    ],
    evidencePack: forgeEvidencePack202604,
    exerciseIds: input.equipment === 'Bodyweight'
      ? ['push-up-ladder', 'bear-crawl', 'shuttle-run']
      : input.equipment === 'Minimal Kit'
        ? ['sandbag-clean', 'farmer-carry', 'shuttle-run', 'bear-crawl']
        : ['sandbag-clean', 'trap-bar-deadlift', 'farmer-carry', 'shuttle-run', 'bear-crawl'],
  };
}
