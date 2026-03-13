import { useState } from 'react';
import { PortalNav } from '@/components/shared/PortalNav';
import { QRScannerBox } from '@/components/shared/QRScannerBox';
import { Button } from '@/components/ui/button';
import { usePatientStore } from '@/lib/patientStore';
import { Visit } from '@/lib/types';
import { AlertTriangle, Check, ShieldAlert } from 'lucide-react';

export default function PharmacyPage() {
  const store = usePatientStore();
  const [visit, setVisit] = useState<Visit | null>(null);
  const [completed, setCompleted] = useState(false);

  const handleScan = (value: string) => {
    const found = store.visits.find(v => v.patientId === value && v.prescriptions.length > 0 && v.status !== 'complete');
    if (found) { setVisit(found); setCompleted(false); }
  };

  const handleDispense = (prescriptionId: string) => {
    if (!visit) return;
    store.dispenseMedicine(visit.id, prescriptionId);
  };

  // Refresh from store
  const currentVisit = visit ? store.visits.find(v => v.id === visit.id) || visit : null;

  const allDispensed = currentVisit ? currentVisit.prescriptions.every(p => p.dispensed) : false;

  const handleComplete = () => {
    if (!currentVisit) return;
    store.completeVisit(currentVisit.id);
    setCompleted(true);
    setTimeout(() => { setVisit(null); setCompleted(false); }, 2000);
  };

  // Check drug allergy conflicts
  const allergyConflicts = currentVisit?.prescriptions.filter(p =>
    currentVisit.patient.allergies.some(a => p.drugName.toLowerCase().includes(a.toLowerCase()))
  ) || [];

  // Get visits with pending prescriptions
  const pendingVisits = store.visits.filter(v => v.prescriptions.length > 0 && v.status !== 'complete' && !v.prescriptions.every(p => p.dispensed));

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <PortalNav />
      <div className="flex flex-1">
        {/* Left — Queue */}
        <div className="w-2/5 border-r p-4 overflow-y-auto">
          <h2 className="font-display text-lg font-bold">PENDING PRESCRIPTIONS ({pendingVisits.length})</h2>
          <div className="mt-4 space-y-2">
            {pendingVisits.map(v => (
              <div key={v.id} onClick={() => { setVisit(v); setCompleted(false); }}
                className={`cursor-pointer rounded-lg border p-3 transition-all ${currentVisit?.id === v.id ? 'border-action ring-1 ring-action/20' : 'hover:border-action/40'}`}>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-semibold">{v.patient.name}</span>
                  {v.patient.allergies.length > 0 && <span className="text-xs text-critical">⚠ Allergies</span>}
                </div>
                <p className="mt-1 text-xs text-muted-foreground">
                  {v.prescriptions.filter(p => !p.dispensed).length} medicines pending
                </p>
                <p className="text-xs text-muted-foreground">By: {v.prescriptions[0]?.prescribedBy}</p>
              </div>
            ))}
            {pendingVisits.length === 0 && <p className="text-sm text-muted-foreground py-8 text-center">No pending prescriptions</p>}
          </div>
        </div>

        {/* Right — Dispense */}
        <div className="w-3/5 p-6 overflow-y-auto">
          {completed ? (
            <div className="flex flex-col items-center gap-4 py-16">
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-success">
                <Check className="h-8 w-8 text-success-foreground" />
              </div>
              <p className="font-display text-xl font-bold text-foreground">Visit Complete</p>
              <p className="text-sm text-muted-foreground">All medications dispensed. Ready for next patient.</p>
            </div>
          ) : !currentVisit ? (
            <div className="py-8 max-w-md mx-auto">
              <h2 className="mb-6 text-center font-display text-xl font-bold text-foreground">Pharmacy</h2>
              <QRScannerBox onScan={handleScan} label="Scan patient token slip" autoStart context="pharmacy" />
            </div>
          ) : (
            <div className="space-y-4 max-w-xl mx-auto">
              {/* Allergy banner */}
              {currentVisit.patient.allergies.length > 0 && (
                <div className={`flex items-center gap-2 rounded-lg border p-3 ${allergyConflicts.length > 0 ? 'border-critical/40 bg-critical/10' : 'border-warning/40 bg-warning/10'}`}>
                  <ShieldAlert className={`h-4 w-4 ${allergyConflicts.length > 0 ? 'text-critical' : 'text-warning'}`} />
                  <div>
                    <p className={`text-sm font-semibold ${allergyConflicts.length > 0 ? 'text-critical' : 'text-warning-foreground'}`}>
                      ALLERGY ON FILE: {currentVisit.patient.allergies.join(', ')}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {allergyConflicts.length > 0 ? `⚠ ${allergyConflicts.map(c => c.drugName).join(', ')} may be contraindicated!` : 'None of the current medications are contraindicated.'}
                    </p>
                  </div>
                </div>
              )}

              {/* Patient header */}
              <div className="rounded-lg border bg-card p-4">
                <p className="font-display text-lg font-bold">{currentVisit.patient.name} · {currentVisit.patient.age}{currentVisit.patient.gender}</p>
                <p className="text-xs text-muted-foreground">{currentVisit.patientId} · Prescribed by {currentVisit.prescriptions[0]?.prescribedBy}</p>
                <p className="text-xs text-muted-foreground">{currentVisit.date}</p>
              </div>

              {/* Prescription cards */}
              {currentVisit.prescriptions.map(p => {
                const isDispensed = p.dispensed;
                const isConflict = allergyConflicts.some(c => c.id === p.id);
                return (
                  <div key={p.id} className={`rounded-lg border p-4 ${isDispensed ? 'bg-success/5 border-success/30' : isConflict ? 'border-critical/40 bg-critical/5' : 'bg-card'}`}>
                    <div className="flex items-start justify-between">
                      <div>
                        <p className="text-sm font-semibold">💊 {p.drugName} {p.dose}</p>
                        <p className="mt-0.5 text-xs text-muted-foreground">{p.frequency} · {p.duration}</p>
                      </div>
                      {isDispensed ? (
                        <span className="rounded-full bg-success/10 px-2 py-0.5 text-xs font-semibold text-success">✓ Dispensed</span>
                      ) : (
                        <Button size="sm" onClick={() => handleDispense(p.id)} disabled={isConflict}
                          className={`text-xs ${isConflict ? 'bg-muted text-muted-foreground' : 'bg-action text-action-foreground hover:bg-action/90'}`}>
                          Dispense ✓
                        </Button>
                      )}
                    </div>
                    {isConflict && (
                      <div className="mt-2 flex items-center gap-1 text-xs text-critical">
                        <AlertTriangle className="h-3 w-3" /> Potential allergy conflict — dispensing blocked
                      </div>
                    )}
                  </div>
                );
              })}

              <Button onClick={handleComplete} disabled={!allDispensed}
                className="w-full bg-success text-success-foreground hover:bg-success/90 disabled:opacity-50">
                ✅ All Dispensed — Complete Visit
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
