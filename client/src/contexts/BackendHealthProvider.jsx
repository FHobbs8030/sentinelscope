import { useEffect, useState } from "react";

import BackendHealthContext from "./BackendHealthContext";

import useBackendHealth from "../hooks/useBackendHealth";

import { subscribeToBackendRecovery } from "../services/runtime/backendConnectionEvents";

const BACKEND_HEALTH_POLL_INTERVAL_MS = 15000;
const BACKEND_RECOVERY_DISPLAY_MS = 1600;

function BackendHealthProvider({ children }) {
  const backendHealth = useBackendHealth({
    pollIntervalMs: BACKEND_HEALTH_POLL_INTERVAL_MS,
  });

  const [isRecovering, setIsRecovering] = useState(false);

  useEffect(() => {
    let recoveryTimerId = null;

    const unsubscribeRecovery = subscribeToBackendRecovery(() => {
      if (recoveryTimerId !== null) {
        window.clearTimeout(recoveryTimerId);
      }

      setIsRecovering(true);

      recoveryTimerId = window.setTimeout(() => {
        setIsRecovering(false);
        recoveryTimerId = null;
      }, BACKEND_RECOVERY_DISPLAY_MS);
    });

    return () => {
      unsubscribeRecovery();

      if (recoveryTimerId !== null) {
        window.clearTimeout(recoveryTimerId);
      }
    };
  }, []);

  const showRecovering =
    backendHealth.status === "online" && isRecovering;

  const sharedBackendHealth = {
    ...backendHealth,
    status: showRecovering ? "recovering" : backendHealth.status,
    isRecovering: showRecovering,
    isChecking: backendHealth.isChecking || showRecovering,
    isOnline: backendHealth.isOnline && !showRecovering,
  };

  return (
    <BackendHealthContext.Provider value={sharedBackendHealth}>
      {children}
    </BackendHealthContext.Provider>
  );
}

export default BackendHealthProvider;
