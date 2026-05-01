import type { ReadinessLog } from '../data/domain';

export const readinessStaleMs = 18 * 60 * 60 * 1000;

export function readinessTime(log: ReadinessLog) {
  const time = new Date(log.date).getTime();
  return Number.isFinite(time) ? time : 0;
}

export function sortReadinessLogs(logs: ReadinessLog[]) {
  return [...logs].sort((a, b) => readinessTime(b) - readinessTime(a));
}

export function getLatestReadinessLog(logs: ReadinessLog[], memberId?: string) {
  const sortedLogs = sortReadinessLogs(logs);
  return memberId ? sortedLogs.find((log) => log.memberId === memberId) : sortedLogs[0];
}

export function isReadinessCheckedInToday(log?: ReadinessLog, now = new Date()) {
  if (!log) return false;
  const logDate = new Date(readinessTime(log));
  return logDate.toDateString() === now.toDateString();
}

export function isReadinessStale(log?: ReadinessLog, now = new Date()) {
  if (!log) return false;
  return now.getTime() - readinessTime(log) >= readinessStaleMs;
}

export function readinessSleepScore(log?: ReadinessLog) {
  if (!log) return undefined;
  const qualityScore = log.sleepQuality * 16;
  const hoursScore = log.sleepHours === undefined ? qualityScore : Math.min(100, Math.round((log.sleepHours / 8) * 100));
  return Math.round(qualityScore * 0.55 + hoursScore * 0.45);
}
