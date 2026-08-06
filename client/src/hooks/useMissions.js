import { useContext } from "react";

import MissionsContext from "../contexts/MissionsContext";

export default function useMissions() {
  const context = useContext(MissionsContext);

  if (!context) {
    throw new Error("useMissions must be used within a MissionsProvider.");
  }

  return context;
}
