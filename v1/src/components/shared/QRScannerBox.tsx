import { useState, useRef, useEffect, useCallback } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { ScanLine, Check, Camera, X } from 'lucide-react';
import { usePatientStore } from '@/lib/patientStore';
import jsQR from 'jsqr';

interface QRScannerBoxProps {
  onScan: (value: string) => void;
  placeholder?: string;
  label?: string;
  scanned?: boolean;
  autoStart?: boolean;
  externalTrigger?: number;
  context?: 'reception' | 'doctor' | 'lab' | 'pharmacy';
}

export function QRScannerBox({
  onScan,
  placeholder = 'Enter Patient ID',
  label = 'Scan QR Code',
  scanned,
  autoStart,
  externalTrigger,
  context,
}: QRScannerBoxProps) {
  const [manual, setManual] = useState('');
  const [showCamera, setShowCamera] = useState(false);
  const [scanning, setScanning] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const animFrameRef = useRef<number>(0);
  const store = usePatientStore();

  // Scan loop: grabs video frames and checks for QR codes
  const scanLoop = useCallback(() => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas || video.readyState !== video.HAVE_ENOUGH_DATA) {
      animFrameRef.current = requestAnimationFrame(scanLoop);
      return;
    }
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const code = jsQR(imageData.data, imageData.width, imageData.height);
    if (code && code.data) {
      // Found a QR code!
      onScan(code.data);
      stopCamera();
      return;
    }
    animFrameRef.current = requestAnimationFrame(scanLoop);
  }, [onScan]);

  const startCamera = async () => {
    setShowCamera(true);
    setScanning(true);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment', width: { ideal: 640 }, height: { ideal: 480 } },
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play();
        // Start scanning after video loads
        videoRef.current.onloadedmetadata = () => {
          animFrameRef.current = requestAnimationFrame(scanLoop);
        };
      }
    } catch {
      console.warn('Camera not available — use Simulate Scan instead');
      setScanning(false);
    }
  };

  const stopCamera = () => {
    cancelAnimationFrame(animFrameRef.current);
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop());
      streamRef.current = null;
    }
    if (videoRef.current) videoRef.current.srcObject = null;
    setShowCamera(false);
    setScanning(false);
  };

  useEffect(() => {
    if (autoStart && !scanned) startCamera();
    return () => stopCamera();
  }, []);

  useEffect(() => {
    if (externalTrigger && externalTrigger > 0 && !scanned) startCamera();
  }, [externalTrigger]);

  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (manual.trim()) { onScan(manual.trim()); stopCamera(); }
  };

  const simulateScan = () => {
    let targetPatientId = '';

    if (context === 'lab') {
      const pendingLab = store.getVisitsWithPendingTests();
      if (pendingLab.length > 0) targetPatientId = pendingLab[0].patientId;
    } else if (context === 'pharmacy') {
      const pendingRx = store.getVisitsWithPendingPrescriptions();
      if (pendingRx.length > 0) targetPatientId = pendingRx[0].patientId;
    } else if (context === 'doctor') {
      const activeVisits = store.getActiveVisits();
      if (activeVisits.length > 0) targetPatientId = activeVisits[0].patientId;
    } else {
      const activePatients = store.patients.filter(p => p.patientId);
      if (activePatients.length > 0) targetPatientId = activePatients[0].patientId;
    }

    if (targetPatientId) {
      onScan(targetPatientId);
    } else {
      alert(`No patients found for ${context || 'this'} portal.`);
    }
    stopCamera();
  };

  if (scanned) {
    return (
      <div className="rounded-lg border-2 border-success border-dashed p-6 text-center bg-success/5">
        <div className="flex flex-col items-center gap-2">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-success">
            <Check className="h-6 w-6 text-success-foreground" />
          </div>
          <p className="font-body text-sm font-semibold text-success">Scanned Successfully</p>
        </div>
      </div>
    );
  }

  return (
    <div className="relative overflow-hidden rounded-lg border-2 border-dashed p-6 text-center border-border bg-muted/30">
      {showCamera ? (
        <div className="space-y-4">
          <div className="relative mx-auto aspect-video max-w-sm overflow-hidden rounded-lg bg-black">
            <video ref={videoRef} autoPlay playsInline muted className="h-full w-full object-cover" />
            <canvas ref={canvasRef} className="hidden" />
            {/* Scanning overlay */}
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <div className="h-40 w-40 border-2 border-white/60 border-dashed rounded-lg">
                {scanning && (
                  <div className="absolute -bottom-6 left-1/2 -translate-x-1/2 rounded bg-black/70 px-2 py-0.5 text-[10px] text-white whitespace-nowrap">
                    Scanning for QR code...
                  </div>
                )}
              </div>
            </div>
            <button onClick={stopCamera} className="absolute right-2 top-2 rounded-full bg-black/50 p-1 text-white hover:bg-black/70">
              <X className="h-4 w-4" />
            </button>
          </div>
          <div className="flex justify-center gap-3">
            <Button size="sm" onClick={simulateScan} className="bg-action text-action-foreground hover:bg-action/90">
              Simulate Scan
            </Button>
            <Button size="sm" variant="outline" onClick={stopCamera}>Cancel</Button>
          </div>
          <form onSubmit={handleManualSubmit} className="flex gap-2 max-w-xs mx-auto">
            <Input value={manual} onChange={e => setManual(e.target.value)} placeholder={placeholder} className="text-center" />
          </form>
        </div>
      ) : (
        <>
          <ScanLine className="mx-auto h-10 w-10 text-muted-foreground" />
          <p className="mt-2 font-body text-sm font-medium text-foreground">{label}</p>
          <div className="mt-4 flex justify-center gap-2">
            <Button size="sm" onClick={startCamera} className="bg-action text-action-foreground hover:bg-action/90">
              <Camera className="mr-2 h-4 w-4" /> Open Camera
            </Button>
            <Button size="sm" variant="outline" onClick={simulateScan}>
              Simulate Scan
            </Button>
          </div>
          <p className="mt-3 text-xs text-muted-foreground">or type Patient ID below</p>
          <form onSubmit={handleManualSubmit} className="mt-2 max-w-xs mx-auto">
            <Input value={manual} onChange={e => setManual(e.target.value)} placeholder={placeholder} className="text-center" />
            <Button type="submit" size="sm" className="w-full mt-2" variant="outline">Search</Button>
          </form>
        </>
      )}
    </div>
  );
}
