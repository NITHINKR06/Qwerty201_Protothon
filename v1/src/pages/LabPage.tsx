import { useState } from 'react';
import { PortalNav } from '@/components/shared/PortalNav';
import { QRScannerBox } from '@/components/shared/QRScannerBox';
import { SeverityBadge } from '@/components/shared/SeverityBadge';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { usePatientStore } from '@/lib/patientStore';
import { Visit, TestResult, TestFlag } from '@/lib/types';
import { Upload, AlertTriangle } from 'lucide-react';

export default function LabPage() {
  const store = usePatientStore();
  const [selectedVisit, setSelectedVisit] = useState<Visit | null>(null);
  const [results, setResults] = useState<Record<string, Record<string, string>>>({});
  const [submitted, setSubmitted] = useState<Set<string>>(new Set());

  // Filter visits that have pending lab tests
  const pendingVisits = store.visits.filter(v => v.tests.some(t => t.status === 'pending'));
  const completedVisits = store.visits.filter(v => v.tests.length > 0 && v.tests.every(t => t.status === 'completed'));

  const handleScan = (value: string) => {
    const visit = store.visits.find(v => v.patientId === value && v.tests.some(t => t.status === 'pending'));
    if (visit) setSelectedVisit(visit);
  };

  const handleResultChange = (testId: string, field: string, value: string) => {
    setResults(prev => ({ ...prev, [testId]: { ...prev[testId], [field]: value } }));
  };

  const handleSubmitTest = (testId: string) => {
    if (!selectedVisit) return;
    const test = selectedVisit.tests.find(t => t.id === testId);
    if (!test) return;
    const r = results[testId] || {};

    let testResults: TestResult[] = [];
    let flag: TestFlag = 'NORMAL';

    if (test.name === 'ECG') {
      const finding = r['finding'] || 'normal';
      flag = finding === 'st-elevation' ? 'CRITICAL' : finding === 'abnormal' ? 'HIGH' : 'NORMAL';
      testResults = [{ field: 'Finding', value: finding === 'st-elevation' ? 'ST Elevation' : finding === 'abnormal' ? 'Abnormal' : 'Normal', unit: '', normalRange: 'Normal sinus rhythm', flag }];
    } else if (test.name === 'CBC') {
      const wbc = parseFloat(r['wbc'] || '7');
      const hb = parseFloat(r['hb'] || '14');
      const plt = parseFloat(r['plt'] || '250');
      testResults = [
        { field: 'WBC', value: String(wbc), unit: '×10³/µL', normalRange: '4.5-11.0', flag: wbc > 11 ? 'HIGH' : wbc < 4.5 ? 'LOW' : 'NORMAL' },
        { field: 'Hb', value: String(hb), unit: 'g/dL', normalRange: '13.5-17.5', flag: hb < 13.5 ? 'LOW' : 'NORMAL' },
        { field: 'Plt', value: String(plt), unit: '×10³/µL', normalRange: '150-400', flag: plt < 150 ? 'LOW' : 'NORMAL' },
      ];
      flag = testResults.some(r => r.flag === 'HIGH' || r.flag === 'LOW') ? 'HIGH' : 'NORMAL';
    } else if (test.name === 'Troponin I') {
      const val = parseFloat(r['value'] || '0.02');
      flag = val > 0.5 ? 'CRITICAL' : val > 0.04 ? 'HIGH' : 'NORMAL';
      testResults = [{ field: 'Troponin I', value: String(val), unit: 'ng/mL', normalRange: '<0.04', flag }];
    } else {
      const val = r['value'] || 'Normal';
      testResults = [{ field: test.name, value: val, unit: '', normalRange: 'Normal', flag: 'NORMAL' }];
    }

    store.submitLabResults(selectedVisit.id, testId, testResults, flag);
    setSubmitted(prev => new Set(prev).add(testId));
  };

  const handleSubmitAll = () => {
    if (!selectedVisit) return;
    selectedVisit.tests.filter(t => t.status === 'pending').forEach(t => handleSubmitTest(t.id));
  };

  // Refresh from store
  const currentVisit = selectedVisit ? store.visits.find(v => v.id === selectedVisit.id) || selectedVisit : null;

  const hasCritical = currentVisit?.tests.some(t => {
    const r = results[t.id];
    if (!r) return false;
    if (t.name === 'Troponin I' && parseFloat(r['value'] || '0') > 0.5) return true;
    return false;
  });

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <PortalNav />
      <div className="flex flex-1">
        {/* Left — Queue */}
        <div className="w-2/5 border-r p-4 overflow-y-auto">
          <h2 className="font-display text-lg font-bold">PENDING TESTS ({pendingVisits.length})</h2>
          <div className="mt-4 space-y-2">
            {pendingVisits.map(v => (
              <div key={v.id} onClick={() => setSelectedVisit(v)}
                className={`cursor-pointer rounded-lg border p-3 transition-all ${currentVisit?.id === v.id ? 'border-action ring-1 ring-action/20' : 'hover:border-action/40'}`}>
                <div className="flex items-center gap-2">
                  <span className={`h-2 w-2 rounded-full ${v.severity === 'HIGH' ? 'bg-critical' : 'bg-action'}`} />
                  <span className="text-sm font-semibold">{v.patient.name}</span>
                  {v.severity === 'HIGH' && <SeverityBadge severity="HIGH" />}
                </div>
                <p className="mt-1 text-xs text-muted-foreground">
                  {v.tests.filter(t => t.status === 'pending').map(t => t.name).join(' · ')}
                </p>
                <p className="text-xs text-muted-foreground">Ordered: {v.tests[0]?.orderedAt} · {v.tests[0]?.orderedBy}</p>
              </div>
            ))}
            {pendingVisits.length === 0 && <p className="text-sm text-muted-foreground py-8 text-center">No pending tests</p>}
          </div>

          {completedVisits.length > 0 && (
            <>
              <h3 className="mt-6 text-xs font-semibold text-muted-foreground">COMPLETED TODAY</h3>
              <div className="mt-2 space-y-1">
                {completedVisits.map(v => (
                  <div key={v.id} className="flex items-center gap-2 rounded-md px-3 py-1.5 text-xs text-muted-foreground">
                    <span className="text-success">✓</span> {v.patient.name}
                  </div>
                ))}
              </div>
            </>
          )}
        </div>

        {/* Right — Active panel */}
        <div className="w-3/5 p-4 overflow-y-auto">
          <QRScannerBox onScan={handleScan} label="Scan patient QR code" autoStart context="lab" />

          {currentVisit && (
            <div className="mt-6 space-y-4">
              {hasCritical && (
                <div className="flex items-center gap-2 rounded-lg border border-critical/40 bg-critical/10 p-3">
                  <AlertTriangle className="h-4 w-4 text-critical" />
                  <span className="text-sm font-semibold text-critical">CRITICAL VALUE — Doctor has been notified automatically.</span>
                </div>
              )}

              <div>
                <p className="font-display text-lg font-bold">{currentVisit.patient.name} — {currentVisit.patientId}</p>
                <p className="text-xs text-muted-foreground">Ordered by {currentVisit.tests[0]?.orderedBy} at {currentVisit.tests[0]?.orderedAt}</p>
              </div>

              <h3 className="text-sm font-semibold text-foreground">TESTS TO PERFORM:</h3>

              {currentVisit.tests.map(test => {
                const isSubmitted = submitted.has(test.id) || test.status === 'completed';
                return (
                  <div key={test.id} className={`rounded-lg border p-4 ${isSubmitted ? 'bg-success/5 border-success/30' : 'bg-card'}`}>
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-semibold">{test.name}</span>
                      <span className={`rounded-full px-2 py-0.5 text-xs ${isSubmitted ? 'bg-success/10 text-success' : 'bg-muted text-muted-foreground'}`}>
                        {isSubmitted ? '✓ Completed' : '⬜ Pending'}
                      </span>
                    </div>
                    {!isSubmitted && (
                      <div className="mt-3 space-y-2">
                        {test.name === 'ECG' && (
                          <Select onValueChange={v => handleResultChange(test.id, 'finding', v)}>
                            <SelectTrigger className="text-sm"><SelectValue placeholder="Select result" /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="normal">Normal</SelectItem>
                              <SelectItem value="st-elevation">ST Elevation</SelectItem>
                              <SelectItem value="abnormal">Abnormal</SelectItem>
                            </SelectContent>
                          </Select>
                        )}
                        {test.name === 'CBC' && (
                          <div className="grid grid-cols-3 gap-2">
                            <div><label className="text-xs text-muted-foreground">WBC (×10³/µL)</label><Input className="mt-1" placeholder="Value" onChange={e => handleResultChange(test.id, 'wbc', e.target.value)} /></div>
                            <div><label className="text-xs text-muted-foreground">Hb (g/dL)</label><Input className="mt-1" placeholder="Value" onChange={e => handleResultChange(test.id, 'hb', e.target.value)} /></div>
                            <div><label className="text-xs text-muted-foreground">Plt (×10³/µL)</label><Input className="mt-1" placeholder="Value" onChange={e => handleResultChange(test.id, 'plt', e.target.value)} /></div>
                          </div>
                        )}
                        {test.name === 'Troponin I' && (
                          <div><label className="text-xs text-muted-foreground">Value (ng/mL)</label><Input className="mt-1" placeholder="Value" onChange={e => handleResultChange(test.id, 'value', e.target.value)} /></div>
                        )}
                        {!['ECG', 'CBC', 'Troponin I'].includes(test.name) && (
                          <Input placeholder="Enter result" onChange={e => handleResultChange(test.id, 'value', e.target.value)} />
                        )}
                        <Button size="sm" onClick={() => handleSubmitTest(test.id)} className="bg-action text-action-foreground hover:bg-action/90">Submit Result</Button>
                      </div>
                    )}
                  </div>
                );
              })}

              {currentVisit.tests.some(t => t.status === 'pending') && (
                <Button onClick={handleSubmitAll} className="w-full bg-action text-action-foreground hover:bg-action/90">
                  Submit All Results
                </Button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
