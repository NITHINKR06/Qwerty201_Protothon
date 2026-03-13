import React, { createContext, useContext, useState, ReactNode } from 'react';
import { Patient, Visit, Prescription, Test, TestResult, Severity, Language, VisitStatus } from './types';

// ─── Medicine catalogue (50+ medicines) ──────────────────────────────
export interface Medicine {
  name: string;
  doses: string[];
  frequencies: string[];
  category: string;
}

export const medicineCatalogue: Medicine[] = [
  // Cardiovascular
  { name: 'Aspirin', doses: ['75mg', '150mg', '325mg'], frequencies: ['OD', 'BD', 'stat'], category: 'Antiplatelet' },
  { name: 'Clopidogrel', doses: ['75mg', '150mg'], frequencies: ['OD'], category: 'Antiplatelet' },
  { name: 'Atorvastatin', doses: ['10mg', '20mg', '40mg', '80mg'], frequencies: ['OD at night'], category: 'Statin' },
  { name: 'Rosuvastatin', doses: ['5mg', '10mg', '20mg', '40mg'], frequencies: ['OD at night'], category: 'Statin' },
  { name: 'Amlodipine', doses: ['2.5mg', '5mg', '10mg'], frequencies: ['OD'], category: 'CCB' },
  { name: 'Losartan', doses: ['25mg', '50mg', '100mg'], frequencies: ['OD'], category: 'ARB' },
  { name: 'Telmisartan', doses: ['20mg', '40mg', '80mg'], frequencies: ['OD'], category: 'ARB' },
  { name: 'Enalapril', doses: ['2.5mg', '5mg', '10mg', '20mg'], frequencies: ['OD', 'BD'], category: 'ACE Inhibitor' },
  { name: 'Ramipril', doses: ['1.25mg', '2.5mg', '5mg', '10mg'], frequencies: ['OD'], category: 'ACE Inhibitor' },
  { name: 'Metoprolol', doses: ['25mg', '50mg', '100mg'], frequencies: ['OD', 'BD'], category: 'Beta Blocker' },
  { name: 'Atenolol', doses: ['25mg', '50mg', '100mg'], frequencies: ['OD'], category: 'Beta Blocker' },
  { name: 'Nitroglycerine', doses: ['0.5mg SL', '2.5mg', '5mg'], frequencies: ['PRN', 'BD', 'TDS'], category: 'Vasodilator' },
  { name: 'Furosemide', doses: ['20mg', '40mg', '80mg'], frequencies: ['OD', 'BD'], category: 'Diuretic' },
  { name: 'Hydrochlorothiazide', doses: ['12.5mg', '25mg'], frequencies: ['OD'], category: 'Diuretic' },
  { name: 'Digoxin', doses: ['0.125mg', '0.25mg'], frequencies: ['OD'], category: 'Cardiac Glycoside' },
  { name: 'Warfarin', doses: ['1mg', '2mg', '5mg'], frequencies: ['OD'], category: 'Anticoagulant' },
  { name: 'Heparin', doses: ['5000 IU', '10000 IU'], frequencies: ['BD SC', 'TDS SC'], category: 'Anticoagulant' },
  // Analgesic / Anti-inflammatory
  { name: 'Paracetamol', doses: ['500mg', '650mg', '1000mg'], frequencies: ['SOS', 'TDS', 'QID'], category: 'Analgesic' },
  { name: 'Ibuprofen', doses: ['200mg', '400mg', '600mg'], frequencies: ['BD', 'TDS'], category: 'NSAID' },
  { name: 'Diclofenac', doses: ['50mg', '75mg', '100mg'], frequencies: ['BD', 'TDS'], category: 'NSAID' },
  { name: 'Naproxen', doses: ['250mg', '500mg'], frequencies: ['BD'], category: 'NSAID' },
  { name: 'Tramadol', doses: ['50mg', '100mg'], frequencies: ['BD', 'TDS'], category: 'Opioid Analgesic' },
  // Antibiotics
  { name: 'Amoxicillin', doses: ['250mg', '500mg'], frequencies: ['TDS', 'BD'], category: 'Antibiotic' },
  { name: 'Amoxicillin + Clavulanate', doses: ['375mg', '625mg', '1g'], frequencies: ['BD', 'TDS'], category: 'Antibiotic' },
  { name: 'Azithromycin', doses: ['250mg', '500mg'], frequencies: ['OD × 3 days', 'OD × 5 days'], category: 'Antibiotic' },
  { name: 'Ciprofloxacin', doses: ['250mg', '500mg', '750mg'], frequencies: ['BD'], category: 'Antibiotic' },
  { name: 'Levofloxacin', doses: ['250mg', '500mg', '750mg'], frequencies: ['OD'], category: 'Antibiotic' },
  { name: 'Cefixime', doses: ['200mg', '400mg'], frequencies: ['OD', 'BD'], category: 'Antibiotic' },
  { name: 'Doxycycline', doses: ['100mg'], frequencies: ['OD', 'BD'], category: 'Antibiotic' },
  { name: 'Metronidazole', doses: ['200mg', '400mg'], frequencies: ['TDS'], category: 'Antibiotic' },
  // GI
  { name: 'Omeprazole', doses: ['20mg', '40mg'], frequencies: ['OD before food', 'BD'], category: 'PPI' },
  { name: 'Pantoprazole', doses: ['20mg', '40mg'], frequencies: ['OD before food'], category: 'PPI' },
  { name: 'Ranitidine', doses: ['150mg', '300mg'], frequencies: ['BD', 'OD at night'], category: 'H2 Blocker' },
  { name: 'Domperidone', doses: ['10mg'], frequencies: ['TDS before food'], category: 'Prokinetic' },
  { name: 'Ondansetron', doses: ['4mg', '8mg'], frequencies: ['TDS', 'SOS'], category: 'Antiemetic' },
  { name: 'ORS Sachets', doses: ['1 sachet'], frequencies: ['After each loose stool'], category: 'Rehydration' },
  // Diabetes
  { name: 'Metformin', doses: ['500mg', '850mg', '1000mg'], frequencies: ['OD', 'BD'], category: 'Antidiabetic' },
  { name: 'Glimepiride', doses: ['1mg', '2mg', '4mg'], frequencies: ['OD before breakfast'], category: 'Antidiabetic' },
  { name: 'Sitagliptin', doses: ['50mg', '100mg'], frequencies: ['OD'], category: 'DPP-4 Inhibitor' },
  { name: 'Insulin Glargine', doses: ['10 units', '20 units', '30 units'], frequencies: ['OD at night SC'], category: 'Insulin' },
  // Respiratory
  { name: 'Salbutamol Inhaler', doses: ['100mcg', '200mcg'], frequencies: ['PRN', 'BD'], category: 'Bronchodilator' },
  { name: 'Budesonide Inhaler', doses: ['100mcg', '200mcg', '400mcg'], frequencies: ['BD'], category: 'Inhaled Steroid' },
  { name: 'Montelukast', doses: ['4mg', '5mg', '10mg'], frequencies: ['OD at night'], category: 'LTRA' },
  { name: 'Theophylline', doses: ['100mg', '200mg', '300mg'], frequencies: ['BD'], category: 'Bronchodilator' },
  // Antihistamine / Allergy
  { name: 'Cetirizine', doses: ['5mg', '10mg'], frequencies: ['OD at night'], category: 'Antihistamine' },
  { name: 'Levocetirizine', doses: ['5mg'], frequencies: ['OD at night'], category: 'Antihistamine' },
  { name: 'Chlorpheniramine', doses: ['4mg'], frequencies: ['BD', 'TDS'], category: 'Antihistamine' },
  { name: 'Prednisolone', doses: ['5mg', '10mg', '20mg', '40mg'], frequencies: ['OD morning', 'tapering'], category: 'Corticosteroid' },
  // Neuro / Psych
  { name: 'Amitriptyline', doses: ['10mg', '25mg', '50mg'], frequencies: ['OD at night'], category: 'TCA' },
  { name: 'Gabapentin', doses: ['100mg', '300mg', '600mg'], frequencies: ['TDS'], category: 'Anticonvulsant' },
  { name: 'Alprazolam', doses: ['0.25mg', '0.5mg'], frequencies: ['SOS', 'OD at night'], category: 'Benzodiazepine' },
  // Supplements
  { name: 'Vitamin D3', doses: ['1000 IU', '60000 IU'], frequencies: ['OD', 'Weekly'], category: 'Supplement' },
  { name: 'Iron + Folic Acid', doses: ['1 tablet'], frequencies: ['OD after food'], category: 'Supplement' },
  { name: 'Calcium + Vit D3', doses: ['500mg + 250 IU'], frequencies: ['OD', 'BD'], category: 'Supplement' },
  { name: 'Multivitamin', doses: ['1 tablet'], frequencies: ['OD'], category: 'Supplement' },
];

