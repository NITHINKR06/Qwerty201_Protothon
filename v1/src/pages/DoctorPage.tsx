import { useState, useEffect, useRef } from 'react';
import { PortalNav } from '@/components/shared/PortalNav';
import { QRScannerBox } from '@/components/shared/QRScannerBox';
import { PatientCard } from '@/components/shared/PatientCard';
import { SeverityBadge } from '@/components/shared/SeverityBadge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { usePatientStore, dummyTranscript, medicineCatalogue, labOptions, availableTests } from '@/lib/patientStore';
import { Visit, Prescription, Test } from '@/lib/types';
import { Mic, MicOff, Pause, Square, Pencil, Send, Pill, ClipboardList, ExternalLink, AlertTriangle, X, Search, Plus, Trash2 } from 'lucide-react';

type DoctorState = 'lookup' | 'consultation' | 'processing' | 'brief';

const symptomChips = ['Dyspnoea', 'Nausea', 'Diaphoresis', 'Radiation', 'Cough', 'Headache', 'Fatigue', 'Dizziness'];

export default function DoctorPage() {
  const store = usePatientStore();
  const [state, setState] = useState<DoctorState>('lookup');
  const [activeVisit, setActiveVisit] = useState<Visit | null>(null);

  // Recording state
  const [recording, setRecording] = useState(false);
  const [paused, setPaused] = useState(false);
  const [timer, setTimer] = useState(0);
  const [transcriptIndex, setTranscriptIndex] = useState(0);
  const [selectedSymptoms, setSelectedSymptoms] = useState<string[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const transcriptRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Brief editing
  const [editingField, setEditingField] = useState<string | null>(null);
  const [editValues, setEditValues] = useState<Record<string, string>>({});

  // Lab
  const [selectedTests, setSelectedTests] = useState<Set<string>>(new Set());
  const [showLabSelect, setShowLabSelect] = useState(false);
  const [selectedLab, setSelectedLab] = useState('labB');
  const [labSent, setLabSent] = useState(false);

  // Prescription
  const [prescriptions, setPrescriptions] = useState<Array<{name: string; dose: string; frequency: string; duration: string}>>([]);
  const [medSearch, setMedSearch] = useState('');
  const [showMedDropdown, setShowMedDropdown] = useState(false);
  const [selectedMedName, setSelectedMedName] = useState('');
  const [selectedDose, setSelectedDose] = useState('');
  const [selectedFreq, setSelectedFreq] = useState('');
  const [selectedDuration, setSelectedDuration] = useState('7 days');
  const [pharmacySent, setPharmacySent] = useState(false);

  // Timer logic
  useEffect(() => {
    if (recording && !paused) {
      timerRef.current = setInterval(() => setTimer(t => t + 1), 1000);
    } else {
      if (timerRef.current) clearInterval(timerRef.current);
    }
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [recording, paused]);

  // Simulated transcript reveal
  useEffect(() => {
    if (recording && !paused) {
      transcriptRef.current = setInterval(() => {
        setTranscriptIndex(i => Math.min(i + 1, dummyTranscript.length));
      }, 3000);
    } else {
      if (transcriptRef.current) clearInterval(transcriptRef.current);
    }
    return () => { if (transcriptRef.current) clearInterval(transcriptRef.current); };
  }, [recording, paused]);

  const formatTime = (s: number) => `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;

  const handleSelectPatient = (visit: Visit) => {
    setActiveVisit(visit);
    store.startConsultation(visit.id);
    setState('consultation');
    setRecording(true);
    setTimer(0);
    setTranscriptIndex(0);
    setSelectedSymptoms([]);
  };

  const handleScan = (value: string) => {
    const visit = store.visits.find(v => v.patientId === value && v.status !== 'complete');
    if (visit) handleSelectPatient(visit);
  };

  const handleStop = () => {
    setRecording(false);
    setPaused(false);
    setState('processing');
    setTimeout(() => {
      // Generate AI summary
      if (activeVisit) {
        store.updateVisitSummary(activeVisit.id, {
          narrative: `${activeVisit.patient.name}, a ${activeVisit.patient.age}-year-old ${activeVisit.patient.gender === 'M' ? 'male' : 'female'}, presented with ${activeVisit.chiefComplaint || 'symptoms as described'}. Based on the consultation, the following clinical assessment has been generated.`,
          diagnosis: 'Suspected Acute Coronary Syndrome (ACS)',
          severity: 'HIGH',
          actionTaken: 'Clinical evaluation completed, lab tests and medication recommended',
          followUpDate: '16 Mar 2025',
          referrals: [],
        });
        store.addTimelineEvent(activeVisit.id, {
          time: new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: false }),
          type: 'consultation', title: 'Consultation Complete',
          detail: `Dr. Meera · ${formatTime(timer)} recording`, severity: 'normal',
        });
      }
      setSelectedTests(new Set(['ECG', 'CBC', 'Troponin I']));
      setState('brief');
    }, 2500);
  };

  const handleSendToLab = () => {
    if (!activeVisit) return;
    const tests: Test[] = Array.from(selectedTests).map((name, i) => ({
      id: `t${Date.now()}-${i}`, name, status: 'pending' as const,
      orderedBy: 'Dr. Meera',
      orderedAt: new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: false }),
    }));
    store.addTests(activeVisit.id, tests);
    store.sendToLab(activeVisit.id, selectedLab);
    setLabSent(true);
  };

  const handleAddPrescription = () => {
    if (!selectedMedName || !selectedDose) return;
    setPrescriptions(prev => [...prev, { name: selectedMedName, dose: selectedDose, frequency: selectedFreq, duration: selectedDuration }]);
    setSelectedMedName(''); setSelectedDose(''); setSelectedFreq(''); setSelectedDuration('7 days'); setMedSearch('');
  };

  const handleSendToPharmacy = () => {
    if (!activeVisit) return;
    const rxList: Prescription[] = prescriptions.map((p, i) => ({
      id: `rx${Date.now()}-${i}`, drugName: p.name, dose: p.dose,
      frequency: p.frequency, duration: p.duration,
      instructions: '', instructionLocal: '',
      prescribedBy: 'Dr. Meera', dispensed: false,
    }));
    store.addPrescriptions(activeVisit.id, rxList);
    store.sendToPharmacy(activeVisit.id);
    setPharmacySent(true);
  };

  const filteredMeds = medicineCatalogue.filter(m => m.name.toLowerCase().includes(medSearch.toLowerCase()));
  const todaysPatients = store.getActiveVisits();

  // Refresh activeVisit from store
  const currentVisit = activeVisit ? store.visits.find(v => v.id === activeVisit.id) || activeVisit : null;

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <PortalNav />

      {/* STATE A — Lookup */}
      {state === 'lookup' && (
        <div className="flex flex-1 items-center justify-center">
          <div className="w-full max-w-lg space-y-6 text-center">
            <h1 className="font-display text-2xl font-bold text-foreground">Dr. Meera — Good morning</h1>
            <QRScannerBox onScan={handleScan} label="Scan Patient QR" placeholder="Enter Patient ID" autoStart context="doctor" />
            <div>
              <p className="mb-3 text-xs font-semibold text-muted-foreground">Today's Patients</p>
              <div className="space-y-2">
                {todaysPatients.map(v => (
                  <PatientCard key={v.id} patient={v.patient} severity={v.severity} chiefComplaint={v.chiefComplaint} compact onClick={() => handleSelectPatient(v)} />
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* STATE B — Consultation */}
      {state === 'consultation' && currentVisit && (
        <div className="flex flex-1">
          {/* Col 1 — Patient Sidebar */}
          <div className="w-1/4 border-r bg-card p-4 space-y-4 overflow-y-auto">
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary font-display text-sm font-bold text-primary-foreground">
                {currentVisit.patient.name.split(' ').map(n => n[0]).join('')}
              </div>
              <div>
                <p className="font-display text-base font-bold">{currentVisit.patient.name}</p>
                <p className="text-xs text-muted-foreground">{currentVisit.patient.age}{currentVisit.patient.gender} · {currentVisit.patient.language}</p>
                <p className="text-xs text-muted-foreground">{currentVisit.patientId}</p>
              </div>
            </div>
            {currentVisit.vitals && (
              <div>
                <p className="text-xs font-semibold text-muted-foreground">VITALS</p>
                <div className="mt-2 space-y-1 text-xs">
                  <div className="flex justify-between"><span>BP</span><span className="font-semibold">{currentVisit.vitals.bp} {parseInt(currentVisit.vitals.bp) > 140 ? '↑' : ''}</span></div>
                  <div className="flex justify-between"><span>HR</span><span>{currentVisit.vitals.hr} bpm</span></div>
                  <div className="flex justify-between"><span>SpO₂</span><span>{currentVisit.vitals.spo2}%</span></div>
                  <div className="flex justify-between"><span>Temp</span><span className="font-semibold">{currentVisit.vitals.temp}°C {currentVisit.vitals.temp > 37.5 ? '↑' : ''}</span></div>
                </div>
              </div>
            )}
            {currentVisit.patient.history.length > 0 && (
              <div>
                <p className="text-xs font-semibold text-muted-foreground">HISTORY</p>
                {currentVisit.patient.history.map((h, i) => (
                  <div key={i} className="mt-1 text-xs">
                    <p className="text-muted-foreground">Last: {h.date}</p>
                    <p>Dx: {h.diagnosis}</p>
                    <p className="text-muted-foreground">Meds: {h.medications.join(', ')}</p>
                  </div>
                ))}
              </div>
            )}
            {currentVisit.patient.allergies.length > 0 && (
              <div>
                <p className="text-xs font-semibold text-muted-foreground">ALLERGIES</p>
                <p className="mt-1 text-xs font-semibold text-critical">⚠ {currentVisit.patient.allergies.join(', ')}</p>
              </div>
            )}
          </div>

          {/* Col 2 — Consultation Split */}
          <div className="flex w-1/2 flex-col border-r">
            {/* Recording bar */}
            <div className="flex items-center gap-3 border-b px-4 py-3">
              {recording && (
                <>
                  <span className="flex items-center gap-1.5">
                    <span className="h-2 w-2 rounded-full bg-critical animate-pulse-recording" />
                    <span className="text-sm font-semibold text-critical">RECORDING</span>
                  </span>
                  <span className="font-body text-sm text-muted-foreground">{formatTime(timer)}</span>
                </>
              )}
              <div className="ml-auto flex gap-2">
                {recording && (
                  <>
                    <Button variant="outline" size="sm" onClick={() => setPaused(!paused)}>
                      {paused ? <Mic className="h-4 w-4" /> : <Pause className="h-4 w-4" />}
                      {paused ? 'Resume' : 'Pause'}
                    </Button>
                    <Button size="sm" onClick={handleStop} className="bg-critical text-critical-foreground hover:bg-critical/90">
                      <Square className="h-4 w-4 mr-1" /> Stop
                    </Button>
                  </>
                )}
              </div>
            </div>

            {/* Transcript — split halves */}
            <div className="flex-1 overflow-y-auto p-4">
              <div className="grid grid-cols-2 gap-4 mb-4">
                <p className="text-xs font-semibold text-muted-foreground">PATIENT ({currentVisit.patient.language})</p>
                <p className="text-xs font-semibold text-muted-foreground">ENGLISH (AI translation)</p>
              </div>
              {dummyTranscript.slice(0, transcriptIndex).map((t, i) => (
                <div key={i} className="grid grid-cols-2 gap-4 border-b pb-3 mb-3">
                  <div>
                    <span className={`text-[10px] font-bold ${t.speaker === 'patient' ? 'text-action' : 'text-success'}`}>
                      {t.speaker === 'patient' ? '🎤 Patient' : '🩺 Doctor'}
                    </span>
                    <p className="text-sm italic text-foreground mt-1">"{t.original}"</p>
                  </div>
                  <div>
                    <span className="text-[10px] text-muted-foreground">{t.time}</span>
                    <p className="text-sm text-foreground mt-1">"{t.translated}"</p>
                  </div>
                </div>
              ))}
              {recording && transcriptIndex < dummyTranscript.length && (
                <div className="flex items-center gap-2 text-xs text-muted-foreground animate-pulse">
                  <span className="h-2 w-2 rounded-full bg-action" /> Listening...
                </div>
              )}
            </div>

            {/* Symptom chips */}
            <div className="flex flex-wrap gap-2 border-t px-4 py-3">
              {symptomChips.map(s => (
                <button key={s} onClick={() => setSelectedSymptoms(prev => prev.includes(s) ? prev.filter(x => x !== s) : [...prev, s])}
                  className={`rounded-full border px-3 py-1 text-xs font-medium transition-all ${selectedSymptoms.includes(s) ? 'border-action bg-action/10 text-action' : 'border-border text-muted-foreground hover:border-action/40'}`}>
                  + {s}
                </button>
              ))}
            </div>
          </div>

          {/* Col 3 — Patient tablet preview */}
          <div className="w-1/4 bg-muted/30 p-4">
            <p className="text-xs font-semibold text-muted-foreground">PATIENT TABLET PREVIEW</p>
            <div className="mt-4 rounded-lg border bg-card p-4">
              <p className="text-center text-sm text-foreground">🔊 {currentVisit.patient.language}</p>
              <div className="mt-4 space-y-3">
                {dummyTranscript.slice(0, transcriptIndex).filter(t => t.speaker === 'doctor').map((t, i) => (
                  <p key={i} className="text-sm text-foreground">{t.translated}</p>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* STATE — Processing */}
      {state === 'processing' && (
        <div className="flex flex-1 items-center justify-center">
          <div className="text-center">
            <div className="mx-auto h-10 w-10 animate-spin rounded-full border-3 border-action border-t-transparent" />
            <p className="mt-4 text-sm text-muted-foreground">AI is generating clinical brief...</p>
            <p className="mt-1 text-xs text-muted-foreground">Analyzing transcript, symptoms, and patient history</p>
          </div>
        </div>
      )}

      {/* STATE C — Clinical Report */}
      {state === 'brief' && currentVisit && (
        <div className="flex-1 overflow-y-auto">
          {/* Patient strip */}
          <div className="flex items-center gap-3 border-b bg-card px-6 py-3">
            <span className="font-display text-sm font-bold">{currentVisit.patient.name}</span>
            <span className="text-xs text-muted-foreground">{currentVisit.patient.age}{currentVisit.patient.gender}</span>
            <SeverityBadge severity="HIGH" />
            <span className="text-xs text-muted-foreground">{currentVisit.patientId} · {currentVisit.date}</span>
            <span className="ml-auto text-xs text-muted-foreground">Follow-up: 16 Mar 2025</span>
          </div>

          <div className="mx-auto max-w-5xl p-6 space-y-6">

            {/* CLINICAL SUMMARY — Top full-width editable medical notes */}
            <div className="rounded-lg border bg-card p-6">
              <div className="flex items-center justify-between">
                <h2 className="font-display text-lg font-bold">CLINICAL RECORD — {currentVisit.patientId}</h2>
                <p className="text-xs text-muted-foreground">AI Generated · Click ✏️ to edit any field</p>
              </div>

              {[
                { key: 'complaint', label: 'CHIEF COMPLAINT', value: currentVisit.chiefComplaint || 'Chest pain × 2 days, fever, left arm radiation' },
                { key: 'symptoms', label: 'SYMPTOMS', value: `• Chest pain — substernal, pressure-like, 2 days\n• Fever — ${currentVisit.vitals?.temp || 38.4}°C\n• Left arm pain — radiating\n• Diaphoresis — reported\n${selectedSymptoms.map(s => `• ${s}`).join('\n')}` },
                { key: 'assessment', label: 'DIAGNOSIS / ASSESSMENT', value: 'Suspected Acute Coronary Syndrome (ACS)' },
                { key: 'action', label: 'ACTION TAKEN', value: 'Clinical evaluation completed. ECG, CBC, Troponin ordered. Aspirin stat administered. Patient counselled.' },
              ].map(section => (
                <div key={section.key} className="mt-4">
                  <div className="flex items-center gap-2">
                    <h3 className="text-xs font-bold text-muted-foreground">{section.label}</h3>
                    <button onClick={() => setEditingField(editingField === section.key ? null : section.key)} className="text-action hover:text-action/80">
                      <Pencil className="h-3 w-3" />
                    </button>
                  </div>
                  {editingField === section.key ? (
                    <Textarea defaultValue={editValues[section.key] || section.value} onChange={e => setEditValues(prev => ({ ...prev, [section.key]: e.target.value }))} onBlur={() => setEditingField(null)} className="mt-1 text-sm" autoFocus rows={4} />
                  ) : (
                    <div className="mt-1">
                      {section.key === 'assessment' ? (
                        <div className="flex items-center gap-2"><p className="text-sm font-semibold">{editValues[section.key] || section.value}</p><SeverityBadge severity="HIGH" /></div>
                      ) : (
                        <p className="whitespace-pre-line text-sm">{editValues[section.key] || section.value}</p>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>

            {/* BOTTOM SIDE-BY-SIDE PANEL: Prescription (left) + Lab Tests (right) */}
            <div className="grid grid-cols-2 gap-6">

              {/* ───── BOTTOM LEFT — PRESCRIPTION ───── */}
              <div className="rounded-lg border bg-card p-5">
                <div className="flex items-center gap-2 mb-4">
                  <Pill className="h-4 w-4 text-action" />
                  <h3 className="text-sm font-bold text-foreground">PRESCRIPTION</h3>
                  <span className="ml-auto text-xs text-muted-foreground">{prescriptions.length} medicines</span>
                </div>

                {/* Medicine search */}
                <div className="relative">
                  <div className="flex items-center gap-2">
                    <Search className="h-4 w-4 text-muted-foreground" />
                    <Input value={medSearch} onChange={e => { setMedSearch(e.target.value); setShowMedDropdown(true); }}
                      onFocus={() => setShowMedDropdown(true)} placeholder="Search medicine..." className="flex-1 text-sm" />
                  </div>
                  {showMedDropdown && medSearch && (
                    <div className="absolute z-10 mt-1 w-full max-h-40 overflow-y-auto rounded-lg border bg-card shadow-lg">
                      {filteredMeds.map(m => (
                        <button key={m.name} onClick={() => {
                          setSelectedMedName(m.name); setSelectedDose(m.doses[0]); setSelectedFreq(m.frequencies[0]);
                          setMedSearch(m.name); setShowMedDropdown(false);
                        }} className="w-full px-3 py-2 text-left text-sm hover:bg-muted flex justify-between">
                          <span className="font-medium">{m.name}</span>
                          <span className="text-xs text-muted-foreground">{m.category}</span>
                        </button>
                      ))}
                      {filteredMeds.length === 0 && <p className="px-3 py-2 text-xs text-muted-foreground">No match</p>}
                    </div>
                  )}
                </div>

                {selectedMedName && (
                  <div className="mt-3 rounded-lg border p-3 bg-muted/30">
                    <p className="text-sm font-semibold">{selectedMedName}</p>
                    <div className="mt-2 flex flex-wrap gap-2">
                      <Select value={selectedDose} onValueChange={setSelectedDose}>
                        <SelectTrigger className="w-24 text-xs"><SelectValue placeholder="Dose" /></SelectTrigger>
                        <SelectContent>{medicineCatalogue.find(m => m.name === selectedMedName)?.doses.map(d => <SelectItem key={d} value={d}>{d}</SelectItem>)}</SelectContent>
                      </Select>
                      <Select value={selectedFreq} onValueChange={setSelectedFreq}>
                        <SelectTrigger className="w-28 text-xs"><SelectValue placeholder="Freq" /></SelectTrigger>
                        <SelectContent>{medicineCatalogue.find(m => m.name === selectedMedName)?.frequencies.map(f => <SelectItem key={f} value={f}>{f}</SelectItem>)}</SelectContent>
                      </Select>
                      <Select value={selectedDuration} onValueChange={setSelectedDuration}>
                        <SelectTrigger className="w-24 text-xs"><SelectValue /></SelectTrigger>
                        <SelectContent>{['3 days', '5 days', '7 days', '14 days', '30 days', 'As needed'].map(d => <SelectItem key={d} value={d}>{d}</SelectItem>)}</SelectContent>
                      </Select>
                      <Button size="sm" onClick={handleAddPrescription} className="bg-success text-success-foreground"><Plus className="h-3 w-3" /></Button>
                    </div>
                  </div>
                )}

                {/* Listed prescriptions */}
                <div className="mt-3 space-y-1.5 max-h-40 overflow-y-auto">
                  {prescriptions.map((p, i) => (
                    <div key={i} className="flex items-center justify-between rounded-md border px-3 py-2">
                      <div>
                        <span className="text-sm font-semibold">💊 {p.name} {p.dose}</span>
                        <span className="ml-1 text-xs text-muted-foreground">{p.frequency} × {p.duration}</span>
                      </div>
                      <button onClick={() => setPrescriptions(prev => prev.filter((_, j) => j !== i))} className="text-critical hover:text-critical/80">
                        <Trash2 className="h-3 w-3" />
                      </button>
                    </div>
                  ))}
                </div>

                {!pharmacySent ? (
                  <Button onClick={handleSendToPharmacy} className="mt-4 w-full bg-action text-action-foreground hover:bg-action/90" disabled={prescriptions.length === 0}>
                    <Send className="h-3 w-3 mr-1" /> Send to Pharmacy →
                  </Button>
                ) : (
                  <p className="mt-4 text-sm text-success font-semibold text-center">✓ Sent to pharmacy</p>
                )}
              </div>

              {/* ───── BOTTOM RIGHT — LAB TESTS ───── */}
              <div className="rounded-lg border bg-card p-5">
                <div className="flex items-center gap-2 mb-4">
                  <ClipboardList className="h-4 w-4 text-action" />
                  <h3 className="text-sm font-bold text-foreground">LAB INVESTIGATIONS</h3>
                  <span className="ml-auto text-xs text-muted-foreground">{selectedTests.size} tests</span>
                </div>

                <div className="flex flex-wrap gap-2.5">
                  {availableTests.map(test => (
                    <label key={test} className="flex items-center gap-1.5 text-sm">
                      <Checkbox checked={selectedTests.has(test)} onCheckedChange={(checked) => {
                        const next = new Set(selectedTests);
                        if (checked) next.add(test); else next.delete(test);
                        setSelectedTests(next);
                      }} />
                      {test}
                    </label>
                  ))}
                </div>

                <div className="mt-4 border-t pt-4">
                  <label className="text-xs font-semibold text-muted-foreground">SEND TO LAB</label>
                  <Select value={selectedLab} onValueChange={setSelectedLab}>
                    <SelectTrigger className="mt-1 text-sm"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {labOptions.map(lab => (
                        <SelectItem key={lab.id} value={lab.id}>
                          {lab.name} ({lab.avgWait}m avg wait)
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {!labSent ? (
                  <Button onClick={handleSendToLab} className="mt-4 w-full bg-action text-action-foreground hover:bg-action/90" disabled={selectedTests.size === 0}>
                    <Send className="h-3 w-3 mr-1" /> Send {selectedTests.size} tests to Lab →
                  </Button>
                ) : (
                  <p className="mt-4 text-sm text-success font-semibold text-center">✓ {selectedTests.size} tests sent to lab</p>
                )}
              </div>
            </div>

            {/* Action row */}
            <div className="flex flex-wrap gap-3 pt-2">
              <Button className="bg-success text-success-foreground hover:bg-success/90 gap-1.5 h-11" onClick={() => {
                setState('lookup');
                setActiveVisit(null);
                setLabSent(false);
                setPharmacySent(false);
                setPrescriptions([]);
                setSelectedTests(new Set());
              }}>
                <CheckIcon className="h-4 w-4" /> ✅ Confirm & Upload to Digital Locker
              </Button>
              <Button variant="outline" onClick={() => {
                setState('lookup');
                setActiveVisit(null);
                setLabSent(false);
                setPharmacySent(false);
                setPrescriptions([]);
                setSelectedTests(new Set());
              }}>
                Done — Next Patient
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function CheckIcon({ className }: { className?: string }) {
  return <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="20 6 9 17 4 12" /></svg>;
}
