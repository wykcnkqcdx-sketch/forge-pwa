import React, { useEffect, useMemo, useState, useRef } from 'react';
import { createRoot } from 'react-dom/client';
import {
  challenges,
  dailyMission,
  profile,
  readiness,
  recentActivity,
  recoveryActions,
  recoveryMetrics,
  route,
  squad,
  TabId,
  tabs,
  trainingBlocks,
  trendMetrics,
} from './data';
import './styles.css';

const quickLogKinds = ['Run', 'Ruck', 'Cardio', 'Strength', 'Workout', 'Mobility'];
const efforts = ['Too Easy', 'About Right', 'Too Hard'];

function estimateQuickLogVolume(kind: string, durationMinutes: number) {
  const rate = kind === 'Strength' || kind === 'Workout' ? 10
    : kind === 'Ruck' ? 8
    : kind === 'Run' || kind === 'Cardio' ? 6 : 2;
  return Math.max(rate * Math.max(durationMinutes, 1), kind === 'Mobility' ? 20 : 60);
}

function App() {
  const [activeTab, setActiveTab] = useState<TabId>('home');
  const [expanded, setExpanded] = useState('mission');
  const [timer, setTimer] = useState(18 * 60 + 42);
  const activeIndex = tabs.findIndex((tab) => tab.id === activeTab);

  // Centralized Application State (Simulating temp.tsx logic)
  const [appState, setAppState] = useState({
    readiness: readiness.score || 82,
    weeklyVolume: 8200,
    ghostMode: false,
    activities: recentActivity.map((a, i) => ({ ...a, id: String(i), hypes: 0 }))
  });

  const handleLogSession = (session: { type: string, title: string, volume: number, duration: number, effort: string }) => {
    setAppState(prev => ({
      ...prev,
      weeklyVolume: prev.weeklyVolume + session.volume,
      readiness: Math.min(100, Math.max(1, prev.readiness + (session.effort === 'Too Hard' ? -3 : session.effort === 'Too Easy' ? 2 : 1))),
      activities: [
        {
          id: Date.now().toString(),
          type: session.type,
          title: prev.ghostMode ? 'A teammate logged activity' : `You finished ${session.title}`,
          result: `${session.duration} min · +${session.volume} vol`,
          time: 'Just now',
          hypes: 0
        },
        ...prev.activities
      ]
    }));
  };

  const handleHype = (id: string) => {
    setAppState(prev => ({
      ...prev,
      activities: prev.activities.map(a => a.id === id ? { ...a, hypes: a.hypes + 1 } : a)
    }));
  };

  useEffect(() => {
    const interval = window.setInterval(() => setTimer((value) => value + 1), 1000);
    return () => window.clearInterval(interval);
  }, []);

  useEffect(() => {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js').catch(() => undefined);
    }
  }, []);

  function selectTab(tab: TabId) {
    setActiveTab(tab);
    window.navigator.vibrate?.(12);
  }

  return (
    <div className="app-shell">
      <div className="ambient-map" aria-hidden="true" />
      <header className="topbar">
        <div>
          <p className="eyebrow">Tactical Performance OS</p>
          <h1>{tabs[activeIndex].label}</h1>
        </div>
        <button className="icon-button" aria-label="Open alerts">
          <span>!</span>
        </button>
      </header>

      <main className="screen" key={activeTab}>
        {activeTab === 'home' && <Home expanded={expanded} setExpanded={setExpanded} onNavigate={selectTab} appState={appState} onHype={handleHype} />}
        {activeTab === 'train' && <Train timer={timer} onLog={handleLogSession} />}
        {activeTab === 'tactical' && <Tactical timer={timer} />}

        {activeTab === 'recovery' && <Recovery readiness={appState.readiness} />}
        {activeTab === 'team' && <Team weeklyVolume={appState.weeklyVolume} />}
        {activeTab === 'profile' && <Profile ghostMode={appState.ghostMode} setGhostMode={(val: boolean) => setAppState(p => ({...p, ghostMode: val}))} onLog={handleLogSession} />}
      </main>

      <nav className="mobile-nav" aria-label="Primary navigation">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            className={tab.id === activeTab ? 'active' : ''}
            onClick={() => selectTab(tab.id)}
            aria-label={tab.label}
            aria-current={tab.id === activeTab ? 'page' : undefined}
          >
            <span className="nav-icon">{tab.icon}</span>
            <span>{tab.label}</span>
          </button>
        ))}
      </nav>
    </div>
  );
}

