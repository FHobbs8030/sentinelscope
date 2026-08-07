import { useContext } from "react";

import BackendHealthContext from "../contexts/BackendHealthContext";

export default function useBackendHealthContext() {
  const context = useContext(BackendHealthContext);

  if (!context) {
    throw new Error(
      "useBackendHealthContext must be used within a BackendHealthProvider.",
    );
  }

  return context;
}
