import ScansContext from "./ScansContext";

import useScansState from "../hooks/useScansState";

function ScansProvider({ children }) {
  const scansState = useScansState();

  return (
    <ScansContext.Provider value={scansState}>
      {children}
    </ScansContext.Provider>
  );
}

export default ScansProvider;
