import React, { createContext, useContext, useState, ReactNode, useEffect } from 'react';
import { Patient, Visit, Prescription, Test, TestResult, Severity, Language, VisitStatus } from './types';
import * as api from './api';

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

const seedVisits: Visit[] = [];

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

  registerPatient: (patient: Omit<Patient, 'id' | 'patientId'>) => Promise<Patient>;
  createVisit: (patientId: string, complaint: string, language: Language, patientObj?: Patient) => Promise<Visit>;
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
  refreshPatients: () => Promise<void>;
  refreshVisits: () => Promise<void>;
}

const PatientStoreContext = createContext<PatientStoreContextType | null>(null);

export function PatientProvider({ children }: { children: ReactNode }) {
  const [patients, setPatients] = useState<Patient[]>(seedPatients);
  const [visits, setVisits] = useState<Visit[]>(seedVisits);
  const [nextToken, setNextToken] = useState(46);
  const [nextPatientNum, setNextPatientNum] = useState(146);

  // Sync with backend on mount
  useEffect(() => {
    refreshPatients();
    refreshVisits();
  }, []);

  const refreshVisits = async () => {
    const backendVisits = await api.getVisits();
    if (backendVisits && backendVisits.length > 0) {
      const mapped: Visit[] = backendVisits.map(v => ({
        id: v.id,
        patientId: v.patient_id,
        patient: {
          id: v.patient.patientId,
          patientId: v.patient.patientId,
          name: v.patient.name,
          age: v.patient.age,
          gender: v.patient.gender as any,
          language: v.patient.language as Language,
          aadhaar: '',
          allergies: [],
          history: []
        },
        tokenNumber: v.token_number,
        date: v.date,
        chiefComplaint: v.chief_complaint,
        severity: v.severity as Severity,
        status: v.status as VisitStatus,
        assignedDoctor: v.assigned_doctor,
        assignedRoom: v.assigned_room,
        vitals: v.vitals,
        timeline: v.timeline || [],
        tests: [],
        prescriptions: []
      }));
      // Merge with seed visits
      setVisits(prev => {
        const existingIds = new Set(prev.map(v => v.id));
        const newOnes = mapped.filter(v => !existingIds.has(v.id));
        return [...prev, ...newOnes];
      });
    }
  };

  const refreshPatients = async () => {
    const backendPatients = await api.getPatients();
    if (backendPatients && backendPatients.length > 0) {
      // Map backend PatientRecord to frontend Patient type
      const mapped = backendPatients.map(p => ({
        id: p.patient_id, // Use patient_id as unique id
        patientId: p.patient_id,
        name: p.name,
        age: p.age,
        gender: p.gender,
        language: p.language as Language,
        aadhaar: p.aadhaar || '',
        allergies: p.allergies || [],
        history: p.history || []
      }));
      // Merge with seed patients (seed patients prioritized by patientId)
      setPatients(prev => {
        const existingIds = new Set(prev.map(p => p.patientId));
        const newOnes = mapped.filter(p => !existingIds.has(p.patientId));
        return [...prev, ...newOnes];
      });
    }
  };
   
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

  const registerPatient = async (data: Omit<Patient, 'id' | 'patientId'>): Promise<Patient> => {
    // Check if already in memory
    const inMemoryMatch = patients.find(p => p.name.toLowerCase() === data.name.toLowerCase() && p.age === data.age);
    if (inMemoryMatch) return inMemoryMatch;

    // Try backend registration
    const response = await api.registerPatient({
      name: data.name,
      age: data.age,
      gender: data.gender,
      language: data.language,
      aadhaar: data.aadhaar,
      allergies: data.allergies,
      history: data.history
    });

    if (response) {
      const newPatient: Patient = {
        id: response.patient_id,
        patientId: response.patient_id,
        name: response.name,
        age: response.age,
        gender: response.gender as any,
        language: response.language as any,
        aadhaar: response.aadhaar || '',
        allergies: response.allergies || [],
        history: response.history || []
      };
      setPatients(prev => [...prev, newPatient]);
      return newPatient;
    }

    // Fallback to in-memory if backend fails
    const newPatient: Patient = { ...data, id: String(Date.now()), patientId: genPatientId() };
    setPatients(prev => [...prev, newPatient]);
    return newPatient;
  };

  const createVisit = async (patientId: string, complaint: string, language: Language, patientObj?: Patient): Promise<Visit> => {
    const patient = patientObj || patients.find(p => p.patientId === patientId);
    if (!patient) {
      throw new Error(`Patient not found: ${patientId}`);
    }
    
    // Try backend persistence
    const response = await api.createVisit({
      patient_id: patientId,
      chief_complaint: complaint,
      language: language
    });

    if (response) {
      const now = new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: false });
      const newVisit: Visit = {
        id: response.visit_id, 
        patientId, 
        patient,
        tokenNumber: response.token_number, 
        date: new Date().toLocaleDateString('en-IN'),
        chiefComplaint: complaint, 
        severity: 'STABLE', 
        status: 'registered',
        timeline: [{ time: now, type: 'registration', title: 'Registration', detail: `Registered · ${language}`, severity: 'normal' }],
        tests: [], 
        prescriptions: [],
      };
      setVisits(prev => [...prev, newVisit]);
      return newVisit;
    }

    // Fallback to in-memory
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

  const updateVisit = (visitId: string, fn: (v: Visit) => Visit, backendUpdate?: any) => {
    setVisits(prev => prev.map(v => v.id === visitId ? fn({ ...v }) : v));
    if (backendUpdate) {
      api.updateVisit(visitId, backendUpdate);
    }
  };

  const startConsultation = (visitId: string) => updateVisit(visitId, v => ({ ...v, status: 'in-consultation' as VisitStatus }), { status: 'in-consultation' });

  const updateVisitSummary = (visitId: string, summary: any) => updateVisit(visitId, v => ({ ...v, aiSummary: summary }), { timeline_event: { time: new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: false }), type: 'consultation', title: 'AI Summmary Generated', severity: 'normal' } });

  const addTests = (visitId: string, tests: Test[]) => updateVisit(visitId, v => ({ ...v, tests: [...v.tests, ...tests] }));

  const addPrescriptions = (visitId: string, prescriptions: Prescription[]) => updateVisit(visitId, v => ({ ...v, prescriptions: [...v.prescriptions, ...prescriptions] }));

  const sendToLab = (visitId: string, _labId: string) => {
    updateVisit(visitId, v => {
      const updated = { ...v, status: 'in-lab' as VisitStatus };
      return updated;
    }, { status: 'in-lab' });
  };

  const sendToPharmacy = (visitId: string) => {
    updateVisit(visitId, v => {
      const updated = { ...v, status: 'in-pharmacy' as VisitStatus };
      return updated;
    }, { status: 'in-pharmacy' });
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
    updateVisit(visitId, v => ({ ...v, status: 'complete' as VisitStatus }), { status: 'complete' });
  };

  const addTimelineEvent = (visitId: string, event: any) => {
    updateVisit(visitId, v => ({ ...v, timeline: [...v.timeline, event] }), { timeline_event: event });
  };
  return (
    <PatientStoreContext.Provider value={{
      patients, visits, nextToken,
      findPatientById, findVisitByPatientId, getActiveVisits,
      getVisitsWithPendingTests, getVisitsWithPendingPrescriptions,
      registerPatient, createVisit, startConsultation,
      updateVisitSummary, addTests, addPrescriptions,
      sendToLab, sendToPharmacy, submitLabResults,
      dispenseMedicine, completeVisit, addTimelineEvent,
      refreshPatients, refreshVisits,
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
