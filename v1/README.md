# VaidikaAI — Intelligent Clinical Workflow

> A system built by a doctor, designed by someone who respects their time.

AI-powered clinical workflow platform for end-to-end patient management — from reception to consultation, lab, pharmacy, and digital health records.

## Features

- **Reception** — Register patients, generate QR-coded tokens, manage the queue
- **Doctor Portal** — AI-powered voice transcription with real-time multi-language translation, smart clinical brief generation, prescription & lab ordering
- **Laboratory** — Process ordered tests, submit results with auto-flagging (Normal / High / Critical)
- **Pharmacy** — Verify prescriptions, allergy conflict detection, track dispensing
- **Master Records** — Unified patient search, visit timeline, lab reports, AI summaries

## Tech Stack

- [React](https://react.dev) + [TypeScript](https://www.typescriptlang.org)
- [Vite](https://vitejs.dev) — Dev server & bundler
- [Tailwind CSS](https://tailwindcss.com) — Utility-first styling
- [shadcn/ui](https://ui.shadcn.com) — Radix-based UI components
- [Recharts](https://recharts.org) — Data visualisation
- [QR Code](https://www.npmjs.com/package/qrcode.react) — Patient token generation & scanning

## Getting Started

```bash
# Install dependencies
npm install

# Start the development server
npm run dev

# Build for production
npm run build
```

## Project Structure

```
src/
├── components/
│   ├── shared/       # PatientCard, PortalNav, QRScannerBox, SeverityBadge, VisitTimeline
│   └── ui/           # shadcn/ui primitives
├── hooks/            # Custom React hooks
├── lib/              # Store, types, utilities, mock data
├── pages/            # Index, Reception, Doctor, Lab, Pharmacy, Records
└── main.tsx          # App entry point
```

## License

MIT
