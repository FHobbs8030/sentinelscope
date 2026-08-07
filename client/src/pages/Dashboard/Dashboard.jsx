import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";

import "./Dashboard.css";
import "./DashboardGlassSystem.css";

import DashboardSectionNav from "./components/DashboardSectionNav";
import KpiSummarySection from "./components/KpiSummarySection";
import SentinelPulseScanner from "./components/SentinelPulseScanner";
import SystemStatusCard from "./components/AnalyticsSection/SystemStatusCard";

import OperationalWorkspace from "./components/OperationalWorkspace";
import AnalyticsWorkspace from "./components/AnalyticsWorkspace";

import AlertOperationsSection from "./components/AlertOperationsSection";
import AlertDetailsPanel from "./components/AlertDetailsPanel";
import AlertTimelineViewer from "./components/AlertTimelineViewer";
import AlertIntelligenceDrawer from "./components/AlertIntelligenceDrawer";

import AnalyticsSection from "./components/AnalyticsSection/AnalyticsSection";

import ExecutiveIntelligenceSection from "./components/ExecutiveIntelligenceSection";
import PredictiveIntelligenceSection from "./components/PredictiveIntelligenceSection";
import CorrelationIntelligenceSection from "./components/CorrelationIntelligenceSection";

import TerminalPanel from "../../components/dashboard/TerminalPanel/TerminalPanel";

import useTelemetry from "../../hooks/useTelemetry";
import useAlerts from "../../hooks/useAlerts";
import {
  findAlertByIdentity,
  OPERATIONAL_FOCUS_TYPES,
} from "../../utils/operationalIdentity";

function Dashboard({ initialSection = "dashboard-overview" }) {
  const telemetryLogs = useTelemetry();
  const { alerts } = useAlerts();

  const [selectedAlert, setSelectedAlert] = useState(null);
  const [searchParams] = useSearchParams();

  const focusType = searchParams.get("focus");
  const focusId = searchParams.get("id");

  const focusedAlert = useMemo(() => {
    if (focusType !== OPERATIONAL_FOCUS_TYPES.ALERT || !focusId) {
      return null;
    }

    return findAlertByIdentity(alerts, focusId);
  }, [alerts, focusType, focusId]);

  const canonicalSelectedAlert = useMemo(() => {
    if (focusedAlert) {
      return focusedAlert.status === "closed" ? null : focusedAlert;
    }

    if (!selectedAlert) {
      return null;
    }

    const selectedAlertId = selectedAlert._id || selectedAlert.id;

    if (!selectedAlertId) {
      return selectedAlert.status === "closed" ? null : selectedAlert;
    }

    const canonicalAlert =
      alerts.find((alert) => {
        const alertId = alert._id || alert.id;

        return alertId && String(alertId) === String(selectedAlertId);
      }) ?? selectedAlert;

    return canonicalAlert.status === "closed" ? null : canonicalAlert;
  }, [alerts, focusedAlert, selectedAlert]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);

    const hasSearchFocus = params.get("focus") && params.get("id");
    const hasInitialSection = initialSection !== "dashboard-overview";

    if (hasSearchFocus || hasInitialSection) {
      return;
    }

    /*
    A normal Dashboard load should always begin at Overview.

    Browsers may otherwise restore the previous scroll position after
    refresh, which can reopen the Dashboard at Analytics, Executive,
    Terminal, or another previously viewed workspace.
  */
    window.history.scrollRestoration = "manual";

    window.scrollTo({
      top: 0,
      left: 0,
      behavior: "auto",
    });
  }, [initialSection]);

  useEffect(() => {
    const supportedSectionIds = new Set([
      "dashboard-overview",
      "dashboard-operations",
      "dashboard-analytics",
      "dashboard-executive",
      "dashboard-alerts",
      "dashboard-reports",
      "dashboard-terminal",
    ]);

    if (
      initialSection === "dashboard-overview" ||
      !supportedSectionIds.has(initialSection)
    ) {
      return undefined;
    }

    const section = document.getElementById(initialSection);

    if (!section) {
      return undefined;
    }

    window.dispatchEvent(
      new CustomEvent("dashboard:section-focus", {
        detail: {
          sectionId: initialSection,
        },
      }),
    );

    const animationFrameId = window.requestAnimationFrame(() => {
      section.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
    });

    return () => {
      window.cancelAnimationFrame(animationFrameId);
    };
  }, [initialSection]);

  useEffect(() => {
    const supportedFocusTypes = new Set(Object.values(OPERATIONAL_FOCUS_TYPES));

    if (!focusType || !focusId || !supportedFocusTypes.has(focusType)) {
      return;
    }

    const sectionId =
      focusType === OPERATIONAL_FOCUS_TYPES.ALERT
        ? "dashboard-alerts"
        : "dashboard-operations";

    window.dispatchEvent(
      new CustomEvent("dashboard:section-focus", {
        detail: {
          sectionId,
        },
      }),
    );

    /*
      Scan and alert focus are handled precisely by their respective panels.

      Do not also scroll the entire workspace, because that would compete
      with exact entity focus.
    */
    if (
      focusType === OPERATIONAL_FOCUS_TYPES.SCAN ||
      focusType === OPERATIONAL_FOCUS_TYPES.ALERT
    ) {
      return;
    }

    const operationsSection = document.getElementById("dashboard-operations");

    operationsSection?.scrollIntoView({
      behavior: "smooth",
      block: "start",
    });
  }, [focusType, focusId]);

  return (
    <div className="dashboard-shell">
      <DashboardSectionNav />
      <SystemStatusCard />
      <SentinelPulseScanner />

      <div className="dashboard-main">
        {/* KPI Workspace */}
        <section
          id="dashboard-overview"
          className="dashboard-zone dashboard-zone--kpi"
        >
          <KpiSummarySection />
        </section>

        {/* Operations Workspace */}
        <section id="dashboard-operations" className="dashboard-zone">
          <OperationalWorkspace focusType={focusType} focusId={focusId} />
        </section>

        {/* Analytics Workspace */}
        <section id="dashboard-analytics" className="dashboard-zone">
          <AnalyticsWorkspace />
        </section>

        {/* Intelligence Workspace */}
        <section id="dashboard-executive" className="dashboard-zone">
          <ExecutiveIntelligenceSection />

          <PredictiveIntelligenceSection
            alerts={canonicalSelectedAlert ? [canonicalSelectedAlert] : []}
          />

          <CorrelationIntelligenceSection />
        </section>

        {/* Investigation Workspace */}
        <section id="dashboard-alerts" className="dashboard-zone">
          <AlertOperationsSection
            selectedAlert={canonicalSelectedAlert}
            onSelectAlert={setSelectedAlert}
            focusType={focusType}
            focusId={focusId}
          />

          <AlertDetailsPanel alert={canonicalSelectedAlert} />

          <AlertTimelineViewer alert={canonicalSelectedAlert} />

          <AlertIntelligenceDrawer alert={canonicalSelectedAlert} />
        </section>

        {/* Reporting Workspace */}
        <section id="dashboard-reports" className="dashboard-zone">
          <AnalyticsSection />
        </section>

        {/* Terminal Workspace */}
        <section id="dashboard-terminal" className="dashboard-zone">
          <TerminalPanel
            title="Network Operations Telemetry"
            status="LIVE"
            logs={telemetryLogs}
          />
        </section>
      </div>
    </div>
  );
}

export default Dashboard;