// ─── Lab options ─────────────────────────────────────────────
export const labOptions = [
  { id: 'labA', name: 'Lab A — Ground Floor', avgWait: 12 },
  { id: 'labB', name: 'Lab B — 2nd Floor', avgWait: 4 },
];

// ─── Available tests ──────────────────────────────────────────
export const availableTests = [
  'ECG', 'CBC', 'Troponin I', 'CXR', 'BMP', 'HbA1c', 'Lipid Panel',
  'Liver Function', 'Kidney Function', 'Thyroid Panel', 'Urine Routine',
  'Blood Glucose', 'D-Dimer', 'CRP', 'ESR',
];

// ─── Dummy transcript for consultation ───────────────────────
export interface TranscriptLine {
  speaker: 'patient' | 'doctor';
  original: string;
  translated: string;
  time: string;
}

export const dummyTranscript: TranscriptLine[] = [
  { speaker: 'patient', original: 'Seene mein dard hai do din se, aur bukhaar bhi...', translated: 'I have had chest pain for 2 days, and also fever...', time: '00:12' },
  { speaker: 'doctor', original: 'Where exactly is the pain? Can you point?', translated: 'Dard kahan hai exactly? Kya aap dikha sakte hain?', time: '00:28' },
  { speaker: 'patient', original: 'Yahan, beech mein... aur kabhi kabhi baayein haath mein bhi jaata hai', translated: 'Here, in the center... and sometimes it goes to my left arm too', time: '00:45' },
  { speaker: 'doctor', original: 'How long does each episode of pain last?', translated: 'Har baar dard kitni der tak rehta hai?', time: '01:02' },
  { speaker: 'patient', original: 'Kuch minute, 10-15 minute... phir thoda kam ho jaata hai', translated: 'A few minutes, 10-15 minutes... then it reduces a bit', time: '01:18' },
  { speaker: 'doctor', original: 'Do you feel sweaty or nauseous during the pain?', translated: 'Kya dard ke waqt paseena aata hai ya ulti jaisa lagta hai?', time: '01:35' },
  { speaker: 'patient', original: 'Haan, paseena bahut aata hai... aur chakkar bhi aate hain', translated: 'Yes, I sweat a lot... and feel dizzy too', time: '01:50' },
  { speaker: 'doctor', original: 'Any history of heart disease in family?', translated: 'Kya parivaar mein kisi ko dil ki bimari hai?', time: '02:10' },
  { speaker: 'patient', original: 'Mere pitaji ko heart attack aaya tha 60 saal ki umar mein', translated: 'My father had a heart attack at age 60', time: '02:25' },
];

