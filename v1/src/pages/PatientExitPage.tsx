import { useParams, Link } from 'react-router-dom';
import { usePatientStore } from '@/lib/patientStore';
import { Button } from '@/components/ui/button';
import { useState, useEffect } from 'react';
import { Volume2, Check, Calendar, Pill, FlaskConical, Heart, WifiOff } from 'lucide-react';
import { textToSpeech, checkHealth } from '@/lib/api';

const exitMessages: Record<string, { greeting: string; testsDone: string; medicinesGiven: string; followUp: string; takecare: string }> = {
  Hindi: {
    greeting: '{name} ji, aapki jaanch ho gayi.',
    testsDone: 'Sabhi jaanch poori ho gayi hain.',
    medicinesGiven: 'Dawai le li gayi hai.',
    followUp: 'Doctor ne kaha hai {days} din baad wapas aana.',
    takecare: 'Apna khayal rakhein. 🙏',
  },
  Tamil: {
    greeting: '{name} avargalē, ungal parisōdhanai mudinthadhu.',
    testsDone: 'Ellā parisōdhanaigalum mudinthana.',
    medicinesGiven: 'Marundhukal vazhangappattu vittan.',
    followUp: 'Doctor {days} nātkkal kazhithu varach sonnār.',
    takecare: 'Uṅgaḷaip paṟṟi kavaniyuṅgal. 🙏',
  },
  Telugu: {
    greeting: '{name} gāru, mī pariksha pūrtayindi.',
    testsDone: 'Anni parīkshalu pūrtayāyi.',
    medicinesGiven: 'Mandulu ivvabaddāyi.',
    followUp: 'Doctor {days} rōjula taruvāta rammani cheppāru.',
    takecare: 'Mee ārogyam jāgratagā chūsukōndi. 🙏',
  },
  Kannada: {
    greeting: '{name} avare, nimmā parīkshe mugidide.',
    testsDone: 'Ellā parīkshegaḷu mugidive.',
    medicinesGiven: 'Aushadhigaḷannu nīḍalāgide.',
    followUp: 'Doctor {days} dinagaḷa nantara banni endru hēḷidāre.',
    takecare: 'Nimmanna nīvu nōḍikoḷḷi. 🙏',
  },
  Malayalam: {
    greeting: '{name} ji, ningalude parishodhana kazhinjŭ.',
    testsDone: 'Ella parishodhanagalum puŭrthiyāyi.',
    medicinesGiven: 'Marunnukal nalkappettu.',
    followUp: 'Doctor {days} divasam kazhinjŭ varanamennu paranjŭ.',
    takecare: 'Ningalude ārogyam sūkshikkŭ. 🙏',
  },
  English: {
    greeting: '{name}, your consultation is complete.',
    testsDone: 'All your tests have been completed.',
    medicinesGiven: 'Your medicines have been provided.',
    followUp: 'The doctor has asked you to come back in {days} days.',
    takecare: 'Take care of yourself. 🙏',
  },
};

