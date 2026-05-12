import React, { useEffect, useMemo, useState, useRef } from 'react';
import { createRoot } from 'react-dom/client';
import { createClient, Session } from '@supabase/supabase-js';
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

/// <reference types="vite/client" />

interface AppState {
  readiness: number;
  weeklyVolume: number;
  ghostMode: boolean;
  activities: Array<{ id: string; hypes: number; [key: string]: any }>;
  assignedWorkout: {
    title: string;
    status: string;
    exercises: Array<{ id: string; name: string; dose: string; hit: boolean; coachPick: boolean }>;
  };
}

const quickLogKinds = ['Run', 'Ruck', 'Cardio', 'Strength', 'Workout', 'Mobility'];
const efforts = ['Too Easy', 'About Right', 'Too Hard'];

function estimateQuickLogVolume(kind: string, durationMinutes: number) {
  const rate = kind === 'Strength' || kind === 'Workout' ? 10
    : kind === 'Ruck' ? 8
    : kind === 'Run' || kind === 'Cardio' ? 6 : 2;
  return Math.max(rate * Math.max(durationMinutes, 1), kind === 'Mobility' ? 20 : 60);
}

// Initialize Supabase client for Vite Web
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';
const supabase = supabaseUrl && supabaseKey ? createClient(supabaseUrl, supabaseKey) : null;

function AuthScreen({ inviteToken }: { inviteToken?: string | null }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [isSignUp, setIsSignUp] = useState(false);

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    if (isSignUp) {
      const { error } = await supabase!.auth.signUp({ email, password });
      if (error) alert(error.message);
      else alert('Check your email for the login link or verify your account!');
    } else {
      const { error } = await supabase!.auth.signInWithPassword({ email, password });
      if (error) alert(error.message);
    }
    setLoading(false);
  };

  const inputStyle: React.CSSProperties = {
    width: '100%', padding: '12px', borderRadius: '14px',
    background: 'rgba(255, 255, 255, 0.035)', border: '1px solid var(--line)',
    color: 'var(--text)', fontSize: '1rem', outline: 'none', marginBottom: 14
  };

  return (
    <div className="app-shell" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh' }}>
      <div className="ambient-map" aria-hidden="true" />
      <Card className="metric-card" style={{ width: '100%', maxWidth: 400, padding: 24, margin: 'auto' }}>
        <h1 style={{ fontSize: '1.5rem', marginBottom: 8, textAlign: 'center' }}>FORGE</h1>
        <p style={{ textAlign: 'center', marginBottom: 24, color: inviteToken ? 'var(--amber)' : 'var(--muted)', fontWeight: inviteToken ? 700 : 400 }}>
          {inviteToken ? 'Sign in or sign up to join your squad' : 'Tactical Performance OS'}
        </p>
        <form onSubmit={handleAuth}>
          <label style={{ display: 'block', fontSize: '0.72rem', color: 'var(--muted)', fontWeight: 800, textTransform: 'uppercase', marginBottom: 6 }}>Email</label>
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} style={inputStyle} required />
          <label style={{ display: 'block', fontSize: '0.72rem', color: 'var(--muted)', fontWeight: 800, textTransform: 'uppercase', marginBottom: 6 }}>Password</label>
          <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} style={inputStyle} required />
          <button type="submit" className="primary-action" style={{ width: '100%', padding: '14px', marginBottom: 14 }} disabled={loading}>{loading ? 'Processing...' : (isSignUp ? 'Sign Up' : 'Sign In')}</button>
          <button type="button" onClick={() => setIsSignUp(!isSignUp)} style={{ width: '100%', background: 'transparent', border: 'none', color: 'var(--amber)', cursor: 'pointer', fontWeight: 700 }}>{isSignUp ? 'Already have an account? Sign In' : "Don't have an account? Sign Up"}</button>
        </form>
      </Card>
    </div>
  );
}