// ─── Pre-seeded patients ─────────────────────────────────────
const seedPatients: Patient[] = [
  {
    id: '1', patientId: 'VK-2025-00142', name: 'Ravi Kumar', age: 52, gender: 'M',
    aadhaar: '9876-5432-1012', language: 'Hindi',
    allergies: ['Penicillin'],
    history: [{ date: '10 Mar 2025', diagnosis: 'Hypertension', medications: ['Amlodipine 5mg'] }],
  },
  {
    id: '2', patientId: 'VK-2025-00138', name: 'Priya Mehta', age: 34, gender: 'F',
    aadhaar: '8765-4321-0987', language: 'English',
    allergies: [], history: [],
  },
  {
    id: '3', patientId: 'VK-2025-00145', name: 'Arjun Sharma', age: 61, gender: 'M',
    aadhaar: '7654-3210-9876', language: 'Hindi',
    allergies: ['Sulfa drugs'],
    history: [{ date: '5 Mar 2025', diagnosis: 'Type 2 Diabetes', medications: ['Metformin 500mg'] }],
  },
];

// Pre-seeded visit for Ravi Kumar (fully progressed — has tests + prescriptions for demo)
const seedVisits: Visit[] = [
  {
    id: 'v1', patientId: 'VK-2025-00142', patient: seedPatients[0],
    tokenNumber: 42, date: '13 Mar 2025',
    chiefComplaint: 'Chest pain radiating to left arm, fever',
    severity: 'HIGH', status: 'lab-pending',
    assignedDoctor: 'Dr. Meera', assignedRoom: 'Room 3',
    vitals: { bp: '158/94', hr: 104, spo2: 97, temp: 38.4 },
    timeline: [
      { time: '09:12', type: 'registration', title: 'Registration', detail: 'Registered · Hindi', severity: 'normal' },
      { time: '09:18', type: 'consultation', title: 'Consultation Complete', detail: 'Dr. Meera · 02:45 recording', severity: 'normal' },
      { time: '09:22', type: 'lab', title: 'Sent to Lab', detail: '3 tests ordered', severity: 'normal' },
    ],
    tests: [
      { id: 't1', name: 'ECG', status: 'pending', orderedBy: 'Dr. Meera', orderedAt: '09:22' },
      { id: 't2', name: 'CBC', status: 'pending', orderedBy: 'Dr. Meera', orderedAt: '09:22' },
      { id: 't3', name: 'Troponin I', status: 'pending', orderedBy: 'Dr. Meera', orderedAt: '09:22' },
    ],
    prescriptions: [
      { id: 'rx1', drugName: 'Aspirin', dose: '325mg', frequency: 'OD', duration: '30 days', instructions: 'Take after food', prescribedBy: 'Dr. Meera', dispensed: false },
      { id: 'rx2', drugName: 'Atorvastatin', dose: '40mg', frequency: 'OD at night', duration: '30 days', instructions: 'Take at bedtime', prescribedBy: 'Dr. Meera', dispensed: false },
      { id: 'rx3', drugName: 'Metoprolol', dose: '25mg', frequency: 'BD', duration: '14 days', instructions: '', prescribedBy: 'Dr. Meera', dispensed: false },
    ],
    aiSummary: {
      narrative: 'Ravi Kumar, a 52-year-old male, presented with substernal chest pain radiating to left arm for 2 days, associated with fever (38.4°C), diaphoresis, and dizziness. Family history significant for paternal MI at age 60. Known hypertensive on Amlodipine 5mg. Vitals show elevated BP 158/94, tachycardia HR 104. Clinical picture concerning for Acute Coronary Syndrome.',
      diagnosis: 'Suspected Acute Coronary Syndrome (ACS)',
      severity: 'HIGH',
      actionTaken: 'ECG, CBC, Troponin ordered. Aspirin 325mg stat. Atorvastatin 40mg started. Metoprolol 25mg BD initiated. Refer Cardiology if Troponin positive.',
      followUpDate: '16 Mar 2025',
      referrals: [{ specialty: 'Cardiology', status: 'sent', date: '13 Mar 2025' }],
    },
  },
  {
    id: 'v2', patientId: 'VK-2025-00138', patient: seedPatients[1],
    tokenNumber: 38, date: '13 Mar 2025',
    chiefComplaint: 'Severe migraine, nausea',
    severity: 'MEDIUM', status: 'registered',
    assignedDoctor: 'Dr. Raj', assignedRoom: 'Room 1',
    vitals: { bp: '120/80', hr: 78, spo2: 99, temp: 36.8 },
    timeline: [
      { time: '08:50', type: 'registration', title: 'Registration', detail: 'Registered · English', severity: 'normal' },
    ],
    tests: [], prescriptions: [],
  },
  {
    id: 'v3', patientId: 'VK-2025-00145', patient: seedPatients[2],
    tokenNumber: 45, date: '13 Mar 2025',
    chiefComplaint: 'Routine diabetes checkup',
    severity: 'STABLE', status: 'registered',
    assignedDoctor: 'Dr. Singh', assignedRoom: 'Room 2',
    vitals: { bp: '130/85', hr: 72, spo2: 98, temp: 36.6 },
    timeline: [
      { time: '08:35', type: 'registration', title: 'Registration', detail: 'Registered · Hindi', severity: 'normal' },
    ],
    tests: [], prescriptions: [],
  },
];