function Home({ expanded, setExpanded, onNavigate, appState, onHype }: { expanded: string; setExpanded: (id: string) => void; onNavigate: (tab: TabId) => void; appState: any; onHype: (id: string) => void }) {
  return (
    <>
      <section className="hero-grid">
        <ReadinessCard readinessScore={appState.readiness} />
        <MissionCard expanded={expanded === 'mission'} onToggle={() => setExpanded(expanded === 'mission' ? '' : 'mission')} />
      </section>
      <QuickActions onAction={(action) => {
        switch (action) {
          case 'Start': onNavigate('train'); break;
          case 'Route': onNavigate('tactical'); break;
          case 'Recover': onNavigate('recovery'); break;
          case 'Log': onNavigate('profile'); break;
        }
      }} />
      <div className="stats-row">
        <MiniStat label="HRV" value={readiness.hrv} />
        <MiniStat label="Sleep" value={readiness.sleep} />
        <MiniStat label="Strain" value={readiness.strain} />
      </div>
      <Card title="Recent Activity" action="All logs">
        <div className="activity-list">
          {appState.activities.map((item: any) => (
            <div className="activity-item" key={item.id}>
              <span>{item.type}</span>
              <div>
                <strong>{item.title}</strong>
                <p>{item.result}</p>
              </div>
              <div style={{ textAlign: 'right' }}>
                <time>{item.time}</time>
                <button
                  onClick={() => {
                    window.navigator.vibrate?.(12);
                    onHype(item.id);
                  }}
                  style={{ background: 'transparent', border: '1px solid var(--line)', color: 'var(--amber)', borderRadius: 8, padding: '4px 8px', fontSize: '0.7rem', marginTop: 6, cursor: 'pointer', display: 'block', width: '100%' }}
                >
                  Bump {item.hypes > 0 ? `(${item.hypes})` : ''}
                </button>
              </div>
            </div>
          ))}
        </div>
      </Card>
    </>
  );
}

function Train({ timer, onLog }: { timer: number; onLog: (data: any) => void }) {
  const [isTraining, setIsTraining] = useState(false);
  const [selectedBlock, setSelectedBlock] = useState<string | null>(null);
  const [effort, setEffort] = useState('About Right');

  return (
    <>
      <Card className="timer-card">
        <p className="eyebrow">Live Training Window</p>
        <div className="timer-row">
          <div>
            <h2>{isTraining ? formatTimer(timer) : '0:00'}</h2>
            <p>{isTraining ? 'Zone 3 ruck intervals active' : 'Ready to begin'}</p>
          </div>
          <button 
            className="primary-action" 
            onClick={() => setIsTraining(!isTraining)}
          >
            {isTraining ? 'Stop' : 'Start'}
          </button>
        </div>
      </Card>
      <div className="action-grid">
        {trainingBlocks.map((block) => (
          <button 
            className="action-card" 
            key={block.name}
            onClick={() => setSelectedBlock(block.name)}
            style={{ borderColor: selectedBlock === block.name ? '#8fc96f' : undefined }}
          >
            <span>{block.action}</span>
            <strong>{block.name}</strong>
            <p>{block.detail}</p>
          </button>
        ))}
      </div>
      {selectedBlock && (
        <Card title="Finish Session" className="metric-card" style={{ marginTop: 14 }}>
          <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
            {efforts.map((e) => (
              <button
                key={e}
                onClick={() => setEffort(e)}
                style={{
                  flex: 1,
                  padding: '10px 4px',
                  borderRadius: '12px',
                  border: `1px solid ${effort === e ? 'rgba(143, 201, 111, 0.36)' : 'var(--line)'}`,
                  background: effort === e ? 'rgba(143, 201, 111, 0.12)' : 'rgba(255, 255, 255, 0.035)',
                  color: effort === e ? 'var(--green)' : 'var(--soft)',
                  fontSize: '0.75rem',
                  fontWeight: 800,
                }}
              >
                {e}
              </button>
            ))}
          </div>
          <button className="primary-action" style={{ width: '100%', padding: '12px' }} onClick={() => {
            onLog({ type: 'Workout', title: selectedBlock, volume: 150, duration: Math.max(1, Math.floor(timer / 60)), effort });
            setSelectedBlock(null);
            setIsTraining(false);
            window.navigator.vibrate?.([20, 50, 20]);
          }}>Log & Complete</button>
        </Card>
      )}
      <Card title="Performance Trends">
        <MetricGrid metrics={trendMetrics} />
        <TrendBars />
      </Card>
    </>
  );
}