function App() {
  const [activeTab, setActiveTab] = useState<TabId>('home');
  const [expanded, setExpanded] = useState('mission');
  const [timer, setTimer] = useState(18 * 60 + 42);
  const activeIndex = tabs.findIndex((tab) => tab.id === activeTab);
  const [isSynced, setIsSynced] = useState(false);
  const [session, setSession] = useState<Session | null>(null);
  const [membership, setMembership] = useState<{ squad_id: string, id: string } | null>(null);
  const [inviteToken, setInviteToken] = useState<string | null>(null);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const token = params.get('invite');
      if (token) setInviteToken(token);
    }
  }, []);

  // Centralized Application State (Simulating temp.tsx logic)
  const [appState, setAppState] = useState(() => {
    const savedState = localStorage.getItem('forge:appState');
    if (savedState) {
      try {
        return JSON.parse(savedState);
      } catch (e) {
        console.error('Failed to load saved state', e);
      }
    }
    return {
      readiness: readiness.score || 82,
      weeklyVolume: 8200,
      ghostMode: false,
      activities: recentActivity.map((a, i) => ({ ...a, id: String(i), hypes: 0 })),
      assignedWorkout: {
        title: 'Operator Base',
        status: 'assigned',
        exercises: [
          { id: 'e1', name: 'Heavy Ruck', dose: '45 min @ 45lbs', hit: false, coachPick: true },
          { id: 'e2', name: 'Sandbag Cleans', dose: '4x8', hit: false, coachPick: false },
          { id: 'e3', name: 'Farmer Carry', dose: '400m', hit: false, coachPick: false }
        ]
      }
    };
  });

  useEffect(() => {
    localStorage.setItem('forge:appState', JSON.stringify(appState));
  }, [appState]);

  // Authentication & Membership Hydration
  useEffect(() => {
    if (!supabase) return;
    supabase.auth.getSession().then(({ data: { session } }) => setSession(session));
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => setSession(session));
    return () => { subscription.unsubscribe(); };
  }, []);

  useEffect(() => {
    if (session && supabase) {
      supabase.from('squad_memberships')
        .select('id, squad_id')
        .eq('user_id', session.user.id)
        .eq('status', 'active')
        .limit(1)
        .then(({ data }) => {
          if (data && data.length > 0) setMembership(data[0]);
          else setMembership(null);
        });
    } else {
      setMembership(null);
    }
  }, [session]);

  // Invite Claiming Flow
  const handleClaimInvite = async (token: string) => {
    if (!session || !supabase) return false;
    
    try {
      const { data, error } = await supabase.rpc('claim_member_invite', { p_token: token });
      if (error) throw error;
      
      alert('Successfully joined the squad!');
      
      // Clean up the URL so it doesn't try to claim again on refresh
      const url = new URL(window.location.href);
      if (url.searchParams.get('invite')) {
        url.searchParams.delete('invite');
        window.history.replaceState({}, '', url.toString());
        setInviteToken(null);
      }
      
      if (data) {
        setMembership({ id: data.id, squad_id: data.squad_id });
        
        // Automatically sync the assigned workout
        const { data: assignments } = await supabase
          .from('assignments')
          .select('*, assignment_exercises(*)')
          .eq('assignee_membership_id', data.id)
          .eq('status', 'assigned')
          .order('created_at', { ascending: false })
          .limit(1);
          
        if (assignments && assignments.length > 0) {
          const assignment = assignments[0];
          // @ts-ignore
          setAppState(prev => ({
            ...prev,
            assignedWorkout: {
              title: assignment.title,
              status: 'assigned',
              exercises: (assignment.assignment_exercises || [])
                .sort((a: any, b: any) => a.order_index - b.order_index)
                .map((ex: any) => ({ id: ex.id, name: ex.name, dose: ex.dose, hit: false, coachPick: ex.coach_pinned }))
            }
          }));
        }
      }
      return true;
    } catch (err: any) {
      alert('Failed to claim invite: ' + err.message);
      if (inviteToken) setInviteToken(null);
      return false;
    }
  };

  useEffect(() => {
    if (session && inviteToken) {
      handleClaimInvite(inviteToken);
    }
  }, [session, inviteToken]);

  // Real-time Supabase Subscription
  useEffect(() => {
    if (!supabase || !isSynced || !membership) return;
    const channel = supabase.channel('public:team_activity')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'team_activity' }, (payload) => {
        const newActivity = payload.new;
        // @ts-ignore
        setAppState(prev => {
          // Prevent duplicate if we just inserted it locally
          if (prev.activities.some((a: any) => a.id === newActivity.id)) return prev;
          return {
            ...prev,
            activities: [{
              id: newActivity.id,
              type: newActivity.type,
              title: newActivity.title,
              result: newActivity.metadata?.result || 'Completed',
              time: 'Just now',
              hypes: 0
            }, ...prev.activities]
          };
        });
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [isSynced]);

  const handleLogSession = (workout: { type: string, title: string, volume: number, duration: number, effort: string, note?: string }) => {
    const newActivityId = typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : Date.now().toString();
    const title = appState.ghostMode ? 'A teammate logged activity' : `You finished ${workout.title}`;
    const result = `${workout.duration} min · +${workout.volume} vol`;

    // @ts-ignore
    setAppState(prev => ({
      ...prev,
      weeklyVolume: prev.weeklyVolume + workout.volume,
      readiness: Math.min(100, Math.max(1, prev.readiness + (workout.effort === 'Too Hard' ? -3 : workout.effort === 'Too Easy' ? 2 : 1))),
      activities: [
        {
          id: newActivityId,
          type: workout.type,
          title,
          result,
          time: 'Just now',
          hypes: 0
        },
        ...prev.activities
      ]
    }));

    // Push to Supabase if connected
    if (supabase && isSynced && membership && session) {
      // @ts-ignore
      supabase.from('team_activity').insert({
        id: newActivityId,
        squad_id: membership.squad_id, 
        actor_membership_id: membership.id,
        activity_type: 'workout_completed', 
        title,
        metadata: { 
          result,
          original_type: workout.type
        }
      }).catch(console.error);
      
      // Write to workout_completions so the coach sees it
      supabase.from('workout_completions').insert({
        id: newActivityId,
        user_id: session.user.id,
        squad_id: membership.squad_id,
        membership_id: membership.id,
        member_id: membership.id, // Fallback for legacy views
        member_name: session.user.email || 'Member',
        group_id: 'default',
        completion_type: workout.title.startsWith('Quick Log') ? 'quick_log' : 'assigned',
        session_kind: workout.type,
        assignment: workout.title,
        effort: workout.effort,
        duration_minutes: workout.duration,
        volume: workout.volume,
        note: workout.note || null,
        completed_at: new Date().toISOString()
      }).catch(console.error);
    }
  };

  const handleHype = (id: string) => {
    // @ts-ignore
    setAppState(prev => ({
      ...prev,
      activities: prev.activities.map((a: any) => a.id === id ? { ...a, hypes: a.hypes + 1 } : a)
    }));
  };

  const handleHitExercise = (exerciseId: string) => {
    // @ts-ignore
    setAppState(prev => ({
      ...prev,
      assignedWorkout: {
        ...prev.assignedWorkout,
        exercises: prev.assignedWorkout.exercises.map((ex: any) => 
          ex.id === exerciseId ? { ...ex, hit: !ex.hit } : ex
        )
      }
    }));
    window.navigator.vibrate?.(12);
  };

  const handleCompleteAssigned = () => {
    // @ts-ignore
    setAppState(prev => ({ ...prev, assignedWorkout: { ...prev.assignedWorkout, status: 'completed' } }));
  };

  const handleClearData = () => {
    // Using the web-safe window.confirm per your README notes for PWA support
    if (window.confirm("OPSEC Wipe: Are you sure you want to delete all local data? This cannot be undone.")) {
      localStorage.removeItem('forge:appState');
      setAppState({
        readiness: readiness.score || 82,
        weeklyVolume: 8200,
        ghostMode: false,
        activities: recentActivity.map((a, i) => ({ ...a, id: String(i), hypes: 0 })),
        assignedWorkout: {
          title: 'Operator Base',
          status: 'assigned',
          exercises: [
            { id: 'e1', name: 'Heavy Ruck', dose: '45 min @ 45lbs', hit: false, coachPick: true },
            { id: 'e2', name: 'Sandbag Cleans', dose: '4x8', hit: false, coachPick: false },
            { id: 'e3', name: 'Farmer Carry', dose: '400m', hit: false, coachPick: false }
          ]
        }
      });
      window.navigator.vibrate?.([50, 100, 50]); // Distinct "destructive" haptic pattern
    }
  };

  const handleCloudSync = async () => {
    if (!supabase) {
      alert("Supabase is missing! Create a .env file with VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.");
      return;
    }
    if (!membership) {
      alert("No active squad membership found. You are logged in, but not part of a squad yet.");
      return;
    }
    try {
      // Pull the latest 10 activities to hydrate the feed
      const { data: activityData } = await supabase.from('team_activity').select('*').eq('squad_id', membership.squad_id).order('created_at', { ascending: false }).limit(10);
      
      // Pull the latest assigned workout
      const { data: assignments } = await supabase
        .from('assignments')
        .select('*, assignment_exercises(*)')
        .eq('assignee_membership_id', membership.id)
        .eq('status', 'assigned')
        .order('created_at', { ascending: false })
        .limit(1);

      // @ts-ignore
      setAppState(prev => ({
        ...prev,
        ...(activityData && activityData.length > 0 ? {
          activities: activityData.map((d: any) => ({
            id: d.id,
            type: d.metadata?.original_type || 'Workout',
            title: d.title,
            result: d.metadata?.result || '',
            time: new Date(d.created_at).toLocaleDateString(),
            hypes: 0
          }))
        } : {}),
        ...(assignments && assignments.length > 0 ? {
          assignedWorkout: {
            title: assignments[0].title,
            status: 'assigned',
            exercises: (assignments[0].assignment_exercises || [])
              .sort((a: any, b: any) => a.order_index - b.order_index)
              .map((ex: any) => ({ id: ex.id, name: ex.name, dose: ex.dose, hit: false, coachPick: ex.coach_pinned }))
          }
        } : {})
      }));
      setIsSynced(true);
    } catch (error) {
      console.error('Failed to sync', error);
    }
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

  if (supabase && !session) {
    return <AuthScreen inviteToken={inviteToken} />;
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
        {activeTab === 'train' && <Train timer={timer} onLog={handleLogSession} assignedWorkout={appState.assignedWorkout} onHitExercise={handleHitExercise} onComplete={handleCompleteAssigned} />}
        {activeTab === 'tactical' && <Tactical timer={timer} />}
        {activeTab === 'recovery' && <Recovery readiness={appState.readiness} />}
        {activeTab === 'team' && <Team weeklyVolume={appState.weeklyVolume} />}
        {activeTab === 'profile' && <Profile ghostMode={appState.ghostMode} setGhostMode={(val: boolean) => setAppState((p: AppState) => ({...p, ghostMode: val}))} onLog={handleLogSession} onClearData={handleClearData} onSync={handleCloudSync} isSynced={isSynced} session={session} membership={membership} onClaimInvite={handleClaimInvite} />}
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
  const [dateOffset, setDateOffset] = useState(0);

  const changeDate = (dir: number) => {
    setDateOffset(prev => prev + dir);
    window.navigator.vibrate?.(12);
  };

  const dateLabel = dateOffset === 0 ? "Today's Activity" : dateOffset === -1 ? "Yesterday's Activity" : `${Math.abs(dateOffset)} days ago`;

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
      <Card>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <button onClick={() => changeDate(-1)} style={{ background: 'transparent', border: 'none', color: 'var(--green)', fontSize: '1.4rem', cursor: 'pointer', padding: '0 10px' }}>&lsaquo;</button>
          <h2 style={{ fontSize: '1rem', color: 'var(--text)' }}>{dateLabel}</h2>
          <button onClick={() => changeDate(1)} disabled={dateOffset === 0} style={{ background: 'transparent', border: 'none', color: 'var(--green)', fontSize: '1.4rem', cursor: 'pointer', padding: '0 10px', opacity: dateOffset === 0 ? 0.3 : 1 }}>&rsaquo;</button>
        </div>
        <div className="activity-list">
          {appState.activities.length > 0 ? appState.activities.map((item: any) => (
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
          )) : <p style={{ color: 'var(--muted)', textAlign: 'center', padding: '20px 0' }}>No activity logged.</p>}
        </div>
      </Card>
    </>
  );
}

function Train({ timer, onLog, assignedWorkout, onHitExercise, onComplete }: { timer: number; onLog: (data: any) => void; assignedWorkout: any; onHitExercise: (id: string) => void; onComplete: () => void }) {
  const [isTraining, setIsTraining] = useState(false);
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
      {assignedWorkout.status === 'assigned' ? (
        <Card title="Current Workout" action={assignedWorkout.title} className="metric-card">
          <div className="checkpoint-list">
            {assignedWorkout.exercises.map((ex: any) => (
              <div className={`checkpoint-row ${ex.hit ? 'active' : ''}`} key={ex.id}>
                <span>{ex.coachPick ? "Coach's Pick" : "Assigned"}</span>
                <div style={{ flex: 1 }}>
                  <strong style={{ display: 'block', marginBottom: 4 }}>{ex.name}</strong>
                  <span style={{ color: 'var(--muted)', fontSize: '0.8rem' }}>{ex.dose}</span>
                </div>
                <button 
                  onClick={() => onHitExercise(ex.id)}
                  style={{
                    background: ex.hit ? 'var(--green)' : 'transparent',
                    border: `1px solid var(--green)`,
                    color: ex.hit ? '#000' : 'var(--green)',
                    padding: '6px 16px',
                    borderRadius: '12px',
                    fontSize: '0.8rem',
                    fontWeight: 800,
                    cursor: 'pointer'
                  }}
                >
                  {ex.hit ? 'Hit' : 'Mark'}
                </button>
              </div>
            ))}
          </div>
          <div style={{ marginTop: 24 }}>
            <p className="eyebrow">Finish Session</p>
            <div style={{ display: 'flex', gap: 8, marginBottom: 14, marginTop: 8 }}>
              {efforts.map((e) => (
                <button key={e} onClick={() => setEffort(e)} style={{ flex: 1, padding: '10px 4px', borderRadius: '12px', border: `1px solid ${effort === e ? 'rgba(143, 201, 111, 0.36)' : 'var(--line)'}`, background: effort === e ? 'rgba(143, 201, 111, 0.12)' : 'rgba(255, 255, 255, 0.035)', color: effort === e ? 'var(--green)' : 'var(--soft)', fontSize: '0.75rem', fontWeight: 800 }}>{e}</button>
              ))}
            </div>
            <button className="primary-action" style={{ width: '100%', padding: '12px' }} onClick={() => {
              onLog({ type: 'Workout', title: assignedWorkout.title, volume: 180, duration: Math.max(1, Math.floor(timer / 60)), effort });
              setIsTraining(false);
              onComplete();
              window.navigator.vibrate?.([20, 50, 20]);
            }}>Log & Complete</button>
          </div>
        </Card>
      ) : (
        <div style={{ textAlign: 'center', padding: '24px' }}>
          <Card className="metric-card good">
            <h2 style={{ color: 'var(--green)', marginBottom: 8 }}>Session Complete</h2>
            <p>You have finished your assigned work for today. Outstanding effort.</p>
          </Card>
        </div>
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
      <div style={{ marginBottom: 14 }}>
        <Card className="team-pulse-card">
          <p className="eyebrow">Team Pulse</p>
          <div className="score-line">
            <ProgressRing value={Math.min(100, (weeklyVolume / 10000) * 100)} label={String(Math.min(100, Math.round((weeklyVolume / 10000) * 100)))} />
            <div>
              <h2>{weeklyVolume.toLocaleString()} units</h2>
              <p>of 10,000 squad volume goal this week</p>
            </div>
          </div>
        </Card>
      </div>
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

function Profile({ ghostMode, setGhostMode, onLog, onClearData, onSync, isSynced, session, membership, onClaimInvite }: { ghostMode: boolean; setGhostMode: (val: boolean) => void; onLog: (data: any) => void; onClearData: () => void; onSync: () => Promise<void>; isSynced: boolean; session: Session | null; membership: { squad_id: string, id: string } | null; onClaimInvite: (token: string) => Promise<boolean> }) {
  const [syncing, setSyncing] = useState(false);
  const [inviteCode, setInviteCode] = useState('');
  const [claiming, setClaiming] = useState(false);
  const handleSyncClick = async () => {
    setSyncing(true);
    await onSync();
    setSyncing(false);
  };

  return (
    <>
      <QuickLog onLog={onLog} />
      {session && !membership && (
        <Card title="Join a Squad" className="metric-card warn">
          <p style={{ fontSize: '0.85rem', color: 'var(--muted)', marginBottom: 12, marginTop: 4 }}>You have an account but aren't in a squad yet. Enter an invite code to join.</p>
          <div style={{ display: 'flex', gap: 8 }}>
            <input 
              type="text" 
              value={inviteCode} 
              onChange={(e) => setInviteCode(e.target.value)} 
              placeholder="Invite Code (e.g. 1234-5678...)" 
              style={{ flex: 1, padding: '10px 12px', borderRadius: '12px', background: 'rgba(255, 255, 255, 0.035)', border: '1px solid var(--line)', color: 'var(--text)', outline: 'none' }}
            />
            <button 
              onClick={async () => {
                if (!inviteCode.trim()) return;
                setClaiming(true);
                const success = await onClaimInvite(inviteCode.trim());
                if (success) setInviteCode('');
                setClaiming(false);
              }}
              disabled={claiming}
              style={{ background: 'var(--amber)', color: '#000', padding: '0 16px', borderRadius: '12px', fontWeight: 800, cursor: 'pointer', border: 'none', opacity: claiming ? 0.7 : 1 }}
            >
              {claiming ? '...' : 'Join'}
            </button>
          </div>
        </Card>
      )}
      <Card title="Cloud Sync">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 14 }}>
          <div style={{ flex: 1 }}>
            <strong style={{ color: 'var(--text)', display: 'block', marginBottom: 4 }}>Data is Local Only</strong>
            <p style={{ fontSize: '0.8rem', margin: 0, lineHeight: 1.4 }}>Connect to Supabase to backup your logs and sync with your coach.</p>
          </div>
          <button 
            onClick={handleSyncClick}
            style={{
              background: syncing || isSynced ? 'transparent' : 'rgba(217, 142, 58, 0.11)',
              border: `1px solid ${syncing || isSynced ? 'var(--line)' : 'rgba(217, 142, 58, 0.48)'}`,
              color: syncing || isSynced ? 'var(--soft)' : 'var(--amber)',
              padding: '8px 16px',
              borderRadius: '12px',
              fontWeight: 800,
              cursor: 'pointer'
            }}
          >
            {syncing ? 'Syncing...' : isSynced ? 'Synced' : 'Sync Now'}
          </button>
        </div>
      </Card>
      <Card className="profile-card">
        <p className="eyebrow">Operator Profile</p>
        <h2>{profile.name}</h2>
        <p>{session ? session.user.email : profile.rank} · {profile.streak} operational streak</p>
        {session && (
          <button 
            onClick={() => supabase?.auth.signOut()}
            style={{ background: 'transparent', border: '1px solid var(--line)', color: 'var(--text)', padding: '6px 12px', borderRadius: 8, marginTop: 12, fontSize: '0.8rem', cursor: 'pointer' }}
          >
            Sign Out
          </button>
        )}
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
      <Card title="Danger Zone" className="metric-card danger">
        <p style={{ marginBottom: 14 }}>Wipe all local session data and reset to default mock state.</p>
        <button 
          className="primary-action" 
          onClick={onClearData}
          style={{ background: 'linear-gradient(180deg, #d75e4b, #b94b3a)', color: '#fff', width: '100%', padding: '12px', boxShadow: '0 14px 34px rgba(215, 94, 75, 0.22)' }}
        >
          OPSEC Wipe
        </button>
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
  children,
  style,
}: {
  title?: string;
  action?: string;
  className?: string;
  children: React.ReactNode;
  style?: React.CSSProperties;
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
      effort,
      note: note.trim() || undefined
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
