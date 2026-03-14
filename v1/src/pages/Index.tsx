import { PortalNav } from '@/components/shared/PortalNav';
import { Link } from 'react-router-dom';
import { FileText, UserPlus, Stethoscope, FlaskConical, Pill, Monitor, Users, Activity, AlertTriangle, Wifi, WifiOff } from 'lucide-react';
import { usePatientStore } from '@/lib/patientStore';
import { useState, useEffect } from 'react';
import { checkHealth, type HealthStatus } from '@/lib/api';

const portals = [
  { to: '/reception', label: 'Reception', desc: 'Scan Aadhaar & register patients', icon: UserPlus, color: 'bg-gradient-to-br from-emerald-500 to-emerald-600' },
  { to: '/doctor', label: 'Doctor Portal', desc: 'Consult, diagnose, and prescribe', icon: Stethoscope, color: 'bg-gradient-to-br from-blue-500 to-blue-600' },
  { to: '/lab', label: 'Laboratory', desc: 'Process tests and submit results', icon: FlaskConical, color: 'bg-gradient-to-br from-amber-500 to-amber-600' },
  { to: '/pharmacy', label: 'Pharmacy', desc: 'Verify and dispense medications', icon: Pill, color: 'bg-gradient-to-br from-rose-500 to-rose-600' },
  { to: '/waiting-display', label: 'TV Queue Display', desc: 'Full-screen waiting room monitor', icon: Monitor, color: 'bg-gradient-to-br from-violet-500 to-violet-600' },
  { to: '/records', label: 'Master Records', desc: 'Search and view patient history', icon: FileText, color: 'bg-gradient-to-br from-slate-600 to-slate-700' },
];

const Index = () => {
  const store = usePatientStore();
  const activeVisits = store.getActiveVisits();
  const criticalCount = activeVisits.filter(v => v.severity === 'HIGH').length;
  const labPending = store.getVisitsWithPendingTests().length;
  const rxPending = store.getVisitsWithPendingPrescriptions().length;
  const [health, setHealth] = useState<HealthStatus | null>(null);
  const [backendOnline, setBackendOnline] = useState<boolean | null>(null);

  useEffect(() => {
    checkHealth().then(h => {
      if (h) { setHealth(h); setBackendOnline(true); }
      else { setBackendOnline(false); }
    });
  }, []);

  return (
    <div className="min-h-screen bg-background">
      <PortalNav />
      <div className="mx-auto max-w-6xl px-6 py-12">
        {/* Header */}
        <div className="text-center">
          <h1 className="font-display text-4xl font-bold text-foreground">VaidikaAI</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            AI-powered healthcare · Zero paper · Zero language barriers
          </p>
        </div>

        <div className="mt-10 flex gap-8">
          {/* Left — Portal Cards */}
          <div className="flex-1">
            <h2 className="mb-4 text-xs font-bold uppercase tracking-widest text-muted-foreground">Portals</h2>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {portals.map(p => (
                <Link key={p.to} to={p.to} className="group rounded-xl border bg-card p-5 text-left transition-all duration-fast hover:border-action/40 hover:shadow-lg hover:-translate-y-0.5">
                  <div className={`flex h-10 w-10 items-center justify-center rounded-lg ${p.color} shadow-md`}>
                    <p.icon className="h-5 w-5 text-white" />
                  </div>
                  <h2 className="mt-3 font-display text-base font-bold text-foreground">{p.label}</h2>
                  <p className="mt-1 text-xs text-muted-foreground">{p.desc}</p>
                </Link>
              ))}
            </div>
          </div>

          {/* Right — Live Stats */}
          <div className="w-80 shrink-0 space-y-4">
            <h2 className="mb-4 text-xs font-bold uppercase tracking-widest text-muted-foreground">Live Status</h2>

            {/* Stats cards */}
            <div className="rounded-xl border bg-card p-4 space-y-3">
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-500/10">
                  <Users className="h-4 w-4 text-blue-500" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Today's Patients</p>
                  <p className="font-display text-xl font-bold text-foreground">{store.visits.length}</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-500/10">
                  <Activity className="h-4 w-4 text-emerald-500" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Active Right Now</p>
                  <p className="font-display text-xl font-bold text-foreground">{activeVisits.length}</p>
                </div>
              </div>
              {criticalCount > 0 && (
                <div className="flex items-center gap-3 rounded-lg border border-critical/30 bg-critical/5 p-2">
                  <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-critical/10">
                    <AlertTriangle className="h-4 w-4 text-critical" />
                  </div>
                  <div>
                    <p className="text-xs text-critical">Critical Alerts</p>
                    <p className="font-display text-xl font-bold text-critical">{criticalCount}</p>
                  </div>
                </div>
              )}
            </div>

            {/* Backend Status */}
            <div className={`rounded-xl border p-4 ${backendOnline === false ? 'border-amber-500/30 bg-amber-500/5' : backendOnline === true ? 'border-emerald-500/30 bg-emerald-500/5' : 'border-border bg-card'}`}>
              <div className="flex items-center gap-3">
                <div className={`flex h-9 w-9 items-center justify-center rounded-lg ${backendOnline ? 'bg-emerald-500/10' : 'bg-amber-500/10'}`}>
                  {backendOnline ? <Wifi className="h-4 w-4 text-emerald-500" /> : <WifiOff className="h-4 w-4 text-amber-500" />}
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Backend Status</p>
                  {backendOnline === null && <p className="text-xs font-medium text-muted-foreground">Checking...</p>}
                  {backendOnline === true && health && (
                    <p className="text-xs font-medium text-emerald-600">
                      Connected · Voice {health.voice_enabled ? '✓' : '✗'} · AI {health.agent_enabled ? '✓' : '✗'}
                    </p>
                  )}
                  {backendOnline === false && (
                    <p className="text-xs font-medium text-amber-600">Offline — demo mode</p>
                  )}
                </div>
              </div>
            </div>

            {/* Queue preview */}
            <div className="rounded-xl border bg-card p-4">
              <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Queue</p>
              <div className="mt-3 space-y-2">
                {activeVisits.slice(0, 4).map(v => (
                  <div key={v.id} className="flex items-center justify-between rounded-md bg-muted/30 px-3 py-2">
                    <div className="flex items-center gap-2">
                      <span className={`h-2 w-2 rounded-full ${v.severity === 'HIGH' ? 'bg-critical' : 'bg-emerald-500'}`} />
                      <span className="text-xs font-medium text-foreground">Token {v.tokenNumber}</span>
                    </div>
                    <span className="text-xs text-muted-foreground">{v.assignedRoom || 'Waiting'}</span>
                  </div>
                ))}
                {activeVisits.length === 0 && (
                  <p className="text-xs text-muted-foreground text-center py-2">No patients in queue</p>
                )}
              </div>
            </div>

            {/* Pending work */}
            <div className="rounded-xl border bg-card p-4">
              <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Pending Work</p>
              <div className="mt-3 space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">Lab Tests Pending</span>
                  <span className="font-bold text-foreground">{labPending}</span>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">Prescriptions Pending</span>
                  <span className="font-bold text-foreground">{rxPending}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Index;
