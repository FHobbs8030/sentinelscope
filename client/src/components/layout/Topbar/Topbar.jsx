import { useNavigate } from "react-router-dom";
import { useEffect, useMemo, useRef, useState } from "react";

import useScans from "../../../hooks/useScans";
import useFindings from "../../../hooks/useFindings";
import useMissions from "../../../hooks/useMissions";
import useAlerts from "../../../hooks/useAlerts";
import useBackendHealth from "../../../hooks/useBackendHealth";

import {
  buildFocusUrl,
  getStableFindingId,
  getStableMissionId,
  getStableScanId,
} from "../../../utils/operationalIdentity";

import SearchResultsModal from "../../Search/SearchResultsModal";

import "./Topbar.css";

function Topbar({ onMenuToggle, sidebarOpen }) {
  const navigate = useNavigate();
  const [searchTerm, setSearchTerm] = useState("");
  const [isManualBackendRefresh, setIsManualBackendRefresh] = useState(false);

  const [showSearchResults, setShowSearchResults] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const [showSettings, setShowSettings] = useState(false);

  const [reducedMotion, setReducedMotion] = useState(() => {
    const savedPreference = window.localStorage.getItem(
      "sentinelscope-reduced-motion",
    );

    if (savedPreference !== null) {
      return savedPreference === "true";
    }

    return (
      window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false
    );
  });

  const [scannerAnimation, setScannerAnimation] = useState(() => {
    const savedPreference = window.localStorage.getItem(
      "sentinelscope-scanner-animation",
    );

    if (savedPreference !== null) {
      return savedPreference === "true";
    }

    return true;
  });

  const notificationsRef = useRef(null);
  const settingsRef = useRef(null);

  const { scans = [] } = useScans();

  const { findings = [] } = useFindings();

  const { missions = [] } = useMissions();
  const {
    alerts = [],
    loading: alertsLoading,
    error: alertsError,
  } = useAlerts();

  const {
    health: backendHealth,
    isChecking: backendIsChecking,
    isOnline: backendIsOnline,
    isOffline: backendIsOffline,
    error: backendError,
    lastCheckedAt: backendLastCheckedAt,
    refresh: refreshBackendHealth,
  } = useBackendHealth();

  const backendIndicatorState = isManualBackendRefresh
    ? "checking"
    : backendIsOnline
      ? "online"
      : backendIsOffline
        ? "offline"
        : "checking";

  const backendStatusLabel = isManualBackendRefresh
    ? "Checking Backend"
    : backendIsOnline
      ? "Backend Online"
      : backendIsOffline
        ? "Backend Offline"
        : "Checking Backend";

  const backendStatusDetail =
    backendError ??
    (backendHealth?.service
      ? `${backendHealth.service} responded successfully.`
      : "Checking the SentinelScope backend connection.");

  const backendLastCheckedLabel = backendLastCheckedAt
    ? `Last checked ${backendLastCheckedAt.toLocaleTimeString()}`
    : "Not checked yet";

  const searchResults = useMemo(() => {
    const query = searchTerm.trim().toLowerCase();

    if (!query) {
      return {
        scans: [],
        findings: [],
        missions: [],
      };
    }

    return {
      scans: scans
        .filter((scan) =>
          [scan?.name, scan?.target, scan?.status, scan?.currentStage]
            .join(" ")
            .toLowerCase()
            .includes(query),
        )
        .map((scan) => ({
          id: getStableScanId(scan),
          type: "scan",
          title: scan.name,
          subtitle: scan.target,
          status: scan.status,
          raw: scan,
        })),

      findings: findings
        .filter((finding) =>
          [
            finding?.title,
            finding?.description,
            finding?.severity,
            finding?.target,
          ]
            .join(" ")
            .toLowerCase()
            .includes(query),
        )
        .map((finding) => ({
          id: getStableFindingId(finding),
          type: "finding",
          title: finding.title,
          subtitle: finding.target,
          status: finding.severity,
          raw: finding,
        })),

      missions: missions
        .filter((mission) =>
          [mission?.name, mission?.target, mission?.state]
            .join(" ")
            .toLowerCase()
            .includes(query),
        )
        .map((mission) => ({
          id: getStableMissionId(mission),
          type: "mission",
          title: mission.name,
          subtitle: mission.target,
          status: mission.state,
          raw: mission,
        })),
    };
  }, [searchTerm, scans, findings, missions]);

  const notificationAlerts = useMemo(() => {
    return [...alerts]
      .filter((alert) => {
        const severity = String(alert?.severity || "").toLowerCase();
        const status = String(alert?.status || "").toLowerCase();

        return (
          ["critical", "high"].includes(severity) &&
          !["resolved", "closed"].includes(status)
        );
      })
      .sort((firstAlert, secondAlert) => {
        const firstTime = new Date(
          firstAlert?.updatedAt || firstAlert?.createdAt || 0,
        ).getTime();

        const secondTime = new Date(
          secondAlert?.updatedAt || secondAlert?.createdAt || 0,
        ).getTime();

        return secondTime - firstTime;
      })
      .slice(0, 6);
  }, [alerts]);

  useEffect(() => {
    document.documentElement.dataset.motion = reducedMotion
      ? "reduced"
      : "full";

    window.localStorage.setItem(
      "sentinelscope-reduced-motion",
      String(reducedMotion),
    );
  }, [reducedMotion]);

  useEffect(() => {
    document.documentElement.dataset.scannerAnimation = scannerAnimation
      ? "on"
      : "off";

    window.localStorage.setItem(
      "sentinelscope-scanner-animation",
      String(scannerAnimation),
    );
  }, [scannerAnimation]);

  useEffect(() => {
    if (!showNotifications && !showSettings) {
      return undefined;
    }

    const handlePointerDown = (event) => {
      if (
        showNotifications &&
        notificationsRef.current &&
        !notificationsRef.current.contains(event.target)
      ) {
        setShowNotifications(false);
      }

      if (
        showSettings &&
        settingsRef.current &&
        !settingsRef.current.contains(event.target)
      ) {
        setShowSettings(false);
      }
    };

    const handleKeyDown = (event) => {
      if (event.key === "Escape") {
        setShowNotifications(false);
        setShowSettings(false);
      }
    };

    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [showNotifications, showSettings]);

  const handleNotificationsToggle = () => {
    setShowSettings(false);
    setShowNotifications((current) => !current);
  };

  const handleSettingsToggle = () => {
    setShowNotifications(false);
    setShowSettings((current) => !current);
  };

  const handleSearch = () => {
    if (!searchTerm.trim()) {
      return;
    }

    setShowSearchResults(true);
  };

  const handleSearchResultSelect = (item) => {
    if (!item?.type || !item?.id) {
      return;
    }

    setShowSearchResults(false);

    navigate(buildFocusUrl(item.type, item.id));

    window.requestAnimationFrame(() => {
      document.getElementById("dashboard-operations")?.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
    });
  };

  const handleViewAlerts = () => {
    setShowNotifications(false);

    navigate("/");

    window.requestAnimationFrame(() => {
      document.getElementById("dashboard-alerts")?.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
    });
  };

  const handleBackendHealthRefresh = async () => {
    if (isManualBackendRefresh) {
      return;
    }

    setIsManualBackendRefresh(true);

    try {
      await Promise.all([
        refreshBackendHealth(),
        new Promise((resolve) => {
          window.setTimeout(resolve, 600);
        }),
      ]);
    } finally {
      setIsManualBackendRefresh(false);
    }
  };

  return (
    <>
      <header className="topbar">
        <div className="topbar-workspace">
          <h1 className="topbar-workspace-title">Dashboard</h1>

          <p className="topbar-workspace-description">
            Attack surface operations and intelligence
          </p>
        </div>

        <div className="topbar-search">
          <input
            type="text"
            className="topbar-search-input"
            placeholder="Search targets, scans, findings, missions..."
            aria-label="Search platform"
            value={searchTerm}
            onChange={(event) => setSearchTerm(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                handleSearch();
              }
            }}
          />

          <button
            className="topbar-search-button"
            type="button"
            onClick={handleSearch}
            aria-label="Search"
          >
            🔍
          </button>
        </div>

        <div className="topbar-right">
          <button
            className={`topbar-backend-status topbar-backend-status--${backendIndicatorState}`}
            type="button"
            aria-label={`${backendStatusLabel}. ${backendStatusDetail}`}
            aria-busy={backendIsChecking || isManualBackendRefresh}
            title={`${backendStatusDetail} ${backendLastCheckedLabel}. Click to check again.`}
            onClick={handleBackendHealthRefresh}
            disabled={isManualBackendRefresh}
          >
            <span className="topbar-backend-status-dot" aria-hidden="true" />

            <span className="topbar-backend-status-label">
              {backendStatusLabel}
            </span>
          </button>
          <div className="topbar-notifications" ref={notificationsRef}>
            <button
              className="topbar-icon-button"
              type="button"
              aria-label="Notifications"
              aria-expanded={showNotifications}
              aria-controls="topbar-notifications-panel"
              onClick={handleNotificationsToggle}
            >
              🔔
              {notificationAlerts.length > 0 && (
                <span className="topbar-notification-badge">
                  {notificationAlerts.length}
                </span>
              )}
            </button>

            {showNotifications && (
              <div
                id="topbar-notifications-panel"
                className="topbar-notification-panel"
              >
                <div className="topbar-notification-header">
                  <div>
                    <strong>Notifications</strong>
                    <span>Priority security activity</span>
                  </div>

                  <span className="topbar-notification-count">
                    {notificationAlerts.length}
                  </span>
                </div>

                <div className="topbar-notification-list">
                  {alertsLoading && (
                    <p className="topbar-notification-message">
                      Loading alert activity...
                    </p>
                  )}

                  {!alertsLoading && alertsError && (
                    <p className="topbar-notification-message">
                      Unable to load alert activity.
                    </p>
                  )}

                  {!alertsLoading &&
                    !alertsError &&
                    notificationAlerts.length === 0 && (
                      <p className="topbar-notification-message">
                        No active high-priority alerts.
                      </p>
                    )}

                  {!alertsLoading &&
                    !alertsError &&
                    notificationAlerts.map((alert) => {
                      const alertId =
                        alert?._id ||
                        alert?.alertId ||
                        alert?.clientAlertId ||
                        `${alert?.target}-${alert?.createdAt}`;

                      return (
                        <div className="topbar-notification-item" key={alertId}>
                          <div className="topbar-notification-item-heading">
                            <span
                              className={`topbar-notification-severity topbar-notification-severity--${String(
                                alert?.severity || "unknown",
                              ).toLowerCase()}`}
                            >
                              {alert?.severity || "Unknown"}
                            </span>

                            <span className="topbar-notification-status">
                              {alert?.status || "Open"}
                            </span>
                          </div>

                          <strong>{alert?.title || "Security Alert"}</strong>

                          <span>{alert?.target || "Unknown target"}</span>
                        </div>
                      );
                    })}
                </div>

                <button
                  className="topbar-notification-view-all"
                  type="button"
                  onClick={handleViewAlerts}
                >
                  View Alert Operations →
                </button>
              </div>
            )}
          </div>

          <div className="topbar-settings" ref={settingsRef}>
            <button
              className="topbar-icon-button"
              type="button"
              aria-label="Settings"
              aria-expanded={showSettings}
              aria-controls="topbar-settings-panel"
              onClick={handleSettingsToggle}
            >
              ⚙️
            </button>

            {showSettings && (
              <div id="topbar-settings-panel" className="topbar-settings-panel">
                <div className="topbar-settings-header">
                  <strong>Interface Settings</strong>
                  <span>Local workspace preferences</span>
                </div>

                <div className="topbar-settings-option">
                  <div className="topbar-settings-option-copy">
                    <strong>Reduced Motion</strong>

                    <span>
                      Minimize interface animations and smooth scrolling.
                    </span>
                  </div>

                  <button
                    className={`topbar-settings-switch ${
                      reducedMotion ? "topbar-settings-switch--active" : ""
                    }`}
                    type="button"
                    role="switch"
                    aria-checked={reducedMotion}
                    onClick={() => setReducedMotion((current) => !current)}
                  >
                    <span className="topbar-settings-switch-thumb" />
                  </button>
                </div>

                <div className="topbar-settings-option">
                  <div className="topbar-settings-option-copy">
                    <strong>Scanner Animation</strong>

                    <span>
                      Enable the Sentinel Pulse sweep while operational scans
                      are active.
                    </span>
                  </div>

                  <button
                    className={`topbar-settings-switch ${
                      scannerAnimation ? "topbar-settings-switch--active" : ""
                    }`}
                    type="button"
                    role="switch"
                    aria-checked={scannerAnimation}
                    onClick={() => {
                      setScannerAnimation((current) => !current);
                    }}
                  >
                    <span className="topbar-settings-switch-thumb" />
                  </button>
                </div>

                <div className="topbar-settings-footer">
                  Preference saved in this browser
                </div>
              </div>
            )}
          </div>

          <div className="topbar-user">
            <div className="topbar-avatar">A</div>

            <div className="topbar-user-info">
              <span className="topbar-user-name">Analyst</span>

              <span className="topbar-user-role">Administrator</span>
            </div>
          </div>

          <button
            className="topbar-menu-toggle"
            type="button"
            onClick={onMenuToggle}
            aria-label={sidebarOpen ? "Close sidebar" : "Open sidebar"}
            aria-expanded={sidebarOpen}
            aria-controls="primary-sidebar"
          >
            ☰
          </button>
        </div>
      </header>

      <SearchResultsModal
        isOpen={showSearchResults}
        searchTerm={searchTerm}
        results={searchResults}
        onClose={() => setShowSearchResults(false)}
        onSelect={handleSearchResultSelect}
      />
    </>
  );
}

export default Topbar;
