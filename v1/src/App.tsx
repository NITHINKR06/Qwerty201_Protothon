import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { PatientProvider } from "@/lib/patientStore";
import Index from "./pages/Index.tsx";
import NotFound from "./pages/NotFound.tsx";
import RecordsPage from "./pages/RecordsPage.tsx";
import ReceptionPage from "./pages/ReceptionPage.tsx";
import DoctorPage from "./pages/DoctorPage.tsx";
import LabPage from "./pages/LabPage.tsx";
import PharmacyPage from "./pages/PharmacyPage.tsx";
import WaitingDisplayPage from "./pages/WaitingDisplayPage.tsx";
import PatientExitPage from "./pages/PatientExitPage.tsx";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <PatientProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<Index />} />
            <Route path="/records" element={<RecordsPage />} />
            <Route path="/reception" element={<ReceptionPage />} />
            <Route path="/doctor" element={<DoctorPage />} />
            <Route path="/lab" element={<LabPage />} />
            <Route path="/pharmacy" element={<PharmacyPage />} />
            <Route path="/waiting-display" element={<WaitingDisplayPage />} />
            <Route path="/patient-exit/:visitId" element={<PatientExitPage />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </PatientProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
