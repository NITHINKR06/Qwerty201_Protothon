import { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { PortalNav } from '@/components/shared/PortalNav';
import { QRScannerBox } from '@/components/shared/QRScannerBox';
import { PatientCard } from '@/components/shared/PatientCard';
import { SeverityBadge } from '@/components/shared/SeverityBadge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { usePatientStore, medicineCatalogue, labOptions, availableTests } from '@/lib/patientStore';
import { Visit, Prescription, Test } from '@/lib/types';
import { Mic, Pause, Square, Pencil, Send, Pill, ClipboardList, Volume2, Upload, Search, Plus, Trash2, Activity, LogOut } from 'lucide-react';
import { completeConsultation, checkHealth, analyzeConsultation, getClinicalPDFUrl } from '@/lib/api';

type DoctorState = 'lookup' | 'consultation' | 'processing' | 'brief' | 'dashboard';

const symptomChips = ['Dyspnoea', 'Nausea', 'Diaphoresis', 'Radiation', 'Cough', 'Headache', 'Fatigue', 'Dizziness'];

const LANG_CODES: Record<string, string> = {
  Hindi: 'hi-IN', Tamil: 'ta-IN', Telugu: 'te-IN',
  Kannada: 'kn-IN', Malayalam: 'ml-IN', English: 'en-IN',
};

interface LiveLine {
  speaker: 'patient' | 'doctor';
  original: string;
  translated: string;
  native?: string;
  time: string;
  lang: string;
}

export default function DoctorPage() {
  const store = usePatientStore();
  const [state, setState] = useState<DoctorState>('lookup');
  const [activeVisit, setActiveVisit] = useState<Visit | null>(null);
  const [recording, setRecording] = useState(false);
  const [paused, setPaused] = useState(false);
  const [timer, setTimer] = useState(0);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [liveLines, setLiveLines] = useState<LiveLine[]>([]);
  const [selectedSymptoms, setSelectedSymptoms] = useState<string[]>([]);
  const [doctorMessage, setDoctorMessage] = useState('');
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [backendOnline, setBackendOnline] = useState<boolean | null>(null);
  const [editingField, setEditingField] = useState<string | null>(null);
  const [editValues, setEditValues] = useState<Record<string, string>>({});
  const [selectedTests, setSelectedTests] = useState<Set<string>>(new Set());
  const [selectedLab, setSelectedLab] = useState('labB');
  const [labSent, setLabSent] = useState(false);
  const [prescriptions, setPrescriptions] = useState<Array<{ name: string; dose: string; frequency: string; duration: string }>>([]);
  const [medSearch, setMedSearch] = useState('');
  const [showMedDropdown, setShowMedDropdown] = useState(false);
  const [selectedMedName, setSelectedMedName] = useState('');
  const [selectedDose, setSelectedDose] = useState('');
  const [selectedFreq, setSelectedFreq] = useState('');
  const [selectedDuration, setSelectedDuration] = useState('7 days');
  const [pharmacySent, setPharmacySent] = useState(false);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioStreamRef = useRef<MediaStream | null>(null);
  const chunkTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const timerIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const pendingChunks = useRef<BlobPart[]>([]);
  const mimeTypeRef = useRef<string>('audio/webm');
  const activeVisitRef = useRef<Visit | null>(null);
  const transcriptRef = useRef<HTMLDivElement>(null);

  useEffect(() => { activeVisitRef.current = activeVisit; }, [activeVisit]);
  useEffect(() => () => { stopRecording(); }, []);

  useEffect(() => {
    checkHealth().then(h => setBackendOnline(!!h)).catch(() => setBackendOnline(false));
  }, []);

  // Timer counts up while recording and not paused
  useEffect(() => {
    if (recording && !paused) {
      timerIntervalRef.current = setInterval(() => setTimer(t => t + 1), 1000);
    } else {
      if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
    }
    return () => { if (timerIntervalRef.current) clearInterval(timerIntervalRef.current); };
  }, [recording, paused]);

  // Auto scroll transcript to bottom
  useEffect(() => {
    if (transcriptRef.current) {
      transcriptRef.current.scrollTop = transcriptRef.current.scrollHeight;
    }
  }, [liveLines]);

  // ─── Send accumulated chunks to server ───────────────────────────────────
  const sendToServer = async (chunks: BlobPart[]) => {
    if (chunks.length === 0) return;

    const blob = new Blob(chunks, { type: mimeTypeRef.current });
    console.log(`[STT] Blob size: ${blob.size} bytes from ${chunks.length} chunks`);

    // Lowered from 30KB to 1KB to allow manual short submissions
    if (blob.size < 1000) {
      console.log(`[STT] Too small (${blob.size} bytes), skipping`);
      return;
    }

    const visit = activeVisitRef.current;
    if (!visit) return;

    const lang = LANG_CODES[visit.patient.language] ?? 'hi-IN';
    setIsTranscribing(true);

    try {
      const formData = new FormData();
      formData.append('file', blob, 'audio.webm');
      formData.append('language', lang);

      // Using the Vite proxy /api/ instead of direct port 8000
      const res = await fetch('/api/voice/transcribe_upload', {
        method: 'POST',
        body: formData,
      });

      if (!res.ok) {
        console.error(`[STT] HTTP ${res.status}`);
        return;
      }

      const result = await res.json();
      const text = result.transcript?.trim();
      
      // Ignore if empty or error bracket
      if (!text || text === "" || text.startsWith('[')) return;

      console.log(`[STT] Received: "${text}"`);

      const timeStr = new Date().toLocaleTimeString('en-IN', {
        hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false,
      });

      // Strict turn-taking: Doctor first, then alternate
      setLiveLines(prev => {
        const expectedSpeaker = prev.length % 2 === 0 ? 'doctor' : 'patient';
        return [...prev, {
          speaker: expectedSpeaker,
          original: result.transcript,
          translated: result.english_translation || result.transcript,
          native: result.native_translation || result.transcript,
          time: timeStr,
          lang: result.detected_language || lang,
        }];
      });
    } catch (err) {
      console.error('[STT] Fetch error:', err);
    } finally {
      setIsTranscribing(false);
    }
  };

  // ─── Start recording ──────────────────────────────────────────────────────
  // KEY FIX: Standalone Segment Cycling.
  // Instead of one long recording, we cycle every 5s.
  // This ensures every blob sent to the server is a VALID, STANDALONE WebM file.
  const createRecorder = (stream: MediaStream) => {
    const mimeType = ['audio/webm;codecs=opus', 'audio/webm', 'audio/ogg']
      .find(m => MediaRecorder.isTypeSupported(m)) ?? 'audio/webm';
    mimeTypeRef.current = mimeType;

    const recorder = new MediaRecorder(stream, { mimeType });
    const chunks: Blob[] = [];

    recorder.ondataavailable = (e) => {
      if (e.data && e.data.size > 0) chunks.push(e.data);
    };

    recorder.onstop = () => {
      if (chunks.length > 0) {
        const fullBlob = new Blob(chunks, { type: mimeType });
        console.log(`[REC] Segment complete: ${fullBlob.size} bytes`);
        if (fullBlob.size > 1500) { // Filter out header-only silences
           sendToServer([fullBlob]);
        }
      }
    };

    return recorder;
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      audioStreamRef.current = stream;

      const cycle = () => {
        if (!audioStreamRef.current) return;
        
        const recorder = createRecorder(audioStreamRef.current);
        mediaRecorderRef.current = recorder;
        recorder.start();
        
        // Record for 7 seconds then stop to flush the file - per iteration 4 request
        setTimeout(() => {
          if (recorder.state === 'recording') {
            recorder.stop();
            // Recurse to start next segment
            setRecording(prev => {
              if (prev) cycle();
              return prev;
            });
          }
        }, 7000);
      };

      setRecording(true);
      setPaused(false);
      cycle();
      console.log(`[REC] Segmented session started`);

    } catch (err) {
      console.error('[MIC]', err);
      alert('Microphone access denied or error.');
    }
  };

  // ─── Stop recording ───────────────────────────────────────────────────────
  const stopRecording = () => {
    setRecording(false);
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }
    if (audioStreamRef.current) {
      audioStreamRef.current.getTracks().forEach(t => t.stop());
      audioStreamRef.current = null;
    }
  };

  // ─── Submit Voice (manual) ────────────────────────────────────────────────
  // Manual submission removed in favor of automated 6s cycles

  // ─── Pause / Resume ───────────────────────────────────────────────────────
  const togglePause = () => {
    const rec = mediaRecorderRef.current;
    if (!rec) return;
    if (paused) {
      rec.resume();
      setPaused(false);
    } else {
      rec.pause();
      setPaused(true);
    }
  };

  // ─── Stop consultation ──────────────────────────────────────────────────────────
  const handleStopConsultation = async () => {
    stopRecording();
    setState('processing');
    if (activeVisit && liveLines.length > 0) {
      // Send full transcript to Ollama for clinical analysis
      try {
        const result = await analyzeConsultation({
          visit_id: activeVisit.id,
          patient_id: activeVisit.patientId,
          patient_name: activeVisit.patient.name,
          patient_age: activeVisit.patient.age,
          patient_gender: activeVisit.patient.gender,
          language: activeVisit.patient.language,
          transcript_lines: liveLines.map(l => ({
            speaker: l.speaker,
            original: l.original,
            translated: l.translated,
            time: l.time,
          })),
        });

        if (result?.clinical) {
          const c = result.clinical;

          // Auto-populate symptoms
          if (c.symptoms?.length) {
            setSelectedSymptoms(c.symptoms);
          }

          // Auto-populate lab tests
          if (c.lab_tests?.length) {
            setSelectedTests(new Set(c.lab_tests));
            // Auto-send to lab
            const tests = c.lab_tests.map((name, i) => ({
              id: `t${Date.now()}-${i}`, name, status: 'pending' as const,
              orderedBy: 'Dr. Meera',
              orderedAt: new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: false }),
            }));
            store.addTests(activeVisit.id, tests);
            store.sendToLab(activeVisit.id, 'labB');
            setLabSent(true);
          }

          // Auto-populate prescriptions
          if (c.prescription_details?.length) {
            const rxList = c.prescription_details.map(p => ({
              name: p.drug, dose: p.dose, frequency: p.frequency, duration: p.duration,
            }));
            setPrescriptions(rxList);
            // Auto-send to pharmacy
            store.addPrescriptions(activeVisit.id, rxList.map((p, i) => ({
              id: `rx${Date.now()}-${i}`, drugName: p.name, dose: p.dose,
              frequency: p.frequency, duration: p.duration,
              instructions: '', instructionLocal: '', prescribedBy: 'Dr. Meera', dispensed: false,
            })));
            store.sendToPharmacy(activeVisit.id);
            setPharmacySent(true);
          } else if (c.prescriptions?.length) {
            // Fallback: prescriptions as strings
            const rxList = c.prescriptions.map(rx => {
              const parts = rx.split(' ');
              return { name: parts[0] || rx, dose: parts.slice(1).join(' ') || '', frequency: 'OD', duration: '7 days' };
            });
            setPrescriptions(rxList);
            store.addPrescriptions(activeVisit.id, rxList.map((p, i) => ({
              id: `rx${Date.now()}-${i}`, drugName: p.name, dose: p.dose,
              frequency: p.frequency, duration: p.duration,
              instructions: '', instructionLocal: '', prescribedBy: 'Dr. Meera', dispensed: false,
            })));
            store.sendToPharmacy(activeVisit.id);
            setPharmacySent(true);
          }

          // Update visit summary with Ollama's analysis
          store.updateVisitSummary(activeVisit.id, {
            narrative: `${activeVisit.patient.name}, ${activeVisit.patient.age}yr. AI analysis: ${c.diagnosis}`,
            diagnosis: c.diagnosis || 'Under evaluation',
            severity: (c.severity as any) || 'STABLE',
            actionTaken: c.clinical_notes || 'Clinical evaluation complete.',
            followUpDate: c.followup || 'In 3 days',
            referrals: [],
          });
        }
      } catch (err) {
        console.error('[Ollama] Analysis failed:', err);
      }

      // Timeline event
      store.addTimelineEvent(activeVisit.id, {
        time: new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: false }),
        type: 'consultation', title: 'Consultation Complete',
        detail: `Dr. Meera · ${formatTime(timer)} · ${liveLines.length} turns`, severity: 'normal',
      });
    }
    setState('brief');
  };

  // ─── Doctor TTS ───────────────────────────────────────────────────────────
  const handleSpeakToPatient = async () => {
    if (!activeVisit || !doctorMessage.trim()) return;
    const lang = LANG_CODES[activeVisit.patient.language] ?? 'hi-IN';
    setIsSpeaking(true);
    const timeStr = new Date().toLocaleTimeString('en-IN', {
      hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false,
    });
    setLiveLines(prev => [...prev, {
      speaker: 'doctor', original: doctorMessage,
      translated: doctorMessage, native: doctorMessage, time: timeStr, lang: 'en-IN',
    }]);
    try {
      const res = await fetch('/api/voice/tts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: doctorMessage, language: lang }),
      });
      const data = await res.json();
      if (data.status === 'success' && data.audio_file) {
        // Update live lines with the translation returned from backend
        setLiveLines(prev => [...prev.slice(0, -1), {
          speaker: 'doctor', original: doctorMessage,
          translated: data.text || doctorMessage, native: data.text || doctorMessage, time: timeStr, lang: 'en-IN',
        }]);
        const audio = new Audio(data.audio_file);
        audio.onended = () => setIsSpeaking(false);
        audio.onerror = () => setIsSpeaking(false);
        await audio.play();
      } else {
        setIsSpeaking(false);
      }
    } catch {
      setIsSpeaking(false);
    }
    setDoctorMessage('');
  };

  // ─── Patient selection ────────────────────────────────────────────────────
  const handleSelectPatient = async (visit: Visit) => {
    setActiveVisit(visit);
    activeVisitRef.current = visit;
    store.startConsultation(visit.id);
    setState('consultation');
    setTimer(0);
    setSelectedSymptoms([]);
    setLiveLines([]);
    // startRecording() is now explicitly called by the doctor via UI
  };

  const handleScan = (value: string) => {
    // Basic logic: value might be "PatientID|Language" or just "PatientID"
    let patientId = value;
    let preferredLang = 'Hindi';

    if (value.includes('|')) {
      const parts = value.split('|');
      patientId = parts[0];
      preferredLang = parts[1];
    }

    const visit = store.visits.find(v => v.patientId === patientId && v.status !== 'complete');
    if (visit) {
      if (preferredLang && LANG_CODES[preferredLang]) {
        visit.patient.language = preferredLang as any;
      }
      handleSelectPatient(visit);
    }
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
    setPrescriptions(prev => [...prev, {
      name: selectedMedName, dose: selectedDose,
      frequency: selectedFreq, duration: selectedDuration,
    }]);
    setSelectedMedName(''); setSelectedDose('');
    setSelectedFreq(''); setSelectedDuration('7 days'); setMedSearch('');
  };

  const handleSendToPharmacy = () => {
    if (!activeVisit) return;
    store.addPrescriptions(activeVisit.id, prescriptions.map((p, i) => ({
      id: `rx${Date.now()}-${i}`, drugName: p.name, dose: p.dose,
      frequency: p.frequency, duration: p.duration,
      instructions: '', instructionLocal: '', prescribedBy: 'Dr. Meera', dispensed: false,
    })));
    store.sendToPharmacy(activeVisit.id);
    setPharmacySent(true);
  };

  const resetToLookup = () => {
    setState('lookup'); setActiveVisit(null);
    setLabSent(false); setPharmacySent(false);
    setPrescriptions([]); setSelectedTests(new Set());
  };

  const formatTime = (s: number) =>
    `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;

  const filteredMeds = medicineCatalogue.filter(m =>
    m.name.toLowerCase().includes(medSearch.toLowerCase())
  );
  const todaysPatients = store.getActiveVisits();
  const currentVisit = activeVisit
    ? store.visits.find(v => v.id === activeVisit.id) || activeVisit
    : null;

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <PortalNav />

      {/* LOOKUP */}
      {state === 'lookup' && (
        <div className="flex flex-1 items-center justify-center">
          <div className="w-full max-w-lg space-y-6 text-center">
            <h1 className="font-display text-2xl font-bold">Dr. Meera — Good morning</h1>
            {backendOnline === false && (
              <div className="rounded-lg border border-red-400/40 bg-red-400/10 px-4 py-2 text-sm text-red-600">
                ⚠ Backend offline — run: python server.py
              </div>
            )}
            <QRScannerBox onScan={handleScan} label="Scan Patient QR" placeholder="Enter Patient ID" autoStart context="doctor" />
            <div>
              <p className="mb-3 text-xs font-semibold text-muted-foreground">Today's Patients</p>
              <div className="space-y-2">
                {todaysPatients.map(v => (
                  <PatientCard key={v.id} patient={v.patient} severity={v.severity}
                    chiefComplaint={v.chiefComplaint} compact onClick={() => handleSelectPatient(v)} />
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* CONSULTATION */}
      {state === 'consultation' && currentVisit && (
        <div className="flex flex-1 overflow-hidden">

          {/* Sidebar */}
          <div className="w-56 shrink-0 border-r bg-card p-4 space-y-4 overflow-y-auto">
            <div className="flex items-center gap-2">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground">
                {currentVisit.patient.name.split(' ').map(n => n[0]).join('')}
              </div>
              <div className="min-w-0">
                <p className="text-sm font-bold truncate">{currentVisit.patient.name}</p>
                <p className="text-xs text-muted-foreground">{currentVisit.patient.age}{currentVisit.patient.gender} · {currentVisit.patient.language}</p>
              </div>
            </div>
            {currentVisit.vitals && (
              <div className="space-y-1 text-xs">
                <p className="font-semibold text-muted-foreground">VITALS</p>
                {[['BP', currentVisit.vitals.bp], ['HR', `${currentVisit.vitals.hr} bpm`],
                ['SpO₂', `${currentVisit.vitals.spo2}%`], ['Temp', `${currentVisit.vitals.temp}°C`]
                ].map(([k, v]) => (
                  <div key={k} className="flex justify-between">
                    <span className="text-muted-foreground">{k}</span>
                    <span className="font-medium">{v}</span>
                  </div>
                ))}
              </div>
            )}
            {(currentVisit.patient.allergies?.length ?? 0) > 0 && (
              <div className="rounded-lg border border-red-200 bg-red-50 p-2">
                <p className="text-xs font-bold text-red-700">ALLERGIES</p>
                <p className="text-sm font-bold text-red-600 mt-1">⚠ {currentVisit.patient.allergies.join(', ')}</p>
              </div>
            )}
            {(currentVisit.patient.history?.length ?? 0) > 0 && (
              <div>
                <p className="text-xs font-semibold text-muted-foreground">HISTORY</p>
                {currentVisit.patient.history.map((h: any, i: number) => (
                  <div key={i} className="text-xs mt-1">
                    <p className="text-muted-foreground">{h.date}</p>
                    <p>{h.diagnosis}</p>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Main transcript area */}
          <div className="flex flex-1 flex-col min-w-0">

            {/* Top bar */}
            <div className="flex items-center gap-3 border-b px-4 py-2 shrink-0 bg-card">
              {recording && (
                <span className="flex items-center gap-1.5">
                  <span className={`h-2 w-2 rounded-full ${paused ? 'bg-yellow-500' : 'bg-red-500 animate-pulse'}`} />
                  <span className={`text-sm font-semibold ${paused ? 'text-yellow-600' : 'text-red-600'}`}>
                    {paused ? 'PAUSED' : 'REC'} {formatTime(timer)}
                  </span>
                </span>
              )}
              <div className="ml-auto flex gap-2">
                {!recording ? (
                  <Button size="lg" onClick={startRecording}
                    className="bg-emerald-600 text-white hover:bg-emerald-700 gap-2 px-6 py-5 text-lg font-bold shadow-lg">
                    <Mic className="h-5 w-5" /> Start Consultation
                  </Button>
                ) : (
                  <>
                    <div className="flex items-center px-4 py-1.5 bg-blue-50 border border-blue-200 rounded-full mr-2">
                      <span className="text-sm font-bold text-blue-700 flex items-center gap-2">
                         {isTranscribing ? (
                           <span className="h-2 w-2 rounded-full bg-blue-500 animate-pulse" />
                         ) : (
                           <Activity className="h-4 w-4" />
                         )}
                         {liveLines.length > 0 && liveLines[liveLines.length - 1].speaker === 'patient' 
                           ? 'PATIENT SPEAKING' : 'DOCTOR SPEAKING'}
                      </span>
                    </div>
                    <Button size="sm" variant="outline" onClick={togglePause}>
                      {paused ? <Mic className="h-3 w-3 mr-1" /> : <Pause className="h-3 w-3 mr-1" />}
                      {paused ? 'Resume' : 'Pause'}
                    </Button>
                    <Button size="sm" onClick={handleStopConsultation}
                      className="bg-red-600 text-white hover:bg-red-700 gap-1 font-bold">
                      <Square className="h-3 w-3" /> Stop
                    </Button>
                  </>
                )}
              </div>
            </div>

            {/* Transcript lines */}
            <div ref={transcriptRef} className="flex-1 overflow-y-auto p-4 space-y-3">
              {recording && liveLines.length === 0 && !isTranscribing && (
                <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
                  <div className="flex gap-1 mb-3">
                    {[0, 1, 2].map(i => (
                      <div key={i} className="w-1.5 h-6 bg-emerald-500 rounded-full animate-bounce"
                        style={{ animationDelay: `${i * 0.15}s` }} />
                    ))}
                  </div>
                  <p className="text-xl font-bold mb-2">Listening...</p>
                  <p className="text-sm opacity-60">Auto-sends every 7s · Speak clearly</p>
                </div>
              )}


              {liveLines.map((line, i) => (
                <div key={i} className={`flex gap-3 ${line.speaker === 'doctor' ? 'flex-row-reverse' : ''}`}>
                  <div className={`mt-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-bold shadow-sm ${
                    line.speaker === 'doctor' ? 'bg-blue-600 text-white' : 'bg-orange-500 text-white'
                  }`}>
                    {line.speaker === 'doctor' ? 'Dr' : 'Pt'}
                  </div>
                  <div className={`relative max-w-[85%] rounded-2xl px-5 py-3 shadow-md group border ${
                    line.speaker === 'doctor'
                      ? 'bg-blue-50 border-blue-200 rounded-tr-none'
                      : 'bg-orange-50 border-orange-200 rounded-tl-none'
                  }`}>
                    <div className="flex items-center gap-1.5 mb-1.5 opacity-70">
                      <span className={`text-[10px] font-bold uppercase tracking-widest ${
                        line.speaker === 'doctor' ? 'text-blue-700' : 'text-orange-700'
                      }`}>
                        {line.speaker === 'doctor' ? 'DOCTOR' : 'PATIENT'}
                      </span>
                    </div>
                    <p className="text-xl font-semibold leading-relaxed text-foreground">{line.translated}</p>
                    {line.speaker === 'patient' && line.original !== line.translated && (
                      <p className="text-sm text-muted-foreground mt-2 pt-2 border-t border-black/10 italic opacity-80 font-hindi">
                        Original: {line.original}
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </div>

            {/* Doctor TTS bar */}
            <div className="border-t px-4 py-2 bg-muted/10 shrink-0">
              <div className="flex gap-2">
                <Input
                  value={doctorMessage}
                  onChange={e => setDoctorMessage(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleSpeakToPatient()}
                  placeholder={`Type English → plays aloud in ${currentVisit.patient.language}...`}
                  className="flex-1 text-sm"
                />
                <Button size="sm" onClick={handleSpeakToPatient}
                  disabled={isSpeaking || !doctorMessage.trim()}
                  className="bg-blue-600 text-white hover:bg-blue-700 gap-1 shrink-0">
                  <Volume2 className="h-3 w-3" />
                  {isSpeaking ? 'Speaking...' : 'Speak'}
                </Button>
              </div>
            </div>

            {/* Symptom chips */}
            <div className="flex flex-wrap gap-1.5 border-t px-4 py-2 shrink-0">
              {symptomChips.map(s => (
                <button key={s}
                  onClick={() => setSelectedSymptoms(prev =>
                    prev.includes(s) ? prev.filter(x => x !== s) : [...prev, s]
                  )}
                  className={`rounded-full border px-2.5 py-1 text-xs font-medium transition-all
                    ${selectedSymptoms.includes(s)
                      ? 'border-blue-500 bg-blue-50 text-blue-700'
                      : 'border-border text-muted-foreground hover:border-blue-300'}`}>
                  {s}
                </button>
              ))}
            </div>
          </div>

          {/* Patient tablet preview */}
          <div className="w-48 shrink-0 border-l bg-muted/20 p-3 overflow-y-auto">
            <p className="text-xs font-semibold text-muted-foreground mb-2">PATIENT VIEW</p>
            <div className="rounded-lg border bg-card p-2">
              <p className="text-xs text-center text-muted-foreground mb-2">{currentVisit.patient.language}</p>
              {liveLines.length === 0 ? (
                <p className="text-xs text-muted-foreground text-center py-3">Waiting...</p>
              ) : (
                <div className="space-y-3">
                  {liveLines.slice(-5).map((l, i) => (
                    <div key={i} className={`p-3 rounded-xl shadow-lg border-2 ${
                      l.speaker === 'doctor' 
                        ? 'bg-blue-600 border-blue-400 text-white' 
                        : 'bg-white border-orange-200 text-orange-900'
                    }`}>
                      <span className={`text-[10px] block font-bold uppercase mb-1 ${
                        l.speaker === 'doctor' ? 'text-blue-200' : 'text-orange-500'
                      }`}>
                         {l.speaker === 'doctor' ? 'Dr. Meera' : 'You'}
                      </span>
                      <p className={`font-hindi ${l.speaker === 'doctor' ? 'text-lg leading-tight' : 'text-base'}`}>
                        {l.speaker === 'doctor' ? (l.native || l.translated) : l.original}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* PROCESSING */}
      {state === 'processing' && (
        <div className="flex flex-1 items-center justify-center">
          <div className="text-center">
            <div className="mx-auto h-10 w-10 animate-spin rounded-full border-4 border-blue-500 border-t-transparent" />
            <p className="mt-4 text-sm text-muted-foreground">Generating clinical brief...</p>
          </div>
        </div>
      )}

      {/* BRIEF */}
      {state === 'brief' && currentVisit && (
        <div className="flex-1 overflow-y-auto">
          <div className="flex items-center gap-3 border-b bg-card px-6 py-3">
            <span className="font-display text-sm font-bold">{currentVisit.patient.name}</span>
            <span className="text-xs text-muted-foreground">{currentVisit.patient.age}{currentVisit.patient.gender}</span>
            <SeverityBadge severity="HIGH" />
            <span className="text-xs text-muted-foreground">{currentVisit.patientId}</span>
          </div>

          <div className="mx-auto max-w-5xl p-6 space-y-6">
            <div className="rounded-lg border bg-card p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="font-display text-lg font-bold">CLINICAL RECORD — {currentVisit.patientId}</h2>
                <p className="text-xs text-muted-foreground">Click ✏️ to edit</p>
              </div>
              {[
                { key: 'complaint', label: 'CHIEF COMPLAINT', value: currentVisit.chiefComplaint || 'As described in consultation' },
                { key: 'symptoms', label: 'SYMPTOMS', value: selectedSymptoms.length > 0 ? selectedSymptoms.map(s => `• ${s}`).join('\n') : '• Per transcript' },
                { key: 'assessment', label: 'DIAGNOSIS', value: currentVisit.aiSummary?.diagnosis || 'Under evaluation' },
                { key: 'action', label: 'ACTION TAKEN', value: 'Clinical evaluation complete. Tests and prescriptions ordered.' },
              ].map(section => (
                <div key={section.key} className="mt-4 pt-4 border-t first:border-0 first:pt-0">
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className="text-xs font-bold text-muted-foreground">{section.label}</h3>
                    <button onClick={() => setEditingField(editingField === section.key ? null : section.key)}
                      className="text-blue-500 hover:text-blue-700">
                      <Pencil className="h-3 w-3" />
                    </button>
                  </div>
                  {editingField === section.key ? (
                    <Textarea
                      defaultValue={editValues[section.key] || section.value}
                      onChange={e => setEditValues(prev => ({ ...prev, [section.key]: e.target.value }))}
                      onBlur={() => setEditingField(null)}
                      className="text-sm" autoFocus rows={3} />
                  ) : (
                    <p className="whitespace-pre-line text-sm">{editValues[section.key] || section.value}</p>
                  )}
                </div>
              ))}
            </div>

            <div className="grid grid-cols-2 gap-6">
              {/* Prescription */}
              <div className="rounded-lg border bg-card p-5">
                <div className="flex items-center gap-2 mb-4">
                  <Pill className="h-4 w-4 text-blue-500" />
                  <h3 className="text-sm font-bold">PRESCRIPTION</h3>
                  <span className="ml-auto text-xs text-muted-foreground">{prescriptions.length} medicines</span>
                </div>
                <div className="relative">
                  <div className="flex items-center gap-2">
                    <Search className="h-4 w-4 text-muted-foreground shrink-0" />
                    <Input value={medSearch}
                      onChange={e => { setMedSearch(e.target.value); setShowMedDropdown(true); }}
                      onFocus={() => setShowMedDropdown(true)}
                      placeholder="Search medicine..." className="text-sm" />
                  </div>
                  {showMedDropdown && medSearch && (
                    <div className="absolute z-10 mt-1 w-full max-h-40 overflow-y-auto rounded-lg border bg-card shadow-lg">
                      {filteredMeds.map(m => (
                        <button key={m.name} onClick={() => {
                          setSelectedMedName(m.name); setSelectedDose(m.doses[0]);
                          setSelectedFreq(m.frequencies[0]); setMedSearch(m.name); setShowMedDropdown(false);
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
                    <p className="text-sm font-semibold mb-2">{selectedMedName}</p>
                    <div className="flex flex-wrap gap-2">
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
                      <Button size="sm" onClick={handleAddPrescription} className="bg-green-600 text-white">
                        <Plus className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                )}
                <div className="mt-3 space-y-1.5 max-h-36 overflow-y-auto">
                  {prescriptions.map((p, i) => (
                    <div key={i} className="flex items-center justify-between rounded-md border px-3 py-2">
                      <div>
                        <span className="text-sm font-semibold">💊 {p.name} {p.dose}</span>
                        <span className="ml-1 text-xs text-muted-foreground">{p.frequency} × {p.duration}</span>
                      </div>
                      <button onClick={() => setPrescriptions(prev => prev.filter((_, j) => j !== i))}
                        className="text-red-500 hover:text-red-700">
                        <Trash2 className="h-3 w-3" />
                      </button>
                    </div>
                  ))}
                </div>
                {!pharmacySent ? (
                  <Button onClick={handleSendToPharmacy} className="mt-4 w-full" disabled={prescriptions.length === 0}>
                    <Send className="h-3 w-3 mr-1" /> Send to Pharmacy →
                  </Button>
                ) : (
                  <p className="mt-4 text-sm text-green-600 font-semibold text-center">✓ Sent to pharmacy</p>
                )}
              </div>

              {/* Lab Tests */}
              <div className="rounded-lg border bg-card p-5">
                <div className="flex items-center gap-2 mb-4">
                  <ClipboardList className="h-4 w-4 text-blue-500" />
                  <h3 className="text-sm font-bold">LAB INVESTIGATIONS</h3>
                  <span className="ml-auto text-xs text-muted-foreground">{selectedTests.size} selected</span>
                </div>
                <div className="flex flex-wrap gap-2">
                  {availableTests.map(test => (
                    <label key={test} className="flex items-center gap-1.5 text-sm cursor-pointer">
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
                        <SelectItem key={lab.id} value={lab.id}>{lab.name} ({lab.avgWait}m avg)</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                {!labSent ? (
                  <Button onClick={handleSendToLab} className="mt-4 w-full" disabled={selectedTests.size === 0}>
                    <Send className="h-3 w-3 mr-1" /> Send {selectedTests.size} tests →
                  </Button>
                ) : (
                  <p className="mt-4 text-sm text-green-600 font-semibold text-center">✓ {selectedTests.size} tests sent</p>
                )}
              </div>
            </div>

            <div className="flex gap-3 pt-2">
              <Button className="bg-green-600 text-white hover:bg-green-700 gap-1.5 h-11"
                onClick={async () => {
                  if (currentVisit) {
                    await completeConsultation({
                      visit_id: currentVisit.id,
                      patient_id: currentVisit.patientId,
                      patient_name: currentVisit.patient.name,
                      language: currentVisit.patient.language,
                      diagnosis: currentVisit.aiSummary?.diagnosis,
                      tests: currentVisit.tests.map(t => t.name),
                      prescriptions: currentVisit.prescriptions.map(p => `${p.drugName} ${p.dose}`),
                      follow_up_date: currentVisit.aiSummary?.followUpDate,
                    });
                  }
                  setState('dashboard');
                }}>
                <CheckIcon className="h-4 w-4" /> ✅ Confirm & Upload to Digital Locker
              </Button>
              <Button variant="outline" className="gap-1.5 h-11"
                onClick={() => {
                  if (currentVisit) {
                    const url = getClinicalPDFUrl(currentVisit.id);
                    window.open(url, '_blank');
                  }
                }}>
                📄 Download Clinical Record PDF
              </Button>
              <Button variant="outline" onClick={resetToLookup}>Done — Next Patient</Button>
            </div>
          </div>
        </div>
      )}

      {/* DASHBOARD */}
      {state === 'dashboard' && currentVisit && (
        <div className="flex-1 overflow-y-auto">
          <div className="flex items-center gap-3 border-b bg-card px-6 py-3">
            <Activity className="h-5 w-5 text-blue-500 animate-pulse" />
            <span className="font-display text-sm font-bold">{currentVisit.patient.name}</span>
            <SeverityBadge severity={currentVisit.severity || 'STABLE'} />
            <span className="ml-auto flex items-center gap-1 text-xs text-emerald-500 font-bold">
              <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" /> LIVE
            </span>
          </div>
          <div className="mx-auto max-w-2xl p-6 space-y-4">
            <h2 className="font-display text-xl font-bold flex items-center gap-2">
              <Activity className="h-5 w-5 text-blue-500" /> Live Patient Journey
            </h2>
            <div className="space-y-3">
              <div className="flex items-start gap-4 rounded-xl border bg-card p-4">
                <div className="h-10 w-10 shrink-0 flex items-center justify-center rounded-full bg-emerald-100 text-lg">✅</div>
                <div>
                  <p className="text-sm font-semibold">Consultation Complete</p>
                  <p className="text-xs text-muted-foreground">Dr. Meera · {currentVisit.chiefComplaint}</p>
                </div>
              </div>
              {currentVisit.tests.map(test => (
                <div key={test.id} className="flex items-start gap-4 rounded-xl border border-dashed p-4 bg-muted/30">
                  <div className="h-10 w-10 shrink-0 flex items-center justify-center rounded-full bg-muted text-lg">⬜</div>
                  <div>
                    <p className="text-sm font-semibold">{test.name}</p>
                    <p className="text-xs text-muted-foreground animate-pulse">Waiting for results...</p>
                  </div>
                </div>
              ))}
            </div>
            <div className="flex gap-3 pt-2">
              <Link to={`/patient-exit/${currentVisit.id}`}>
                <Button className="gap-1.5 h-11">
                  <LogOut className="h-4 w-4" /> Send Patient Exit Summary
                </Button>
              </Link>
              <Button variant="outline" onClick={resetToLookup}>Done — Next Patient</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function CheckIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}
