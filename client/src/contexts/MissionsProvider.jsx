import MissionsContext from "./MissionsContext";

import useMissionsState from "../hooks/useMissionsState";

function MissionsProvider({ children }) {
  const missionsState = useMissionsState();

  return (
    <MissionsContext.Provider value={missionsState}>
      {children}
    </MissionsContext.Provider>
  );
}

export default MissionsProvider;