function Tactical({ timer }: { timer: number }) {
  return (
    <>
      <section className="map-panel">
        <div className="route-line" aria-hidden="true" />
        <div className="map-sweep" aria-hidden="true" />
        <div className="checkpoint cp-a">SP</div>
        <div className="checkpoint cp-b">01</div>
        <div className="checkpoint cp-c active">02</div>
        <div className="checkpoint cp-d">03</div>
        <div className="map-overlay">
          <p className="eyebrow">Route Active</p>
          <h2>{route.title}</h2>
          <div className="route-stats">
            <MiniStat label="Distance" value={route.distance} />
            <MiniStat label="Pace" value={route.pace} />
            <MiniStat label="Elev." value={route.elevation} />
          </div>
        </div>
      </section>
      <Card title="Navigation Cards" action={formatTimer(timer)}>
        <div className="checkpoint-list">
          {route.checkpoints.map((point) => (
            <div className={`checkpoint-row ${point.status.toLowerCase()}`} key={point.label}>
              <span>{point.label}</span>
              <strong>{point.status}</strong>
              <time>{point.eta}</time>
            </div>
          ))}
        </div>
      </Card>
    </>
  );
}

function Recovery({ readiness }: { readiness: number }) {
  const [completedTasks, setCompletedTasks] = useState<Set<string>>(new Set());

  const toggleTask = (task: string) => {
    const next = new Set(completedTasks);
    if (next.has(task)) next.delete(task);
    else next.add(task);
    setCompletedTasks(next);
  };

  return (
    <>
      <Card className="recovery-score">
        <p className="eyebrow">Recovery Score</p>
        <div className="score-line">
          <ProgressRing value={readiness + (completedTasks.size * 2)} label={String(readiness + (completedTasks.size * 2))} />
          <div>
            <h2>Ready with guardrails</h2>
            <p>Push aerobic work. Cap heavy eccentrics until calf soreness drops.</p>
          </div>
        </div>
      </Card>
      <MetricGrid metrics={recoveryMetrics} />
      <Card title="Suggested Recovery Actions">
        <div className="task-list">
          {recoveryActions.map((action) => (
            <label key={action} style={{ opacity: completedTasks.has(action) ? 0.5 : 1 }}>
              <input 
                type="checkbox" 
                checked={completedTasks.has(action)} 
                onChange={() => toggleTask(action)} 
              />
              <span>{action}</span>
            </label>
          ))}
        </div>
      </Card>
    </>
  );
}

function Team({ weeklyVolume }: { weeklyVolume: number }) {
  return (
    <>
      <Card className="team-pulse-card" style={{ marginBottom: 14 }}>
        <p className="eyebrow">Team Pulse</p>
        <div className="score-line">
          <ProgressRing value={Math.min(100, (weeklyVolume / 10000) * 100)} label={String(Math.min(100, Math.round((weeklyVolume / 10000) * 100)))} />
          <div>
            <h2>{weeklyVolume.toLocaleString()} units</h2>
            <p>of 10,000 squad volume goal this week</p>
          </div>
        </div>
      </Card>
      <Card title="Unit Readiness" action="Live">
        <div className="squad-list">
          {squad.map((unit) => (
            <div className="squad-row" key={unit.name}>
              <div>
                <strong>{unit.name}</strong>
                <p>{unit.mission}</p>
              </div>
              <div className="squad-score">
                <span>{unit.trend}</span>
                <strong>{unit.score}</strong>
              </div>
            </div>
          ))}
        </div>
      </Card>
      <Card title="Unit Challenges">
        <div className="challenge-list">
          {challenges.map((challenge) => (
            <div className="challenge" key={challenge.title}>
              <div>
                <strong>{challenge.title}</strong>
                <span>{challenge.progress}% complete</span>
              </div>
              <div className="progress-track">
                <ProgressBar progress={challenge.progress} />
              </div>
            </div>
          ))}
        </div>
      </Card>
    </>
  );
}

