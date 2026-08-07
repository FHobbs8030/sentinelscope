import { useEffect } from "react";
import { Route, Routes } from "react-router-dom";

import AppShell from "./components/layout/AppShell/AppShell";

import AlertsProvider from "./contexts/AlertsProvider";
import BackendHealthProvider from "./contexts/BackendHealthProvider";
import FindingsProvider from "./contexts/FindingsProvider";
import MissionsProvider from "./contexts/MissionsProvider";
import ScansProvider from "./contexts/ScansProvider";

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
    <MissionsProvider>
      <ScansProvider>
      <AlertsProvider>
        <FindingsProvider>
          <BackendHealthProvider>
          <AppShell>
            <Routes>
              <Route path="/" element={<Dashboard />} />

              <Route
                path="/scans"
                element={
                  <Dashboard initialSection="dashboard-operations" />
                }
              />

              <Route
                path="/recon"
                element={
                  <Dashboard initialSection="dashboard-operations" />
                }
              />

              <Route
                path="/enumeration"
                element={
                  <Dashboard initialSection="dashboard-operations" />
                }
              />

              <Route
                path="/port-scanning"
                element={
                  <Dashboard initialSection="dashboard-operations" />
                }
              />

              <Route
                path="/dns-analysis"
                element={<Dashboard initialSection="dashboard-analytics" />}
              />

              <Route path="/targets" element={<Targets />} />
            </Routes>
          </AppShell>
          </BackendHealthProvider>
        </FindingsProvider>
      </AlertsProvider>
      </ScansProvider>
    </MissionsProvider>
  );
}

export default App;
