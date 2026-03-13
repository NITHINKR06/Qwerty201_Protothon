import { useState, useEffect, useRef } from 'react';
import { PortalNav } from '@/components/shared/PortalNav';
import { Input } from '@/components/ui/input';
import { PatientCard } from '@/components/shared/PatientCard';
import { SeverityBadge } from '@/components/shared/SeverityBadge';
import { VisitTimeline } from '@/components/shared/VisitTimeline';
import { usePatientStore } from '@/lib/patientStore';
import { Visit, TestFlag } from '@/lib/types';
import { Search, Users, Clock, Activity, Printer } from 'lucide-react';
import { Button } from '@/components/ui/button';

const flagColor: Record<TestFlag, string> = {
  NORMAL: 'text-success',
  HIGH: 'text-warning',
  LOW: 'text-warning',
  CRITICAL: 'text-critical',
};

export default function RecordsPage() {
  const store = usePatientStore();
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<Visit | null>(null);
  const [activeTab, setActiveTab] = useState<'timeline' | 'labs' | 'prescriptions' | 'summary'>('timeline');
  const [filter, setFilter] = useState('all');
  const searchRef = useRef<HTMLInputElement>(null);

  useEffect(() => { searchRef.current?.focus(); }, []);

  const filtered = store.visits.filter(v => {
    const matchesSearch = !search || v.patient.name.toLowerCase().includes(search.toLowerCase()) || v.patientId.includes(search);
    const matchesFilter = filter === 'all' || (filter === 'critical' && v.severity === 'HIGH');
    return matchesSearch && matchesFilter;
  });

  // Refresh selected from store
  const currentSelected = selected ? store.visits.find(v => v.id === selected.id) || selected : null;

  const stats = {
    todayVisits: store.visits.length,
    active: store.visits.filter(v => v.status !== 'complete').length,
    avgWait: 14,
  };

  const tabs = [
    { key: 'timeline', label: 'Visit Log' },
    { key: 'labs', label: 'Lab Reports' },
    { key: 'prescriptions', label: 'Prescriptions' },
    { key: 'summary', label: 'AI Summary' },
  ] as const;

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <div className="flex h-14 items-center border-b bg-card px-4">
        <span className="font-display text-lg font-bold text-foreground">VaidikaAI</span>
        <div className="mx-auto flex w-full max-w-lg items-center gap-2 rounded-lg border bg-background px-3 py-1.5">
          <Search className="h-4 w-4 text-muted-foreground" />
          <Input ref={searchRef} value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Search by name or Patient ID" className="border-0 bg-transparent p-0 text-sm shadow-none focus-visible:ring-0" />
        </div>
        <div className="flex items-center gap-3 text-xs text-muted-foreground">
          <span className="flex items-center gap-1"><Users className="h-3.5 w-3.5" />{stats.todayVisits} today</span>
          <span>13 Mar 2025</span>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-4 border-b bg-card px-6 py-4">
        {[
          { label: "Today's Visits", value: stats.todayVisits, sub: `${stats.todayVisits} patients`, icon: Users },
          { label: 'Active Right Now', value: stats.active, sub: `${stats.active} in progress`, icon: Activity },
          { label: 'Avg. Wait Time', value: `${stats.avgWait} min`, sub: '↓3m vs last wk', icon: Clock },
        ].map(s => (
          <div key={s.label} className="rounded-lg border bg-background p-4">
            <div className="flex items-center gap-2 text-xs text-muted-foreground"><s.icon className="h-3.5 w-3.5" />{s.label}</div>
            <p className="mt-1 font-display text-2xl font-bold text-foreground">{s.value}</p>
            <p className="mt-0.5 text-xs text-muted-foreground">{s.sub}</p>
          </div>
        ))}
      </div>

      <div className="flex flex-1">
        <div className="w-3/5 border-r p-4 overflow-y-auto">
          <div className="mb-3 flex gap-2">
            {['all', 'critical'].map(f => (
              <button key={f} onClick={() => setFilter(f)}
                className={`rounded-md px-3 py-1 text-xs font-medium transition-all ${filter === f ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground hover:bg-muted/80'}`}>
                {f === 'all' ? 'All' : 'Critical Only'}
              </button>
            ))}
          </div>
          <div className="space-y-2">
            {filtered.map(v => (
              <PatientCard key={v.id} patient={v.patient} severity={v.severity} chiefComplaint={v.chiefComplaint}
                onClick={() => { setSelected(v); setActiveTab('timeline'); }} selected={currentSelected?.id === v.id} />
            ))}
            {filtered.length === 0 && <p className="py-8 text-center text-sm text-muted-foreground">No patients found</p>}
          </div>
        </div>

        <div className="w-2/5 p-4 overflow-y-auto">
          {currentSelected ? (
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <span className="font-display text-lg font-bold text-foreground">{currentSelected.patient.name}</span>
                <SeverityBadge severity={currentSelected.severity} />
              </div>
              <p className="text-xs text-muted-foreground">{currentSelected.patientId} · {currentSelected.patient.age}{currentSelected.patient.gender} · {currentSelected.patient.language}</p>

              <div className="flex gap-1 border-b">
                {tabs.map(t => (
                  <button key={t.key} onClick={() => setActiveTab(t.key)}
                    className={`px-3 py-2 text-xs font-medium transition-all ${activeTab === t.key ? 'border-b-2 border-action text-action' : 'text-muted-foreground hover:text-foreground'}`}>
                    {t.label}
                  </button>
                ))}
              </div>

              <div className="mt-2">
                {activeTab === 'timeline' && <VisitTimeline events={currentSelected.timeline} />}

                {activeTab === 'labs' && (
                  <div className="space-y-3">
                    {currentSelected.tests.length === 0 && <p className="text-sm text-muted-foreground">No lab tests ordered</p>}
                    {currentSelected.tests.map(test => (
                      <div key={test.id} className="rounded-lg border bg-card p-3">
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-semibold">{test.name}</span>
                          {test.flag && <span className={`text-xs font-bold ${flagColor[test.flag]}`}>{test.flag}</span>}
                        </div>
                        {test.results?.map((r, i) => (
                          <div key={i} className="mt-2 flex items-center justify-between text-xs">
                            <span className="text-muted-foreground">{r.field}</span>
                            <span className={`font-semibold ${flagColor[r.flag]}`}>{r.value} {r.unit}</span>
                            <span className="text-muted-foreground">Normal: {r.normalRange}</span>
                          </div>
                        ))}
                        <p className="mt-1 text-xs text-muted-foreground">{test.orderedAt} · {test.orderedBy}</p>
                      </div>
                    ))}
                  </div>
                )}

                {activeTab === 'prescriptions' && (
                  <div className="space-y-3">
                    <div className="flex justify-end">
                      <Button variant="outline" size="sm" className="gap-1 text-xs"><Printer className="h-3 w-3" />Print</Button>
                    </div>
                    {currentSelected.prescriptions.length === 0 && <p className="text-sm text-muted-foreground">No prescriptions</p>}
                    {currentSelected.prescriptions.map(p => (
                      <div key={p.id} className="rounded-lg border bg-card p-3">
                        <p className="text-sm font-semibold">{p.drugName} {p.dose}</p>
                        <p className="mt-0.5 text-xs text-muted-foreground">{p.frequency} · {p.duration}</p>
                        <p className="mt-0.5 text-xs text-muted-foreground">Prescribed by {p.prescribedBy}</p>
                        <p className={`mt-0.5 text-xs ${p.dispensed ? 'text-success' : 'text-warning'}`}>{p.dispensed ? '✓ Dispensed' : '⬜ Pending'}</p>
                      </div>
                    ))}
                  </div>
                )}

                {activeTab === 'summary' && (
                  <div>
                    {currentSelected.aiSummary ? (
                      <div className="space-y-4">
                        <div className="rounded-lg border bg-card p-4">
                          <p className="text-sm leading-relaxed text-foreground">{currentSelected.aiSummary.narrative}</p>
                        </div>
                        <div className="grid grid-cols-2 gap-3 text-xs">
                          <div className="rounded-lg border bg-card p-3">
                            <p className="text-muted-foreground">Diagnosis</p>
                            <p className="mt-1 font-semibold">{currentSelected.aiSummary.diagnosis}</p>
                          </div>
                          <div className="rounded-lg border bg-card p-3">
                            <p className="text-muted-foreground">Severity</p>
                            <SeverityBadge severity={currentSelected.aiSummary.severity} className="mt-1" />
                          </div>
                          <div className="rounded-lg border bg-card p-3">
                            <p className="text-muted-foreground">Action Taken</p>
                            <p className="mt-1 font-semibold">{currentSelected.aiSummary.actionTaken}</p>
                          </div>
                          <div className="rounded-lg border bg-card p-3">
                            <p className="text-muted-foreground">Follow-up</p>
                            <p className="mt-1 font-semibold">{currentSelected.aiSummary.followUpDate}</p>
                          </div>
                        </div>
                      </div>
                    ) : (
                      <p className="text-sm text-muted-foreground">AI summary not yet generated</p>
                    )}
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
              Select a patient to view details
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
