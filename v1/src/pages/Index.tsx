import { PortalNav } from '@/components/shared/PortalNav';
import { Link } from 'react-router-dom';
import { FileText, UserPlus, Stethoscope, FlaskConical, Pill } from 'lucide-react';

const portals = [
  { to: '/records', label: 'Master Records', desc: 'Search and view complete patient history', icon: FileText, color: 'bg-primary' },
  { to: '/reception', label: 'Reception', desc: 'Register patients and generate tokens', icon: UserPlus, color: 'bg-action' },
  { to: '/doctor', label: 'Doctor Portal', desc: 'Consult, diagnose, and prescribe', icon: Stethoscope, color: 'bg-success' },
  { to: '/lab', label: 'Laboratory', desc: 'Process tests and submit results', icon: FlaskConical, color: 'bg-warning' },
  { to: '/pharmacy', label: 'Pharmacy', desc: 'Verify and dispense medications', icon: Pill, color: 'bg-critical' },
];

const Index = () => (
  <div className="min-h-screen bg-background">
    <PortalNav />
    <div className="mx-auto max-w-3xl px-6 py-16 text-center">
      <h1 className="font-display text-4xl font-bold text-foreground">VaidikaAI</h1>
      <p className="mt-2 text-sm text-muted-foreground">A system built by a doctor, designed by someone who respects their time</p>
      <div className="mt-12 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {portals.map(p => (
          <Link key={p.to} to={p.to} className="group rounded-lg border bg-card p-6 text-left transition-all duration-fast hover:border-action/40 hover:shadow-md">
            <div className={`flex h-10 w-10 items-center justify-center rounded-lg ${p.color}`}>
              <p.icon className="h-5 w-5 text-primary-foreground" />
            </div>
            <h2 className="mt-3 font-display text-base font-bold text-foreground">{p.label}</h2>
            <p className="mt-1 text-xs text-muted-foreground">{p.desc}</p>
          </Link>
        ))}
      </div>
    </div>
  </div>
);

export default Index;
