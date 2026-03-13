import { Patient } from '@/lib/types';
import { SeverityBadge } from './SeverityBadge';
import type { Severity } from '@/lib/types';

interface PatientCardProps {
  patient: Patient;
  severity?: Severity;
  chiefComplaint?: string;
  compact?: boolean;
  onClick?: () => void;
  selected?: boolean;
  children?: React.ReactNode;
}

function getInitials(name: string) {
  return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
}

export function PatientCard({ patient, severity, chiefComplaint, compact, onClick, selected, children }: PatientCardProps) {
  return (
    <div
      onClick={onClick}
      className={`flex items-center gap-3 rounded-lg border bg-card p-3 transition-all duration-fast ${onClick ? 'cursor-pointer hover:border-action/40' : ''} ${selected ? 'border-action ring-1 ring-action/20' : 'border-border'} ${compact ? 'p-2' : ''}`}
    >
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary font-display text-sm font-semibold text-primary-foreground">
        {getInitials(patient.name)}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="truncate font-body text-sm font-semibold text-foreground">{patient.name}</span>
          <span className="shrink-0 text-xs text-muted-foreground">{patient.age}{patient.gender}</span>
          {severity && <SeverityBadge severity={severity} />}
        </div>
        {chiefComplaint && (
          <p className="mt-0.5 truncate text-xs text-muted-foreground">{chiefComplaint}</p>
        )}
        {!compact && (
          <p className="mt-0.5 text-xs text-muted-foreground">{patient.patientId} · {patient.language}</p>
        )}
      </div>
      {children}
    </div>
  );
}
