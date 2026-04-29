import { SquadMember, TrainingSession } from '../data/mockData';
import { colours } from '../theme';

export type AiGuidance = {
  title: string;
  summary: string;
  action: string;
  tone: string;
};

export function buildAthleteGuidance(sessions: TrainingSession[]): AiGuidance {
  const recentSessions = sessions.slice(0, 5);
  const weeklyLoad = sessions.slice(0, 7).reduce((total, session) => total + session.durationMinutes * session.rpe, 0);
  const averageRpe = recentSessions.length
    ? recentSessions.reduce((total, session) => total + session.rpe, 0) / recentSessions.length
    : 0;

  if (recentSessions.length === 0) {
    return {
      title: 'AI Guidance',
      summary: 'No recent sessions are logged yet, so the coach model is starting from a neutral baseline.',
      action: 'Log one ruck or one gym session to unlock sharper training and recovery guidance.',
      tone: colours.cyan,
    };
  }

  if (averageRpe >= 7.5 || weeklyLoad >= 360) {
    return {
      title: 'AI Guidance',
      summary: 'Your recent work is heavy and recovery cost is stacking.',
      action: 'Keep the next block aerobic or mobility-focused, then re-test intensity after sleep and hydration improve.',
      tone: colours.amber,
    };
  }

  if (averageRpe <= 5.5 && weeklyLoad < 220) {
    return {
      title: 'AI Guidance',
      summary: 'Current load looks manageable and there is room to progress.',
      action: 'Push the assigned session with intent today and add one quality strength or threshold block this week.',
      tone: colours.green,
    };
  }

  return {
    title: 'AI Guidance',
    summary: 'Your load sits in a usable middle range with enough stress to adapt but not enough to force a deload.',
    action: 'Train as planned, cap sloppy reps, and keep fuelling tight around the hardest session.',
    tone: colours.cyan,
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
