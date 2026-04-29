import { buildPerformanceProfile } from '../lib/performance';
import { TrainingSession } from '../data/domain';

describe('Readiness Score Calculations', () => {
  const today = new Date().toISOString();
  
  it('calculates baseline readiness for an empty log', () => {
    const profile = buildPerformanceProfile([]);
    expect(profile.readiness).toBeGreaterThan(0);
    expect(typeof profile.readinessBand).toBe('string');
  });

  it('reduces readiness when consecutive high RPE sessions are logged', () => {
    const heavySessions: TrainingSession[] = [
      { id: '1', type: 'Ruck', title: 'Heavy Ruck', score: 85, durationMinutes: 90, rpe: 9, loadKg: 20, completedAt: today },
      { id: '2', type: 'Strength', title: 'Max Effort', score: 80, durationMinutes: 60, rpe: 9, completedAt: today },
      { id: '3', type: 'Workout', title: 'Conditioning', score: 75, durationMinutes: 45, rpe: 8, completedAt: today },
    ];
    
    const lightSessions: TrainingSession[] = [
      { id: '4', type: 'Run', title: 'Zone 2', score: 70, durationMinutes: 45, rpe: 4, completedAt: today },
      { id: '5', type: 'Mobility', title: 'Reset', score: 60, durationMinutes: 30, rpe: 3, completedAt: today },
    ];

    const heavyProfile = buildPerformanceProfile(heavySessions);
    const lightProfile = buildPerformanceProfile(lightSessions);

    // Heavy recent load should yield a lower readiness score than light recovery work
    expect(heavyProfile.readiness).toBeLessThan(lightProfile.readiness);
    
    // High sustained RPE should trigger a caution/warning band
    expect(heavyProfile.readinessBand).not.toBe('GREEN');
  });

  it('calculates acute-to-chronic workload ratio (ACWR)', () => {
    const sessions: TrainingSession[] = [
      { id: '1', type: 'Run', title: 'Base', score: 70, durationMinutes: 45, rpe: 5, completedAt: today }
    ];
    const profile = buildPerformanceProfile(sessions);
    expect(typeof profile.acuteChronicRatio).toBe('number');
  });

  it('calculates weekly strain appropriately', () => {
    const sessions: TrainingSession[] = [
      { id: '1', type: 'Cardio', title: 'Tempo', score: 80, durationMinutes: 40, rpe: 7, completedAt: today }
    ];
    const profile = buildPerformanceProfile(sessions);
    expect(profile.weeklyLoad).toBeGreaterThan(0);
  });
});