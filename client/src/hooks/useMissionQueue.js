import { useSyncExternalStore } from "react";

import {
  getMissionQueueSnapshot,
  subscribeMissionQueue,
} from "../services/orchestration/missionQueue";

export default function useMissionQueue() {
  return useSyncExternalStore(
    subscribeMissionQueue,
    getMissionQueueSnapshot,
    getMissionQueueSnapshot,
  );
}
