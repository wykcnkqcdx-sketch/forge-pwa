import Anthropic from '@anthropic-ai/sdk';
import { SquadMember, TrainingSession } from '../data/mockData';
import { colours } from '../theme';
import { buildPerformanceProfile } from './performance';
import type { ReadinessLog } from '../data/domain';

const ANTHROPIC_API_KEY = process.env.EXPO_PUBLIC_ANTHROPIC_API_KEY;

export type ClaudeCoaching = {
  headline: string;
  body: string;
  action: string;
  tone: string;
};

export async function getClaudeCoaching(
  sessions: TrainingSession[],
  readinessLogs: ReadinessLog[]
): Promise<ClaudeCoaching | null> {
  if (!ANTHROPIC_API_KEY) return null;

  const profile = buildPerformanceProfile(sessions);
  const latest = readinessLogs[0];

  const context = [
    `Sessions last 7 days: ${profile.weeklyLoad}`,
    `ACWR: ${profile.acuteChronicRatio}`,
    `Load risk: ${profile.loadRisk}`,
    `Readiness band: ${profile.readinessBand}`,
    `Monotony: ${profile.monotony.toFixed(2)}`,
    latest ? `Sleep: ${latest.sleepHours}h, Stress: ${latest.stress}, Hydration: ${latest.hydration}, Soreness: ${latest.soreness}` : 'No readiness log today',
  ].join('\n');

  try {
    const client = new Anthropic({ apiKey: ANTHROPIC_API_KEY, dangerouslyAllowBrowser: true });
    const message = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 200,
      system: 'You are a tactical fitness coach for military personnel. Give concise, direct coaching based on training load and readiness data. Respond with JSON: { "headline": "4-6 word directive", "body": "1-2 sentence analysis", "action": "specific next step" }',
      messages: [{ role: 'user', content: `Athlete data:\n${context}\n\nProvide coaching guidance as JSON.` }],
    });

    const text = message.content[0].type === 'text' ? message.content[0].text : '';
    const match = text.match(/\{[\s\S]*\}/);
    if (!match) return null;
    const parsed = JSON.parse(match[0]);

    const tone = profile.loadRisk === 'High' ? colours.red
      : profile.readinessBand === 'GREEN' ? colours.green
      : colours.amber;

    return { headline: parsed.headline, body: parsed.body, action: parsed.action, tone };
  } catch {
    return null;
  }
}

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

export type RuckMissionBrief = {
  status: 'GO' | 'CAUTION' | 'NO-GO';
  recommendation: string;
  loadGuidance: string;
  paceGuidance: string;
  tone: string;
};

function buildRuleMissionBrief(
  targetDistanceKm: number,
  targetMinutes: number,
  loadKg: number,
  readinessLog: ReadinessLog | null,
  recentSessions: TrainingSession[],
): RuckMissionBrief {
  const profile = buildPerformanceProfile(recentSessions);
  const pace = targetDistanceKm > 0 ? targetMinutes / targetDistanceKm : 0;

  const loadHeavy = loadKg >= 25;
  const loadMod = loadKg >= 18;
  const acwrHigh = profile.acuteChronicRatio > 1.5;
  const acwrElevated = profile.acuteChronicRatio > 1.2;
  const readinessPoor = readinessLog ? (readinessLog.soreness >= 4 || (readinessLog.stress ?? 0) >= 4) : false;

  let status: 'GO' | 'CAUTION' | 'NO-GO';
  let recommendation: string;

  if (acwrHigh || (profile.loadRisk === 'High' && loadHeavy)) {
    status = 'NO-GO';
    recommendation = 'Acute:chronic load ratio is too high for a heavy ruck today. Rest or reduce load significantly.';
  } else if (acwrElevated || profile.loadRisk === 'High' || readinessPoor || loadHeavy) {
    status = 'CAUTION';
    recommendation = loadHeavy
      ? 'Heavy load with elevated cumulative fatigue. Reduce pace, monitor lower back, and plan extra recovery.'
      : 'Load risk or readiness flags present. Proceed at controlled pace and watch for early fatigue signs.';
  } else {
    status = 'GO';
    recommendation = profile.ruckKm > 20
      ? 'Ruck load is well-conditioned this week. Execute at target pace.'
      : 'Training base is manageable. This ruck is a solid progressive stimulus — execute as planned.';
  }

  const loadGuidance = loadKg < 10
    ? 'Light load — standard hydration, no harness adjustments needed.'
    : loadKg < 18
      ? 'Moderate load — increase hydration by 0.5L, check shoulder strap fit before moving.'
      : loadKg < 25
        ? 'Heavy load — tighten hip belt for weight transfer, monitor lumbar on descents, add electrolytes.'
        : 'Very heavy load — verify harness fit is firm on hips, keep pace conservative throughout.';

  const paceGuidance = pace <= 0
    ? 'Set a target distance and time to get pace guidance.'
    : pace < 8
      ? `${pace.toFixed(1)} min/km is an aggressive pace — build to it only if recent ruck volume is high.`
      : pace < 10
        ? `${pace.toFixed(1)} min/km is a solid tactical pace — sustainable with adequate base fitness.`
        : pace < 13
          ? `${pace.toFixed(1)} min/km is controlled — appropriate for this load or training phase.`
          : `${pace.toFixed(1)} min/km is a recovery pace — good choice given load or readiness.`;

  return {
    status,
    recommendation,
    loadGuidance,
    paceGuidance,
    tone: status === 'GO' ? colours.green : status === 'NO-GO' ? colours.red : colours.amber,
  };
}

