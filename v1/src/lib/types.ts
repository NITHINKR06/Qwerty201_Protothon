export type Severity = 'HIGH' | 'MEDIUM' | 'STABLE';
export type Language = 'Hindi' | 'Tamil' | 'Telugu' | 'Kannada' | 'Malayalam' | 'English' | 'Marathi' | 'Gujarati' | 'Punjabi' | 'Bengali' | 'Odia';
export type VisitStatus = 'registered' | 'in-consultation' | 'lab-pending' | 'lab-complete' | 'pharmacy-pending' | 'dispensed' | 'complete';
export type TestStatus = 'pending' | 'in-progress' | 'completed';
export type TestFlag = 'NORMAL' | 'HIGH' | 'LOW' | 'CRITICAL';

export interface Patient {
  id: string;
  patientId: string;
  name: string;
  age: number;
  gender: 'M' | 'F' | 'O';
  aadhaar: string;
  language: Language;
  photo?: string;
  allergies: string[];
  history: PatientHistory[];
}

export interface PatientHistory {
  date: string;
  diagnosis: string;
  medications: string[];
}

export interface Visit {
  id: string;
  patientId: string;
  patient: Patient;
  tokenNumber: number;
  date: string;
  chiefComplaint: string;
  severity: Severity;
  status: VisitStatus;
  assignedDoctor?: string;
  assignedRoom?: string;
  timeline: TimelineEvent[];
  tests: Test[];
  prescriptions: Prescription[];
  aiSummary?: AISummary;
  vitals?: Vitals;
}

export interface Vitals {
  bp: string;
  hr: number;
  spo2: number;
  temp: number;
}

export interface TimelineEvent {
  time: string;
  type: 'registration' | 'consultation' | 'lab' | 'pharmacy' | 'referral';
  title: string;
  detail: string;
  severity?: 'normal' | 'warning' | 'critical';
}

export interface Test {
  id: string;
  name: string;
  status: TestStatus;
  orderedBy: string;
  orderedAt: string;
  results?: TestResult[];
  flag?: TestFlag;
  pdfUrl?: string;
}

export interface TestResult {
  field: string;
  value: string;
  unit: string;
  normalRange: string;
  flag: TestFlag;
}

export interface Prescription {
  id: string;
  drugName: string;
  dose: string;
  frequency: string;
  duration: string;
  instructions?: string;
  instructionLocal?: string;
  prescribedBy: string;
  dispensed: boolean;
}

export interface AISummary {
  narrative: string;
  diagnosis: string;
  severity: Severity;
  actionTaken: string;
  followUpDate: string;
  referrals?: Referral[];
}

export interface Referral {
  specialty: string;
  status: 'sent' | 'accepted' | 'completed';
  date: string;
}

export interface LabOrder {
  patientId: string;
  visitId: string;
  tests: string[];
  urgent: boolean;
  orderedBy: string;
  orderedAt: string;
  lab?: string;
}