// ─── Context ─────────────────────────────────────────────────
interface PatientStoreContextType {
  patients: Patient[];
  visits: Visit[];
  nextToken: number;

  findPatientById: (patientId: string) => Patient | undefined;
  findVisitByPatientId: (patientId: string) => Visit | undefined;
  getActiveVisits: () => Visit[];
  getVisitsWithPendingTests: () => Visit[];
  getVisitsWithPendingPrescriptions: () => Visit[];

  registerPatient: (patient: Omit<Patient, 'id' | 'patientId'>) => Patient;
  createVisit: (patientId: string, complaint: string, language: Language, patientObj?: Patient) => Visit;
  startConsultation: (visitId: string) => void;
  updateVisitSummary: (visitId: string, summary: any) => void;
  addTests: (visitId: string, tests: Test[]) => void;
  addPrescriptions: (visitId: string, prescriptions: Prescription[]) => void;
  sendToLab: (visitId: string, labId: string) => void;
  sendToPharmacy: (visitId: string) => void;
  submitLabResults: (visitId: string, testId: string, results: TestResult[], flag: string) => void;
  dispenseMedicine: (visitId: string, prescriptionId: string) => void;
  completeVisit: (visitId: string) => void;
  addTimelineEvent: (visitId: string, event: any) => void;
}

