export const OPERATIONAL_FOCUS_TYPES = Object.freeze({
  SCAN: "scan",
  FINDING: "finding",
  ALERT: "alert",
  MISSION: "mission",
});

const normalizeIdentity = (value) => {
  if (value === null || value === undefined || value === "") {
    return null;
  }

  return String(value);
};

const matchesIdentity = (identityValues, identity) => {
  const normalizedIdentity = normalizeIdentity(identity);

  if (!normalizedIdentity) {
    return false;
  }

  return identityValues
    .map(normalizeIdentity)
    .filter(Boolean)
    .some((value) => value === normalizedIdentity);
};

const normalizeCollection = (collection) => {
  return Array.isArray(collection) ? collection : [];
};

/* =========================================
   STABLE NAVIGATION IDS
========================================= */

export const getStableScanId = (scan) => {
  return (
    scan?.clientScanId ||
    scan?.scanId ||
    scan?._id ||
    scan?.id ||
    scan?.mongoId ||
    null
  );
};

export const getStableFindingId = (finding) => {
  return finding?.clientFindingId || finding?._id || finding?.id || null;
};

export const getStableAlertId = (alert) => {
  return alert?._id || alert?.id || null;
};

export const getStableMissionId = (mission) => {
  return (
    mission?.clientMissionId ||
    mission?.missionId ||
    mission?._id ||
    mission?.id ||
    mission?.mongoId ||
    null
  );
};

/* =========================================
   IDENTITY MATCHING
========================================= */

export const scanMatchesIdentity = (scan, identity) => {
  if (!scan) {
    return false;
  }

  return matchesIdentity(
    [
      scan.clientScanId,
      scan.scanId,
      scan._id,
      scan.id,
      scan.mongoId,
    ],
    identity,
  );
};

export const findingMatchesIdentity = (finding, identity) => {
  if (!finding) {
    return false;
  }

  return matchesIdentity(
    [finding.clientFindingId, finding._id, finding.id],
    identity,
  );
};

export const alertMatchesIdentity = (alert, identity) => {
  if (!alert) {
    return false;
  }

  return matchesIdentity([alert._id, alert.id], identity);
};

export const missionMatchesIdentity = (mission, identity) => {
  if (!mission) {
    return false;
  }

  return matchesIdentity(
    [
      mission.clientMissionId,
      mission.missionId,
      mission._id,
      mission.id,
      mission.mongoId,
    ],
    identity,
  );
};

/* =========================================
   ENTITY RESOLUTION
========================================= */

export const findScanByIdentity = (scans, identity) => {
  return (
    normalizeCollection(scans).find((scan) =>
      scanMatchesIdentity(scan, identity),
    ) ?? null
  );
};

export const findFindingByIdentity = (findings, identity) => {
  return (
    normalizeCollection(findings).find((finding) =>
      findingMatchesIdentity(finding, identity),
    ) ?? null
  );
};

export const findAlertByIdentity = (alerts, identity) => {
  return (
    normalizeCollection(alerts).find((alert) =>
      alertMatchesIdentity(alert, identity),
    ) ?? null
  );
};

export const findMissionByIdentity = (missions, identity) => {
  return (
    normalizeCollection(missions).find((mission) =>
      missionMatchesIdentity(mission, identity),
    ) ?? null
  );
};

/* =========================================
   SCAN RELATIONSHIPS
========================================= */

export const getMissionForScan = (scan, missions) => {
  if (!scan) {
    return null;
  }

  return (
    normalizeCollection(missions).find(
      (mission) =>
        missionMatchesIdentity(mission, scan.missionId) ||
        missionMatchesIdentity(mission, scan.missionMongoId),
    ) ?? null
  );
};

export const getFindingsForScan = (scan, findings) => {
  if (!scan) {
    return [];
  }

  return normalizeCollection(findings).filter((finding) =>
    scanMatchesIdentity(scan, finding.scanId),
  );
};

export const getAlertsForScan = (scan, alerts) => {
  if (!scan) {
    return [];
  }

  return normalizeCollection(alerts).filter((alert) =>
    scanMatchesIdentity(scan, alert.scanId),
  );
};

/* =========================================
   FINDING RELATIONSHIPS
========================================= */

export const getScanForFinding = (finding, scans) => {
  if (!finding?.scanId) {
    return null;
  }

  return findScanByIdentity(scans, finding.scanId);
};

export const getMissionForFinding = (finding, missions) => {
  if (!finding?.missionId) {
    return null;
  }

  return findMissionByIdentity(missions, finding.missionId);
};

export const getAlertsForFinding = (finding, alerts) => {
  if (!finding) {
    return [];
  }

  return normalizeCollection(alerts).filter((alert) => {
    const relatedFindings = normalizeCollection(alert.relatedFindings);

    return relatedFindings.some((findingId) =>
      findingMatchesIdentity(finding, findingId),
    );
  });
};

/* =========================================
   ALERT RELATIONSHIPS
========================================= */

export const getScanForAlert = (alert, scans) => {
  if (!alert?.scanId) {
    return null;
  }

  return findScanByIdentity(scans, alert.scanId);
};

export const getMissionForAlert = (alert, missions) => {
  if (!alert?.missionId) {
    return null;
  }

  return findMissionByIdentity(missions, alert.missionId);
};

export const getFindingsForAlert = (alert, findings) => {
  const relatedFindings = normalizeCollection(alert?.relatedFindings);

  if (relatedFindings.length === 0) {
    return [];
  }

  return normalizeCollection(findings).filter((finding) =>
    relatedFindings.some((findingId) =>
      findingMatchesIdentity(finding, findingId),
    ),
  );
};

/* =========================================
   MISSION RELATIONSHIPS
========================================= */

export const getScansForMission = (mission, scans) => {
  if (!mission) {
    return [];
  }

  return normalizeCollection(scans).filter(
    (scan) =>
      missionMatchesIdentity(mission, scan.missionId) ||
      missionMatchesIdentity(mission, scan.missionMongoId) ||
      scanMatchesIdentity(scan, mission.scanId) ||
      scanMatchesIdentity(scan, mission.scanMongoId),
  );
};

export const getFindingsForMission = (mission, findings) => {
  if (!mission) {
    return [];
  }

  return normalizeCollection(findings).filter((finding) =>
    missionMatchesIdentity(mission, finding.missionId),
  );
};

export const getAlertsForMission = (mission, alerts) => {
  if (!mission) {
    return [];
  }

  return normalizeCollection(alerts).filter((alert) =>
    missionMatchesIdentity(mission, alert.missionId),
  );
};

/* =========================================
   FOCUS NAVIGATION
========================================= */

export const buildFocusUrl = (focusType, focusId) => {
  if (!focusType || !focusId) {
    return "/";
  }

  const params = new URLSearchParams({
    focus: String(focusType),
    id: String(focusId),
  });

  return `/?${params.toString()}`;
};
