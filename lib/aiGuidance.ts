import { SquadMember, TrainingSession } from '../data/mockData';
import { colours } from '../theme';
import { buildPerformanceProfile } from './performance';

export type AiGuidance = {
  title: string;
  summary: string;
  action: string;
  tone: string;
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