export async function getRuckMissionBrief(
  targetDistanceKm: number,
  targetMinutes: number,
  loadKg: number,
  readinessLog: ReadinessLog | null,
  recentSessions: TrainingSession[],
): Promise<RuckMissionBrief | null> {
  if (!ANTHROPIC_API_KEY) {
    return buildRuleMissionBrief(targetDistanceKm, targetMinutes, loadKg, readinessLog, recentSessions);
  }

  const profile = buildPerformanceProfile(recentSessions);
  const targetPace = targetDistanceKm > 0 ? (targetMinutes / targetDistanceKm).toFixed(1) : '--';

  const context = [
    `Mission: ${targetDistanceKm.toFixed(1)}km at ${targetPace} min/km, load ${loadKg}kg`,
    `Load risk: ${profile.loadRisk}, ACWR: ${profile.acuteChronicRatio}`,
    `Ruck km last 7 days: ${profile.ruckKm}`,
    readinessLog
      ? `Readiness: Sleep ${readinessLog.sleepHours ?? '?'}h, Soreness ${readinessLog.soreness}/5, Stress ${readinessLog.stress ?? '?'}/5, Hydration ${readinessLog.hydration}`
      : 'No readiness logged today',
  ].join('\n');

  try {
    const client = new Anthropic({ apiKey: ANTHROPIC_API_KEY, dangerouslyAllowBrowser: true });
    const msg = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 220,
      system: 'You are a tactical fitness coach. Give a mission brief for a ruck operation. Reply ONLY with JSON: { "status": "GO" | "CAUTION" | "NO-GO", "recommendation": "one sentence", "loadGuidance": "one sentence on load", "paceGuidance": "one sentence on pace" }',
      messages: [{ role: 'user', content: `Operator data:\n${context}\n\nGenerate mission brief JSON.` }],
    });
    const text = msg.content[0].type === 'text' ? msg.content[0].text : '';
    const match = text.match(/\{[\s\S]*\}/);
    if (!match) return null;
    const parsed = JSON.parse(match[0]) as RuckMissionBrief;
    const tone = parsed.status === 'GO' ? colours.green : parsed.status === 'NO-GO' ? colours.red : colours.amber;
    return { ...parsed, tone };
  } catch {
    return null;
  }
}

export type DayRecommendation = {
  type: TrainingSession['type'];
  headline: string;
  rationale: string;
  tone: string;
  suggestedDuration: number;
  suggestedRpe: number;
  exercises: string[];
};

function _strengthRec(elevated: boolean): DayRecommendation {
  return {
    type: 'Strength',
    headline: elevated ? 'Moderate Strength' : 'Strength Session',
    rationale: elevated
      ? 'Load is elevated — keep intensity at 70%, prioritise movement quality over weight.'
      : 'Compound lifts today. Progressive loading drives the most systemic adaptation.',
    tone: colours.green,
    suggestedDuration: elevated ? 35 : 55,
    suggestedRpe: elevated ? 6 : 8,
    exercises: ['Deadlift 4×5', 'Bench press 3×8', 'Pull-ups 3×max', 'Overhead press 3×10', 'Farmer carry 3×30m'],
  };
}