export default function PatientExitPage() {
  const { visitId } = useParams<{ visitId: string }>();
  const store = usePatientStore();
  const [speaking, setSpeaking] = useState(false);
  const [spokenLines, setSpokenLines] = useState(0);
  const [ttsAvailable, setTtsAvailable] = useState<boolean | null>(null);
  const [ttsPlaying, setTtsPlaying] = useState(false);

  const visit = store.visits.find(v => v.id === visitId);

  // Calculate follow-up days from aiSummary
  const followUpDays = visit?.aiSummary?.followUpDate ? '3' : '7';

  const lang = visit?.patient?.language || 'English';
  const msgs = exitMessages[lang] || exitMessages.English;
  const name = visit?.patient?.name?.split(' ')[0] || 'Patient';

  const lines = [
    msgs.greeting.replace('{name}', name),
    msgs.testsDone,
    msgs.medicinesGiven,
    msgs.followUp.replace('{days}', followUpDays),
    msgs.takecare,
  ];

  // Simulate speaking animation
  useEffect(() => {
    if (speaking && spokenLines < lines.length) {
      const timeout = setTimeout(() => {
        setSpokenLines(s => s + 1);
      }, 2000);
      return () => clearTimeout(timeout);
    }
    if (spokenLines >= lines.length) {
      setSpeaking(false);
    }
  }, [speaking, spokenLines, lines.length]);

  const handleSpeak = async () => {
    // Map language to BCP-47 code for TTS
    const LANG_CODES: Record<string, string> = {
      Hindi: 'hi-IN', Tamil: 'ta-IN', Telugu: 'te-IN',
      Kannada: 'kn-IN', Malayalam: 'ml-IN', English: 'en-IN',
    };
    const langCode = LANG_CODES[lang] || 'en-IN';
    const fullText = lines.join(' ');

    // Start text animation regardless
    setSpeaking(true);
    setSpokenLines(0);

    // Try backend TTS
    const ttsResult = await textToSpeech(fullText, langCode);
    if (ttsResult && ttsResult.status === 'success' && ttsResult.audio_file) {
      try {
        setTtsPlaying(true);
        const audio = new Audio(ttsResult.audio_file);
        audio.onended = () => setTtsPlaying(false);
        audio.onerror = () => setTtsPlaying(false);
        await audio.play();
      } catch {
        setTtsPlaying(false);
      }
    }
  };

  if (!visit) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-[#0f1629] to-[#1a2040]">
        <div className="text-center">
          <p className="text-6xl">🏥</p>
          <p className="mt-4 text-xl text-blue-200" style={{ fontFamily: 'var(--font-display)' }}>Visit not found</p>
          <Link to="/" className="mt-4 inline-block text-sm text-blue-400 hover:underline">← Back to Home</Link>
        </div>
      </div>
    );
  }

  const testsCompleted = visit.tests.filter(t => t.status === 'completed').length;
  const totalTests = visit.tests.length;
  const dispensedMeds = visit.prescriptions.filter(p => p.dispensed).length;
  const totalMeds = visit.prescriptions.length;

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#0f1629] via-[#131831] to-[#1a2444] flex items-center justify-center p-6">
      <div className="w-full max-w-lg">
        {/* Patient Card */}
        <div className="rounded-3xl border border-white/10 bg-white/5 p-8 backdrop-blur-xl shadow-2xl">
          {/* Header */}
          <div className="text-center">
            <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-gradient-to-br from-emerald-400 to-emerald-600 shadow-lg shadow-emerald-500/30">
              <Check className="h-10 w-10 text-white" strokeWidth={3} />
            </div>
            <h1 className="mt-4 text-3xl font-bold text-white" style={{ fontFamily: 'var(--font-display)' }}>
              Visit Complete
            </h1>
            <p className="mt-1 text-lg text-blue-200">{visit.patient.name}</p>
            <p className="text-sm text-blue-300/50">{visit.patientId} · {visit.date}</p>
          </div>

          {/* Summary Cards */}
          <div className="mt-8 space-y-3">
            {/* Tests */}
            <div className="flex items-center gap-4 rounded-xl bg-white/5 p-4">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-500/20">
                <FlaskConical className="h-5 w-5 text-blue-400" />
              </div>
              <div className="flex-1">
                <p className="text-sm font-semibold text-white">Lab Tests</p>
                <p className="text-xs text-blue-300/60">{testsCompleted}/{totalTests} completed</p>
              </div>
              {testsCompleted === totalTests && totalTests > 0 && (
                <span className="rounded-full bg-emerald-500/20 px-2.5 py-1 text-xs font-bold text-emerald-400">✓ Done</span>
              )}
            </div>

            {/* Medicines */}
            <div className="flex items-center gap-4 rounded-xl bg-white/5 p-4">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-purple-500/20">
                <Pill className="h-5 w-5 text-purple-400" />
              </div>
              <div className="flex-1">
                <p className="text-sm font-semibold text-white">Medicines</p>
                <p className="text-xs text-blue-300/60">{dispensedMeds}/{totalMeds} dispensed</p>
              </div>
              {dispensedMeds === totalMeds && totalMeds > 0 && (
                <span className="rounded-full bg-emerald-500/20 px-2.5 py-1 text-xs font-bold text-emerald-400">✓ Given</span>
              )}
            </div>

            {/* Follow-up */}
            <div className="flex items-center gap-4 rounded-xl bg-white/5 p-4">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-amber-500/20">
                <Calendar className="h-5 w-5 text-amber-400" />
              </div>
              <div className="flex-1">
                <p className="text-sm font-semibold text-white">Follow-up</p>
                <p className="text-xs text-blue-300/60">{visit.aiSummary?.followUpDate || `In ${followUpDays} days`}</p>
              </div>
            </div>

            {/* Referral if any */}
            {visit.aiSummary?.referrals && visit.aiSummary.referrals.length > 0 && (
              <div className="flex items-center gap-4 rounded-xl bg-red-500/10 border border-red-500/20 p-4">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-red-500/20">
                  <Heart className="h-5 w-5 text-red-400" />
                </div>
                <div className="flex-1">
                  <p className="text-sm font-semibold text-white">Referral</p>
                  <p className="text-xs text-red-300/80">{visit.aiSummary.referrals.map(r => r.specialty).join(', ')}</p>
                </div>
              </div>
            )}
          </div>

          {/* Voice Message */}
          <div className="mt-6 rounded-xl border border-blue-500/20 bg-blue-500/5 p-5">
            <div className="flex items-center gap-2 text-sm font-semibold text-blue-300">
              <Volume2 className={`h-5 w-5 ${speaking ? 'animate-pulse text-blue-400' : ''}`} />
              <span>{speaking ? `Speaking in ${lang}...` : `Message in ${lang}`}</span>
            </div>
            <div className="mt-3 space-y-2">
              {lines.map((line, i) => (
                <p
                  key={i}
                  className={`text-lg leading-relaxed transition-all duration-500 ${
                    i < spokenLines
                      ? 'text-white'
                      : speaking
                      ? 'text-blue-300/20'
                      : 'text-blue-200/70'
                  }`}
                  style={{ fontFamily: 'var(--font-display)' }}
                >
                  {line}
                </p>
              ))}
            </div>

            {!speaking && spokenLines === 0 && (
              <Button
                onClick={handleSpeak}
                className="mt-4 w-full gap-2 bg-gradient-to-r from-blue-500 to-indigo-600 text-white hover:from-blue-600 hover:to-indigo-700 h-12 text-base"
              >
                <Volume2 className="h-5 w-5" />
                🔊 Play in {lang}
              </Button>
            )}

            {!speaking && spokenLines >= lines.length && (
              <p className="mt-3 text-center text-sm text-emerald-400 font-semibold">✅ Message delivered</p>
            )}
          </div>

          {/* Footer */}
          <div className="mt-6 text-center">
            <p className="text-xs text-blue-300/40">No reading required · No typing required</p>
            <Link to="/">
              <Button variant="ghost" className="mt-2 text-blue-300/60 hover:text-white">← Back to Dashboard</Button>
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
