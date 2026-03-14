import { Link, useLocation } from 'react-router-dom';
import { FileText, UserPlus, Stethoscope, FlaskConical, Pill, Monitor } from 'lucide-react';

const links = [
  { to: '/records', label: 'Records', icon: FileText },
  { to: '/reception', label: 'Reception', icon: UserPlus },
  { to: '/doctor', label: 'Doctor', icon: Stethoscope },
  { to: '/lab', label: 'Lab', icon: FlaskConical },
  { to: '/pharmacy', label: 'Pharmacy', icon: Pill },
  { to: '/waiting-display', label: 'TV Display', icon: Monitor },
];

export function PortalNav() {
  const { pathname } = useLocation();

  return (
    <nav className="flex h-14 items-center gap-1 border-b bg-card px-4">
      <Link to="/" className="mr-4 font-display text-lg font-bold text-foreground">VaidikaAI</Link>
      {links.map(l => {
        const active = pathname.startsWith(l.to);
        return (
          <Link
            key={l.to}
            to={l.to}
            className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-all duration-fast ${active ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-muted hover:text-foreground'}`}
          >
            <l.icon className="h-4 w-4" />
            {l.label}
          </Link>
        );
      })}
    </nav>
  );
}
