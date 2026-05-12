import React, { useEffect, useMemo, useState } from 'react';
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

function App() {
  const [activeTab, setActiveTab] = useState<TabId>('home');
  const [expanded, setExpanded] = useState('mission');
  const [timer, setTimer] = useState(18 * 60 + 42);
  const activeIndex = tabs.findIndex((tab) => tab.id === activeTab);

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
        {activeTab === 'home' && <Home expanded={expanded} setExpanded={setExpanded} />}
        {activeTab === 'train' && <Train timer={timer} />}
        {activeTab === 'tactical' && <Tactical timer={timer} />}
        {activeTab === 'recovery' && <Recovery />}
        {activeTab === 'team' && <Team />}
        {activeTab === 'profile' && <Profile />}
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

function Home({ expanded, setExpanded }: { expanded: string; setExpanded: (id: string) => void }) {
  return (
    <>
      <section className="hero-grid">
        <ReadinessCard />
        <MissionCard expanded={expanded === 'mission'} onToggle={() => setExpanded(expanded === 'mission' ? '' : 'mission')} />
      </section>
      <QuickActions />
      <div className="stats-row">
        <MiniStat label="HRV" value={readiness.hrv} />
        <MiniStat label="Sleep" value={readiness.sleep} />
        <MiniStat label="Strain" value={readiness.strain} />
      </div>
      <Card title="Recent Activity" action="All logs">
        <div className="activity-list">
          {recentActivity.map((item) => (
            <div className="activity-item" key={item.title}>
              <span>{item.type}</span>
              <div>
                <strong>{item.title}</strong>
                <p>{item.result}</p>
              </div>
              <time>{item.time}</time>
            </div>
          ))}
        </div>
      </Card>
    </>
  );
}

function Train({ timer }: { timer: number }) {
  return (
    <>
      <Card className="timer-card">
        <p className="eyebrow">Live Training Window</p>
        <div className="timer-row">
          <div>
            <h2>{formatTimer(timer)}</h2>
            <p>Zone 3 ruck intervals active</p>
          </div>
          <button className="primary-action">Start</button>
        </div>
      </Card>
      <div className="action-grid">
        {trainingBlocks.map((block) => (
          <button className="action-card" key={block.name}>
            <span>{block.action}</span>
            <strong>{block.name}</strong>
            <p>{block.detail}</p>
          </button>
        ))}
      </div>
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

function Recovery() {
  return (
    <>
      <Card className="recovery-score">
        <p className="eyebrow">Recovery Score</p>
        <div className="score-line">
          <ProgressRing value={82} label="82" />
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
            <label key={action}>
              <input type="checkbox" />
              <span>{action}</span>
            </label>
          ))}
        </div>
      </Card>
    </>
  );
}

function Team() {
  return (
    <>
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
                <span style={{ width: `${challenge.progress}%` }} />
              </div>
            </div>
          ))}
        </div>
      </Card>
    </>
  );
}

function Profile() {
  return (
    <>
      <Card className="profile-card">
        <p className="eyebrow">Operator Profile</p>
        <h2>{profile.name}</h2>
        <p>{profile.rank} · {profile.streak} operational streak</p>
        <div className="rank-track">
          <span style={{ width: `${profile.nextRank}%` }} />
        </div>
        <small>{profile.nextRank}% to next rank · {profile.missions} completed missions</small>
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

function ReadinessCard() {
  return (
    <Card className="readiness-card">
      <p className="eyebrow">Readiness</p>
      <div className="readiness-layout">
        <ProgressRing value={readiness.score} label={String(readiness.score)} />
        <div>
          <h2>{readiness.status}</h2>
          <p>{readiness.delta}</p>
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

function QuickActions() {
  return (
    <div className="quick-actions">
      {['Start', 'Log', 'Route', 'Recover'].map((action) => (
        <button key={action}>{action}</button>
      ))}
    </div>
  );
}

function Card({
  title,
  action,
  className = '',
  children,
}: {
  title?: string;
  action?: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <section className={`card ${className}`}>
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

function ProgressRing({ value, label }: { value: number; label: string }) {
  const style = useMemo(() => ({ '--value': `${value * 3.6}deg` }) as React.CSSProperties, [value]);
  return (
    <div className="progress-ring" style={style}>
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
        <span key={index} style={{ height: `${value}%` }} />
      ))}
    </div>
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