const PatientStoreContext = createContext<PatientStoreContextType | null>(null);

export function PatientProvider({ children }: { children: ReactNode }) {
  const [patients, setPatients] = useState<Patient[]>(seedPatients);
  const [visits, setVisits] = useState<Visit[]>(seedVisits);
  const [nextToken, setNextToken] = useState(46);
  const [nextPatientNum, setNextPatientNum] = useState(146);

  const genPatientId = () => {
    const id = `VK-2025-${String(nextPatientNum).padStart(5, '0')}`;
    setNextPatientNum(n => n + 1);
    return id;
  };

  const findPatientById = (patientId: string) => patients.find(p => p.patientId === patientId);
  const findVisitByPatientId = (patientId: string) => visits.find(v => v.patientId === patientId && v.status !== 'complete');
  const getActiveVisits = () => visits.filter(v => v.status !== 'complete');
  const getVisitsWithPendingTests = () => visits.filter(v => v.tests.some(t => t.status === 'pending'));
  const getVisitsWithPendingPrescriptions = () => visits.filter(v => v.prescriptions.length > 0 && !v.prescriptions.every(p => p.dispensed) && v.status !== 'complete');

  const registerPatient = (data: Omit<Patient, 'id' | 'patientId'>): Patient => {
    const existing = patients.find(p => p.name.toLowerCase() === data.name.toLowerCase() && p.age === data.age);
    if (existing) return existing;
    const newPatient: Patient = { ...data, id: String(Date.now()), patientId: genPatientId() };
    setPatients(prev => [...prev, newPatient]);
    return newPatient;
  };

  const createVisit = (patientId: string, complaint: string, language: Language, patientObj?: Patient): Visit => {
    // Use provided patient object first (avoids stale state after registerPatient),
    // then fall back to state lookup
    const patient = patientObj || patients.find(p => p.patientId === patientId);
    if (!patient) {
      throw new Error(`Patient not found: ${patientId}`);
    }
    const token = nextToken;
    setNextToken(t => t + 1);
    const now = new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: false });
    const newVisit: Visit = {
      id: `v${Date.now()}`, patientId, patient,
      tokenNumber: token, date: '13 Mar 2025',
      chiefComplaint: complaint, severity: 'STABLE', status: 'registered',
      timeline: [{ time: now, type: 'registration', title: 'Registration', detail: `Registered · ${language}`, severity: 'normal' }],
      tests: [], prescriptions: [],
    };
    setVisits(prev => [...prev, newVisit]);
    return newVisit;
  };

  const updateVisit = (visitId: string, fn: (v: Visit) => Visit) => {
    setVisits(prev => prev.map(v => v.id === visitId ? fn({ ...v }) : v));
  };

  const startConsultation = (visitId: string) => updateVisit(visitId, v => ({ ...v, status: 'in-consultation' as VisitStatus }));

  const updateVisitSummary = (visitId: string, summary: any) => updateVisit(visitId, v => ({ ...v, aiSummary: summary }));

  const addTests = (visitId: string, tests: Test[]) => updateVisit(visitId, v => ({ ...v, tests: [...v.tests, ...tests] }));

  const addPrescriptions = (visitId: string, prescriptions: Prescription[]) => updateVisit(visitId, v => ({ ...v, prescriptions: [...v.prescriptions, ...prescriptions] }));

  const sendToLab = (visitId: string, _labId: string) => {
    updateVisit(visitId, v => {
      const now = new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: false });
      return { ...v, status: 'lab-pending' as VisitStatus, timeline: [...v.timeline, { time: now, type: 'lab' as const, title: 'Sent to Lab', detail: `${v.tests.length} tests ordered`, severity: 'normal' as const }] };
    });
  };

  const sendToPharmacy = (visitId: string) => {
    updateVisit(visitId, v => {
      const now = new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: false });
      return { ...v, status: 'pharmacy-pending' as VisitStatus, timeline: [...v.timeline, { time: now, type: 'pharmacy' as const, title: 'Sent to Pharmacy', detail: `${v.prescriptions.length} medicines`, severity: 'normal' as const }] };
    });
  };

  const submitLabResults = (visitId: string, testId: string, results: TestResult[], flag: string) => {
    updateVisit(visitId, v => {
      const now = new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: false });
      const updatedTests = v.tests.map(t => t.id === testId ? { ...t, status: 'completed' as const, results, flag: flag as any } : t);
      const allDone = updatedTests.every(t => t.status === 'completed');
      return {
        ...v, tests: updatedTests,
        status: allDone ? 'lab-complete' as VisitStatus : v.status,
        timeline: [...v.timeline, { time: now, type: 'lab' as const, title: `Lab — ${flag === 'CRITICAL' ? '🔴 CRITICAL' : 'Results'}`, detail: results.map(r => `${r.field}: ${r.value} ${r.unit}`).join(' · '), severity: flag === 'CRITICAL' ? 'critical' as const : 'normal' as const }],
      };
    });
  };

  const dispenseMedicine = (visitId: string, prescriptionId: string) => {
    updateVisit(visitId, v => ({ ...v, prescriptions: v.prescriptions.map(p => p.id === prescriptionId ? { ...p, dispensed: true } : p) }));
  };

  const completeVisit = (visitId: string) => {
    updateVisit(visitId, v => {
      const now = new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: false });
      return { ...v, status: 'complete' as VisitStatus, timeline: [...v.timeline, { time: now, type: 'pharmacy' as const, title: 'Visit Complete', detail: 'All medications dispensed', severity: 'normal' as const }] };
    });
  };

  const addTimelineEvent = (visitId: string, event: any) => updateVisit(visitId, v => ({ ...v, timeline: [...v.timeline, event] }));

  return (
    <PatientStoreContext.Provider value={{
      patients, visits, nextToken,
      findPatientById, findVisitByPatientId, getActiveVisits,
      getVisitsWithPendingTests, getVisitsWithPendingPrescriptions,
      registerPatient, createVisit, startConsultation,
      updateVisitSummary, addTests, addPrescriptions,
      sendToLab, sendToPharmacy, submitLabResults,
      dispenseMedicine, completeVisit, addTimelineEvent,
    }}>
      {children}
    </PatientStoreContext.Provider>
  );
}

export function usePatientStore() {
  const ctx = useContext(PatientStoreContext);
  if (!ctx) throw new Error('usePatientStore must be used within PatientProvider');
  return ctx;
}