function Profile({ ghostMode, setGhostMode, onLog }: { ghostMode: boolean; setGhostMode: (val: boolean) => void; onLog: (data: any) => void }) {
  return (
    <>
      <QuickLog onLog={onLog} />
      <Card className="profile-card">
        <p className="eyebrow">Operator Profile</p>
        <h2>{profile.name}</h2>
        <p>{profile.rank} · {profile.streak} operational streak</p>
        <div className="rank-track">
          <ProgressBar progress={profile.nextRank} />
        </div>
        <small>{profile.nextRank}% to next rank · {profile.missions} completed missions</small>
      </Card>
      <Card title="Privacy Settings">
        <label style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '14px', border: '1px solid var(--line)', borderRadius: 16, background: 'rgba(255, 255, 255, 0.035)', cursor: 'pointer' }}>
          <input 
            type="checkbox" 
            checked={ghostMode} 
            onChange={(e) => setGhostMode(e.target.checked)} 
            style={{ width: 24, height: 24, accentColor: 'var(--green)', cursor: 'pointer' }} 
          />
          <div>
            <strong style={{ display: 'block', color: 'var(--text)', fontSize: '0.95rem', marginBottom: 4 }}>Ghost Mode</strong>
            <span style={{ display: 'block', color: 'var(--muted)', fontSize: '0.8rem', lineHeight: 1.4 }}>
              {ghostMode ? 'Your activity is hidden from the team feed.' : 'Teammates can see your activity in the feed.'}
            </span>
          </div>
        </label>
      </Card>
      <Card title="Deployment Badges">
        <div className="badge-grid">
          {profile.badges.map((badge) => (
            <span key={badge}>{badge}</span>
          ))}
        </div>
      </Card>
      <Card title="Personal Records">
        <div className="record-grid">
          {profile.records.map((record) => (
            <MiniStat key={record.label} label={record.label} value={record.value} />
          ))}
        </div>
      </Card>
    </>
  );
}

function ReadinessCard({ readinessScore }: { readinessScore: number }) {
  return (
    <Card className="readiness-card">
      <p className="eyebrow">Readiness</p>
      <div className="readiness-layout">
        <ProgressRing value={readinessScore} label={String(readinessScore)} />
        <div>
          <h2>{readinessScore >= 80 ? 'Optimal' : readinessScore >= 60 ? 'Ready' : 'Recover'}</h2>
          <p>{readinessScore >= 80 ? 'Prime for heavy load' : 'Monitor fatigue'}</p>
        </div>
      </div>
    </Card>
  );
}

function MissionCard({ expanded, onToggle }: { expanded: boolean; onToggle: () => void }) {
  return (
    <Card className={`mission-card ${expanded ? 'expanded' : ''}`}>
      <button className="card-toggle" onClick={onToggle}>
        <span>
          <small>Daily Mission</small>
          <strong>{dailyMission.title}</strong>
        </span>
        <b>{expanded ? '−' : '+'}</b>
      </button>
      <div className="expandable">
        <p>{dailyMission.brief}</p>
        <div className="mission-meta">
          <span>{dailyMission.location}</span>
          <span>{dailyMission.window}</span>
        </div>
      </div>
    </Card>
  );
}

function QuickActions({ onAction }: { onAction: (action: string) => void }) {
  return (
    <div className="quick-actions">
      {['Start', 'Log', 'Route', 'Recover'].map((action) => (
        <button key={action} onClick={() => {
          // Triggers a custom double-tap (15ms on, 30ms off, 15ms on)
          window.navigator.vibrate?.([15, 30, 15]);
          onAction(action);
        }}>{action}</button>
      ))}
    </div>
  );
}

function Card({
  title,
  action,
  className = '',
  style,
  children,
}: {
  title?: string;
  action?: string;
  className?: string;
  style?: React.CSSProperties;
  children: React.ReactNode;
}) {
  return (
    <section className={`card ${className}`} style={style}>
      {title && (
        <header className="card-header">
          <h2>{title}</h2>
          {action && <span>{action}</span>}
        </header>
      )}
      {children}
    </section>
  );
}


function MetricGrid({ metrics }: { metrics: Array<{ label: string; value: string; detail: string; tone?: string }> }) {
  return (
    <div className="metric-grid">
      {metrics.map((metric) => (
        <div className={`metric-card ${metric.tone ?? ''}`} key={metric.label}>
          <span>{metric.label}</span>
          <strong>{metric.value}</strong>
          <p>{metric.detail}</p>
        </div>
      ))}
    </div>
  );
}

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="mini-stat">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function ProgressBar({ progress }: { progress: number }) {
  const ref = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    if (ref.current) ref.current.style.width = `${progress}%`;
  }, [progress]);
  return <span ref={ref} />;
}

function ProgressRing({ value, label }: { value: number; label: string }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (ref.current) ref.current.style.setProperty('--value', `${value * 3.6}deg`);
  }, [value]);
  return (
    <div className="progress-ring" ref={ref}>
      <div>
        <strong>{label}</strong>
        <span>%</span>
      </div>
    </div>
  );
}

function TrendBars() {
  return (
    <div className="trend-bars" aria-label="Seven day performance trend">
      {[58, 72, 64, 78, 88, 70, 92].map((value, index) => (
        <TrendBar key={index} value={value} />
      ))}
    </div>
  );
}

function TrendBar({ value }: { value: number }) {
  const ref = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    if (ref.current) ref.current.style.height = `${value}%`;
  }, [value]);
  return <span ref={ref} />;
}

