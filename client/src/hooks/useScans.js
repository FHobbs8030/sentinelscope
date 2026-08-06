import { useContext } from "react";

import ScansContext from "../contexts/ScansContext";

export default function useScans() {
  const context = useContext(ScansContext);

  if (!context) {
    throw new Error("useScans must be used within a ScansProvider.");
  }

  return context;
}
