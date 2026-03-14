import { Severity } from '@/lib/types';
import { cn } from '@/lib/utils';

const severityConfig: Record<Severity, { bg: string; text: string; pulse: boolean }> = {
  HIGH: { bg: 'bg-critical', text: 'text-critical-foreground', pulse: true },
  MEDIUM: { bg: 'bg-warning', text: 'text-warning-foreground', pulse: false },
  STABLE: { bg: 'bg-success', text: 'text-success-foreground', pulse: false },
};

export function SeverityBadge({ severity, className }: { severity: Severity; className?: string }) {
  const config = severityConfig[severity];
  return (
    <span className={cn('inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold font-body', config.bg, config.text, className)}>
      {config.pulse && <span className="h-1.5 w-1.5 rounded-full bg-current animate-pulse-recording" />}
      {severity}
    </span>
  );
}