function QuickLog({ onLog }: { onLog: (data: any) => void }) {
  const [kind, setKind] = useState('Run');
  const [duration, setDuration] = useState('30');
  const [volume, setVolume] = useState('');
  const [effort, setEffort] = useState('About Right');
  const [note, setNote] = useState('');
  const [feedback, setFeedback] = useState('');

  function submitQuickLog() {
    const parsedDuration = Number.parseInt(duration, 10);
    if (!Number.isFinite(parsedDuration) || parsedDuration <= 0) {
      setFeedback('Enter a valid duration in minutes.');
      return;
    }

    const parsedVolume = volume.trim()
      ? Number.parseInt(volume, 10)
      : estimateQuickLogVolume(kind, parsedDuration);

    if (!Number.isFinite(parsedVolume) || parsedVolume <= 0) {
      setFeedback('Enter a valid volume or leave it blank to auto-calculate.');
      return;
    }

    onLog({
      type: kind,
      title: `Quick Log: ${kind}`,
      volume: parsedVolume,
      duration: parsedDuration,
      effort
    });

    setFeedback(`Logged ${kind.toLowerCase()} for ${parsedDuration} min. Data saved locally!`);
    
    // Reset the form
    setDuration('30');
    setVolume('');
    setNote('');
    setEffort('About Right');
    setTimeout(() => setFeedback(''), 4000);
  }

  const inputStyle: React.CSSProperties = {
    width: '100%',
    padding: '12px',
    borderRadius: '14px',
    background: 'rgba(255, 255, 255, 0.035)',
    border: '1px solid var(--line)',
    color: 'var(--text)',
    fontSize: '1rem',
    outline: 'none',
  };

  return (
    <Card title="Quick Log">
      <p style={{ marginBottom: 16 }}>Record a run, ruck, mobility block, or extra session.</p>
      
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 16 }}>
        {quickLogKinds.map((k) => (
          <button
            key={k}
            onClick={() => setKind(k)}
            style={{
              padding: '8px 12px',
              borderRadius: 999,
              border: `1px solid ${kind === k ? 'rgba(217, 142, 58, 0.48)' : 'var(--line)'}`,
              background: kind === k ? 'rgba(217, 142, 58, 0.11)' : 'rgba(255, 255, 255, 0.035)',
              color: kind === k ? 'var(--amber)' : 'var(--soft)',
              fontSize: '0.8rem',
              fontWeight: 750,
            }}
          >
            {k}
          </button>
        ))}
      </div>

      <div style={{ display: 'flex', gap: 12, marginBottom: 16 }}>
        <div style={{ flex: 1 }}>
          <label style={{ display: 'block', fontSize: '0.72rem', color: 'var(--muted)', fontWeight: 800, textTransform: 'uppercase', marginBottom: 6 }}>Duration (min)</label>
          <input type="number" value={duration} onChange={(e) => setDuration(e.target.value)} placeholder="30" style={inputStyle} />
        </div>
        <div style={{ flex: 1 }}>
          <label style={{ display: 'block', fontSize: '0.72rem', color: 'var(--muted)', fontWeight: 800, textTransform: 'uppercase', marginBottom: 6 }}>Volume</label>
          <input type="number" value={volume} onChange={(e) => setVolume(e.target.value)} placeholder={String(estimateQuickLogVolume(kind, Number.parseInt(duration || '0', 10) || 30))} style={inputStyle} />
        </div>
      </div>

      <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
        {efforts.map((e) => (
          <button
            key={e}
            onClick={() => setEffort(e)}
            style={{
              flex: 1,
              padding: '12px 4px',
              borderRadius: '12px',
              border: `1px solid ${effort === e ? 'rgba(143, 201, 111, 0.36)' : 'var(--line)'}`,
              background: effort === e ? 'rgba(143, 201, 111, 0.12)' : 'rgba(255, 255, 255, 0.035)',
              color: effort === e ? 'var(--green)' : 'var(--soft)',
              fontSize: '0.8rem',
              fontWeight: 800,
            }}
          >
            {e}
          </button>
        ))}
      </div>

      <textarea value={note} onChange={(e) => setNote(e.target.value)} placeholder="Optional note for coach" style={{ ...inputStyle, minHeight: '80px', marginBottom: 16, resize: 'none' }} />
      <button className="primary-action" style={{ width: '100%', padding: '14px' }} onClick={submitQuickLog}>Log Session</button>
      {feedback && <p style={{ color: 'var(--green)', marginTop: 14, textAlign: 'center', fontWeight: 700 }}>{feedback}</p>}
    </Card>
  );
}

function formatTimer(totalSeconds: number) {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
}

createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
