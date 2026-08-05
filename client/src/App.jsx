import { useEffect } from "react";
import { Route, Routes } from "react-router-dom";

import AppShell from "./components/layout/AppShell/AppShell";

import AlertsProvider from "./contexts/AlertsProvider";
import FindingsProvider from "./contexts/FindingsProvider";

import Dashboard from "./pages/Dashboard/Dashboard";
import Targets from "./pages/Targets/Targets";

import { initializeTelemetryEmitter } from "./services/runtime/telemetry/telemetryEmitter";

import missionQueueManager from "./services/orchestration/missionQueueManager";

function App() {
  useEffect(() => {
    initializeTelemetryEmitter();

    missionQueueManager.start();

    return () => {
      missionQueueManager.stop();
    };
  }, []);

  return (
    <AlertsProvider>
      <FindingsProvider>
        <AppShell>
          <Routes>
            <Route path="/" element={<Dashboard />} />

            <Route path="/targets" element={<Targets />} />
          </Routes>
        </AppShell>
      </FindingsProvider>
    </AlertsProvider>
  );
}

export default App;
