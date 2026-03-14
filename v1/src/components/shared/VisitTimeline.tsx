import { TimelineEvent } from '@/lib/types';

const dotColor: Record<string, string> = {
  normal: 'bg-success',
  warning: 'bg-warning',
  critical: 'bg-critical',
};

export function VisitTimeline({ events }: { events: TimelineEvent[] }) {
  return (
    <div className="space-y-0">
      {events.map((event, i) => (
        <div key={i} className="flex gap-3 pb-4 last:pb-0">
          <div className="flex flex-col items-center">
            <div className={`mt-1 h-2.5 w-2.5 rounded-full ${dotColor[event.severity || 'normal']}`} />
            {i < events.length - 1 && <div className="mt-1 w-px flex-1 bg-border" />}
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-baseline gap-2">
              <span className="text-xs font-medium text-muted-foreground">{event.time}</span>
              <span className="text-xs font-semibold text-foreground">{event.title}</span>
            </div>
            <p className="mt-0.5 text-xs text-muted-foreground">{event.detail}</p>
          </div>
        </div>
      ))}
    </div>
  );
}
