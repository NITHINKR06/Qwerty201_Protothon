import { useState, useEffect } from 'react';
import { PortalNav } from '@/components/shared/PortalNav';
import { QRScannerBox } from '@/components/shared/QRScannerBox';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { QRCodeSVG } from 'qrcode.react';
import { usePatientStore } from '@/lib/patientStore';
import { Language } from '@/lib/types';
import { Printer, AlertTriangle, UserPlus, ScanLine } from 'lucide-react';

const languages: Language[] = ['Hindi', 'Tamil', 'Telugu', 'Kannada', 'Malayalam', 'English'];

type Mode = 'choose' | 'scan' | 'manual' | 'confirm' | 'token';

export default function ReceptionPage() {
  const store = usePatientStore();
  const [mode, setMode] = useState<Mode>('choose');
  const [cameraTrigger, setCameraTrigger] = useState(0);

  // Patient form fields
  const [name, setName] = useState('');
  const [age, setAge] = useState('30');
  const [gender, setGender] = useState<'M' | 'F' | 'O'>('M');
  const [language, setLanguage] = useState<string>('Hindi');
  const [complaint, setComplaint] = useState('');

  // After scan / lookup
  const [foundPatientId, setFoundPatientId] = useState<string | null>(null);
  const [isReturning, setIsReturning] = useState(false);

  // After registration
  const [tokenNumber, setTokenNumber] = useState<number | null>(null);
  const [registeredPatientId, setRegisteredPatientId] = useState<string | null>(null);

  // Alt+M shortcut
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.altKey && (e.key === 'm' || e.key === 'M')) {
        e.preventDefault();
        setMode('scan');
        setCameraTrigger(p => p + 1);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  const handleScan = (value: string) => {
    const patient = store.findPatientById(value);
    if (patient) {
      setFoundPatientId(patient.patientId);
      setName(patient.name);
      setAge(String(patient.age));
      setGender(patient.gender);
      setLanguage(patient.language);
      setIsReturning(true);
      setMode('confirm');
    } else {
      // Try name search
      const byName = store.patients.find(p => p.name.toLowerCase().includes(value.toLowerCase()));
      if (byName) {
        setFoundPatientId(byName.patientId);
        setName(byName.name);
        setAge(String(byName.age));
        setGender(byName.gender);
        setLanguage(byName.language);
        setIsReturning(true);
        setMode('confirm');
      }
    }
  };

  const handleRegister = () => {
    let patientId: string;
    let patientObj: any;
    if (foundPatientId) {
      patientId = foundPatientId;
      patientObj = store.findPatientById(foundPatientId);
    } else {
      const newPatient = store.registerPatient({
        name, age: parseInt(age) || 30, gender, aadhaar: '',
        language: language as Language, allergies: [], history: [],
      });
      patientId = newPatient.patientId;
      patientObj = newPatient;
    }
    const visit = store.createVisit(patientId, complaint, language as Language, patientObj);
    setTokenNumber(visit.tokenNumber);
    setRegisteredPatientId(patientId);
    setMode('token');
  };

  const handleKeyDown = (e: React.KeyboardEvent, nextId?: string, isFinal?: boolean) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      if (isFinal) handleRegister();
      else if (nextId) document.getElementById(nextId)?.focus();
    }
  };

  const resetForm = () => {
    setMode('choose');
    setName(''); setAge('30'); setGender('M'); setLanguage('Hindi'); setComplaint('');
    setFoundPatientId(null); setIsReturning(false);
    setTokenNumber(null); setRegisteredPatientId(null);
  };

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <PortalNav />
      <div className="flex flex-1">
        {/* Left — Registration */}
        <div className="flex-1 border-r p-6">
          <h2 className="font-display text-xl font-bold text-foreground">Patient Registration</h2>
          <p className="mt-1 text-sm text-muted-foreground">Scan previous QR slip or enter details manually</p>

          {/* Step 1 — Choose path */}
          {mode === 'choose' && (
            <div className="mt-8 flex flex-col gap-4 max-w-md mx-auto">
              <Button
                onClick={() => { setMode('scan'); setCameraTrigger(p => p + 1); }}
                className="h-20 text-lg bg-action text-action-foreground hover:bg-action/90 gap-3"
              >
                <ScanLine className="h-6 w-6" />
                Scan Previous QR Slip
              </Button>
              <p className="text-center text-xs text-muted-foreground">— or —</p>
              <Button
                onClick={() => setMode('manual')}
                variant="outline"
                className="h-20 text-lg gap-3"
              >
                <UserPlus className="h-6 w-6" />
                New Patient — Enter Details
              </Button>
            </div>
          )}

          {/* Scan mode */}
          {mode === 'scan' && (
            <div className="mt-6 max-w-lg mx-auto">
              <QRScannerBox
                onScan={handleScan}
                label="Scan patient's previous QR slip"
                placeholder="Enter Patient ID (e.g. VK-2025-00142)"
                autoStart
                externalTrigger={cameraTrigger}
                context="reception"
              />
              <Button variant="ghost" className="mt-4 w-full" onClick={() => setMode('choose')}>← Back</Button>
            </div>
          )}

          {/* Manual entry */}
          {mode === 'manual' && (
            <div className="mt-6 space-y-4 max-w-lg mx-auto">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-medium text-muted-foreground">Name</label>
                  <Input id="reg-name" autoFocus value={name} onChange={e => setName(e.target.value)} onKeyDown={e => handleKeyDown(e, 'reg-age')} placeholder="Patient name" className="mt-1" />
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground">Age / Gender</label>
                  <div className="flex gap-2">
                    <Input id="reg-age" type="number" value={age} onChange={e => setAge(e.target.value)} onKeyDown={e => handleKeyDown(e, 'reg-complaint')} className="mt-1" />
                    <Select value={gender} onValueChange={v => setGender(v as any)}>
                      <SelectTrigger className="mt-1 w-20"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="M">M</SelectItem>
                        <SelectItem value="F">F</SelectItem>
                        <SelectItem value="O">O</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground">Preferred Language</label>
                <Select value={language} onValueChange={setLanguage}>
                  <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>{languages.map(l => <SelectItem key={l} value={l}>{l}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground">Chief Complaint (optional)</label>
                <Input id="reg-complaint" value={complaint} onChange={e => setComplaint(e.target.value)} onKeyDown={e => handleKeyDown(e, undefined, true)} placeholder="What brings the patient in today?" className="mt-1" />
              </div>
              <Button onClick={handleRegister} className="w-full bg-action text-action-foreground hover:bg-action/90 font-semibold text-sm h-11">
                REGISTER PATIENT & GENERATE TOKEN
              </Button>
              <Button variant="ghost" className="w-full" onClick={() => setMode('choose')}>← Back</Button>
            </div>
          )}

          {/* Confirm returning patient */}
          {mode === 'confirm' && (
            <div className="mt-6 space-y-4 max-w-lg mx-auto">
              <div className="flex items-center gap-2 rounded-lg border border-warning/40 bg-warning/10 p-3">
                <AlertTriangle className="h-4 w-4 text-warning" />
                <span className="text-sm text-warning-foreground">Returning patient found</span>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-medium text-muted-foreground">Name</label>
                  <Input value={name} onChange={e => setName(e.target.value)} onKeyDown={e => handleKeyDown(e, 'confirm-age')} className="mt-1" />
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground">Age / Gender</label>
                  <div className="flex gap-2">
                    <Input id="confirm-age" type="number" value={age} onChange={e => setAge(e.target.value)} onKeyDown={e => handleKeyDown(e, 'confirm-complaint')} className="mt-1" />
                    <Select value={gender} onValueChange={v => setGender(v as any)}>
                      <SelectTrigger className="mt-1 w-20"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="M">M</SelectItem>
                        <SelectItem value="F">F</SelectItem>
                        <SelectItem value="O">O</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground">Preferred Language</label>
                <Select value={language} onValueChange={setLanguage}>
                  <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>{languages.map(l => <SelectItem key={l} value={l}>{l}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground">Chief Complaint</label>
                <Input id="confirm-complaint" value={complaint} onChange={e => setComplaint(e.target.value)} onKeyDown={e => handleKeyDown(e, undefined, true)} placeholder="What brings the patient in today?" className="mt-1" />
              </div>
              <Button onClick={handleRegister} className="w-full bg-action text-action-foreground hover:bg-action/90 font-semibold text-sm h-11">
                REGISTER NEW VISIT & GENERATE TOKEN
              </Button>
              <Button variant="ghost" className="w-full" onClick={() => setMode('choose')}>← Back</Button>
            </div>
          )}
        </div>

        {/* Right — Token & Queue */}
        <div className="flex-1 p-6">
          {mode === 'token' && registeredPatientId && tokenNumber ? (
            <div className="space-y-6">
              <div className="print-area mx-auto max-w-sm rounded-lg border bg-card p-8 text-center">
                <p className="text-xs text-muted-foreground">{registeredPatientId}</p>
                <p className="mt-4 font-display text-7xl font-bold text-foreground">TOKEN {tokenNumber}</p>
                <p className="mt-3 text-sm font-medium text-foreground">{name.toUpperCase()} · 13 MAR 2025</p>
                <div className="mt-4 flex justify-center">
                  <QRCodeSVG value={registeredPatientId} size={120} />
                </div>
                <p className="mt-2 text-xs text-muted-foreground">Show this QR at Doctor / Lab / Pharmacy</p>
                <div className="mt-4 flex justify-center gap-2">
                  <Button variant="outline" className="gap-2" onClick={() => window.print()}>
                    <Printer className="h-4 w-4" /> Print Slip
                  </Button>
                  <Button onClick={resetForm} className="bg-action text-action-foreground hover:bg-action/90">
                    Next Patient
                  </Button>
                </div>
              </div>
            </div>
          ) : (
            <div className="flex h-full items-center justify-center text-muted-foreground text-sm">
              Register a patient to generate token
            </div>
          )}

          {/* Live Queue */}
          <div className="mt-8">
            <h3 className="font-display text-sm font-bold text-foreground">NOW SERVING</h3>
            <div className="mt-3 space-y-2">
              {store.getActiveVisits().slice(0, 5).map(v => (
                <div key={v.id} className="flex items-center justify-between rounded-md border bg-card px-4 py-2.5">
                  <div className="flex items-center gap-3">
                    <span className="font-display text-lg font-bold text-foreground">{v.tokenNumber}</span>
                    <span className="text-sm font-medium text-foreground">{v.patient.name}</span>
                  </div>
                  <span className="text-xs text-muted-foreground">→ {v.assignedRoom || 'Waiting'} {v.assignedDoctor ? `(${v.assignedDoctor})` : ''}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
