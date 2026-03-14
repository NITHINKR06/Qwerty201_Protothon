import { useEffect, useState } from 'react';
import { usePatientStore } from '@/lib/patientStore';

export default function WaitingDisplayPage() {
  const store = usePatientStore();
  const [time, setTime] = useState(new Date());

  useEffect(() => {
    const interval = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(interval);
  }, []);

  const activeVisits = store.getActiveVisits();

  const severityGlow: Record<string, string> = {
    HIGH: 'border-red-500/60 shadow-[0_0_20px_rgba(239,68,68,0.3)]',
    MEDIUM: 'border-amber-500/40',
    STABLE: 'border-emerald-500/30',
  };

  return (
    <div className="min-h-screen bg-[#0a0e1a] text-white overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-white/10 bg-gradient-to-r from-[#0f1629] to-[#1a1f3a] px-8 py-5">
        <div className="flex items-center gap-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 text-xl font-bold shadow-lg shadow-blue-500/30">
            V
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight" style={{ fontFamily: 'var(--font-display)' }}>
              VaidikaAI Health Centre
            </h1>
            <p className="text-sm text-blue-300/70">Smart Queue Management System</p>
          </div>
        </div>
        <div className="text-right">
          <p className="text-3xl font-bold tabular-nums tracking-wider text-blue-200" style={{ fontFamily: 'var(--font-display)' }}>
            {time.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true })}
          </p>
          <p className="text-sm text-blue-300/60">
            {time.toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
          </p>
        </div>
      </div>

      {/* Title Bar */}
      <div className="bg-gradient-to-r from-blue-600/20 via-indigo-600/20 to-blue-600/20 px-8 py-4 backdrop-blur">
        <h2 className="text-center text-3xl font-bold tracking-widest text-blue-100" style={{ fontFamily: 'var(--font-display)' }}>
          NOW SERVING
        </h2>
      </div>

      {/* Queue Grid */}
      <div className="p-8">
        {activeVisits.length === 0 ? (
          <div className="flex min-h-[60vh] items-center justify-center">
            <div className="text-center">
              <p className="text-6xl">🏥</p>
              <p className="mt-4 text-2xl text-blue-300/50" style={{ fontFamily: 'var(--font-display)' }}>
                No patients in queue
              </p>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {activeVisits.map((v, idx) => (
              <div
                key={v.id}
                className={`group relative overflow-hidden rounded-2xl border-2 bg-gradient-to-br from-[#131831] to-[#1a2040] p-6 transition-all duration-500 hover:scale-[1.02] ${severityGlow[v.severity] || 'border-white/10'}`}
                style={{ animationDelay: `${idx * 100}ms` }}
              >
                {/* Severity indicator */}
                {v.severity === 'HIGH' && (
                  <div className="absolute right-3 top-3 flex items-center gap-1.5 rounded-full bg-red-500/20 px-2.5 py-1 text-xs font-bold text-red-400">
                    <span className="h-2 w-2 animate-pulse rounded-full bg-red-500" />
                    URGENT
                  </div>
                )}

                {/* Token Number — Giant */}
                <div className="flex items-baseline gap-2">
                  <span className="text-sm font-medium uppercase tracking-widest text-blue-400/60">Token</span>
                </div>
                <p className="mt-1 text-7xl font-black tabular-nums tracking-tight text-white" style={{ fontFamily: 'var(--font-display)' }}>
                  {v.tokenNumber}
                </p>

                {/* Patient name */}
                <p className="mt-3 text-lg font-semibold text-blue-100 truncate">
                  {v.patient.name}
                </p>

                {/* Room + Doctor */}
                <div className="mt-4 flex items-center gap-3 rounded-xl bg-white/5 px-4 py-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-gradient-to-br from-indigo-500 to-blue-600 text-sm font-bold shadow-lg">
                    →
                  </div>
                  <div>
                    <p className="text-base font-bold text-white">{v.assignedRoom || 'Waiting'}</p>
                    <p className="text-sm text-blue-300/60">{v.assignedDoctor || 'Assigning...'}</p>
                  </div>
                </div>

                {/* Status pill */}
                <div className="mt-3 flex items-center gap-2">
                  <span className={`h-2 w-2 rounded-full ${
                    v.status === 'registered' ? 'bg-blue-400 animate-pulse' :
                    v.status === 'in-consultation' ? 'bg-emerald-400 animate-pulse' :
                    v.status === 'lab-pending' ? 'bg-amber-400 animate-pulse' :
                    v.status === 'pharmacy-pending' ? 'bg-purple-400 animate-pulse' :
                    'bg-emerald-400'
                  }`} />
                  <span className="text-xs font-medium uppercase tracking-wider text-blue-300/50">
                    {v.status === 'registered' ? 'Waiting' :
                     v.status === 'in-consultation' ? 'With Doctor' :
                     v.status === 'lab-pending' ? 'In Lab' :
                     v.status === 'lab-complete' ? 'Lab Done' :
                     v.status === 'pharmacy-pending' ? 'At Pharmacy' :
                     v.status === 'dispensed' ? 'Medicines Ready' :
                     v.status}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Footer ticker */}
      <div className="fixed bottom-0 left-0 right-0 border-t border-white/10 bg-[#0a0e1a]/90 px-8 py-3 backdrop-blur">
        <div className="flex items-center justify-between text-sm text-blue-300/40">
          <span>📋 {activeVisits.length} patients in queue</span>
          <span>VaidikaAI — Zero paper. Zero confusion.</span>
          <span>🔄 Auto-refreshing</span>
        </div>
      </div>
    </div>
  );
}