function _cardioRec(elevated: boolean): DayRecommendation {
  return {
    type: elevated ? 'Cardio' : 'Run',
    headline: elevated ? 'Zone 2 Aerobic' : 'Run / Conditioning',
    rationale: elevated
      ? 'Elevated load — keep HR in Z2 (60-70% max). Build the engine without adding fatigue.'
      : 'Aerobic conditioning day. Sustained pace builds the base that powers everything else.',
    tone: colours.cyan,
    suggestedDuration: elevated ? 30 : 40,
    suggestedRpe: elevated ? 4 : 6,
    exercises: ['5 min warm-up walk', 'Target: Z2 HR (130-150 bpm)', 'Breathe through nose if possible', '5 min cool-down + calf stretch'],
  };
}

export function buildDayRecommendation(dateStr: string, allSessions: TrainingSession[]): DayRecommendation {
  const profile = buildPerformanceProfile(allSessions);
  const date = new Date(dateStr + 'T12:00:00');
  const dow = date.getDay(); // 0=Sun … 6=Sat

  if (profile.loadRisk === 'High') {
    return {
      type: 'Mobility',
      headline: 'Mandatory Recovery',
      rationale: `ACWR is ${profile.acuteChronicRatio} — system needs deload. Mobility and breathwork only today.`,
      tone: colours.red,
      suggestedDuration: 30,
      suggestedRpe: 2,
      exercises: ['Foam rolling 10 min', 'Hip flexor stretch 3×30s', 'Thoracic rotation 3×10', 'Box breathing 5 min'],
    };
  }

  const elevated = profile.acuteChronicRatio > 1.2;
  const yesterday = new Date(date.getTime() - 86400000).toISOString().slice(0, 10);
  const yesterdayType = allSessions.find(s => s.completedAt?.slice(0, 10) === yesterday)?.type;
  const recentTypes = allSessions
    .filter(s => {
      if (!s.completedAt) return false;
      const d = new Date(s.completedAt).getTime();
      return d < date.getTime() && d > date.getTime() - 7 * 86400000;
    })
    .map(s => s.type);
  const ruckCount = recentTypes.filter(t => t === 'Ruck').length;

  if (dow === 0) {
    return { type: 'Mobility', headline: 'Mobility & Reset', rationale: 'Sunday is your system reset. Active recovery preserves adaptations without adding fatigue.', tone: colours.violet, suggestedDuration: 40, suggestedRpe: 3, exercises: ['Hip 90/90 3×60s', 'Couch stretch 3×45s each', 'Thoracic extension on roller', 'Dead hangs 3×20s', 'Breathing 5 min'] };
  }
  if (dow === 6) {
    if (ruckCount < 1) return { type: 'Ruck', headline: 'Long Ruck Day', rationale: `No ruck logged this week. Saturday is ideal for your longest loaded carry — build the base.`, tone: colours.amber, suggestedDuration: elevated ? 60 : 90, suggestedRpe: elevated ? 5 : 7, exercises: ['Load: 15–20 kg', 'Pace: controlled, conversational', 'Hydrate every 20 min', 'Cool-down hip flexor stretch'] };
    return _strengthRec(elevated);
  }
  if (dow === 1) {
    if (yesterdayType === 'Strength' || yesterdayType === 'Resistance') return _cardioRec(elevated);
    return { type: 'Strength', headline: 'Lower Body Strength', rationale: 'Monday sets the tone. Compound lower body work drives the most systemic adaptation.', tone: colours.green, suggestedDuration: elevated ? 40 : 55, suggestedRpe: elevated ? 6 : 8, exercises: ['Back squat 4×5', 'Romanian deadlift 3×8', 'Bulgarian split squat 3×10', 'Calf raises 3×15', 'Plank 3×45s'] };
  }
  if (dow === 2) {
    if (yesterdayType === 'Cardio' || yesterdayType === 'Run') return _strengthRec(elevated);
    return _cardioRec(elevated);
  }
  if (dow === 3) {
    if (yesterdayType === 'Strength' || yesterdayType === 'Resistance') return { type: 'Ruck', headline: 'Midweek Ruck', rationale: 'Strength was yesterday. Midweek ruck builds loaded conditioning without more muscle damage.', tone: colours.amber, suggestedDuration: elevated ? 45 : 60, suggestedRpe: elevated ? 5 : 6, exercises: ['Load: 15–20 kg', 'Pace: comfortable and sustained', 'Flat terrain preferred', 'Post: stretch calves and hip flexors'] };
    return _strengthRec(elevated);
  }
  if (dow === 4) return _cardioRec(elevated);
  if (yesterdayType === 'Strength' || yesterdayType === 'Resistance') return _cardioRec(elevated);
  return _strengthRec(elevated);
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
