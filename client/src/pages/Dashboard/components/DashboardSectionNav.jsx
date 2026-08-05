import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";

import {
  Activity,
  AlertTriangle,
  BarChart3,
  FileText,
  LayoutDashboard,
  Shield,
  Terminal,
} from "lucide-react";

import "./DashboardSectionNav.css";

const dashboardSections = [
  {
    id: "dashboard-overview",
    label: "Overview",
    color: "#60a5fa",
    rgb: "96, 165, 250",
    icon: LayoutDashboard,
  },
  {
    id: "dashboard-operations",
    label: "Operations",
    color: "#22d3ee",
    rgb: "34, 211, 238",
    icon: Activity,
  },
  {
    id: "dashboard-analytics",
    label: "Analytics",
    color: "#a78bfa",
    rgb: "167, 139, 250",
    icon: BarChart3,
  },
  {
    id: "dashboard-executive",
    label: "Executive",
    color: "#fbbf24",
    rgb: "251, 191, 36",
    icon: Shield,
  },
  {
    id: "dashboard-alerts",
    label: "Alerts",
    color: "#f87171",
    rgb: "248, 113, 113",
    icon: AlertTriangle,
  },
  {
    id: "dashboard-reports",
    label: "Metrics",
    color: "#4ade80",
    rgb: "74, 222, 128",
    icon: FileText,
  },
  {
    id: "dashboard-terminal",
    label: "Telemetry",
    color: "#2dd4bf",
    rgb: "45, 212, 191",
    icon: Terminal,
  },
];

function DashboardSectionNav() {
  const navigate = useNavigate();
  const [activeSection, setActiveSection] = useState(dashboardSections[0].id);

  const navRef = useRef(null);
  const controlTrackRef = useRef(null);
  const selectionLockRef = useRef(false);
  const selectionTimerRef = useRef(null);

  /*
    Respond to external Dashboard navigation requests such as
    Global Search selecting a scan, finding, or mission.

    This keeps Section Control synchronized with programmatic navigation
    without changing the normal scroll-detection thresholds.
  */
  useEffect(() => {
    const handleExternalSectionFocus = (event) => {
      const sectionId = event.detail?.sectionId;

      const isValidSection = dashboardSections.some(
        (section) => section.id === sectionId,
      );

      if (!isValidSection) {
        return;
      }

      setActiveSection(sectionId);

      selectionLockRef.current = true;

      if (selectionTimerRef.current) {
        window.clearTimeout(selectionTimerRef.current);
      }

      selectionTimerRef.current = window.setTimeout(() => {
        selectionLockRef.current = false;
        selectionTimerRef.current = null;
      }, 1200);
    };

    window.addEventListener(
      "dashboard:section-focus",
      handleExternalSectionFocus,
    );

    return () => {
      window.removeEventListener(
        "dashboard:section-focus",
        handleExternalSectionFocus,
      );
    };
  }, []);

  /*
    Track normal viewport scrolling and keep the active Section Control
    synchronized with the workspace currently crossing the activation line.
  */
  useEffect(() => {
    let animationFrameId = null;

    const updateActiveSection = () => {
      animationFrameId = null;

      if (selectionLockRef.current) {
        return;
      }

      const navBottom = navRef.current?.getBoundingClientRect().bottom ?? 166;

      const dashboardShell = document.querySelector(".dashboard-shell");

      const dashboardStyles = dashboardShell
        ? window.getComputedStyle(dashboardShell)
        : null;

      const scannerHeight = Number.parseFloat(
        dashboardStyles?.getPropertyValue("--dashboard-scanner-height") || "38",
      );

      const contentClearance = Number.parseFloat(
        dashboardStyles?.getPropertyValue("--dashboard-content-clearance") ||
          "18",
      );

      const activationLine = navBottom + scannerHeight + contentClearance + 2;

      let nextSection = dashboardSections[0].id;

      dashboardSections.forEach(({ id }) => {
        const section = document.getElementById(id);

        if (!section) {
          return;
        }

        const sectionBounds = section.getBoundingClientRect();

        if (sectionBounds.top <= activationLine) {
          nextSection = id;
        }
      });

      const pageBottomReached =
        window.innerHeight + window.scrollY >=
        document.documentElement.scrollHeight - 8;

      if (pageBottomReached) {
        nextSection = dashboardSections[dashboardSections.length - 1].id;
      }

      setActiveSection((currentSection) =>
        currentSection === nextSection ? currentSection : nextSection,
      );
    };

    const handleViewportChange = () => {
      if (animationFrameId !== null) {
        return;
      }

      animationFrameId = window.requestAnimationFrame(updateActiveSection);
    };

    updateActiveSection();

    window.addEventListener("scroll", handleViewportChange, {
      passive: true,
    });

    window.addEventListener("resize", handleViewportChange);

    return () => {
      window.removeEventListener("scroll", handleViewportChange);
      window.removeEventListener("resize", handleViewportChange);

      if (animationFrameId !== null) {
        window.cancelAnimationFrame(animationFrameId);
      }
    };
  }, []);

  /*
    Keep the active control centered when the Section Control track
    becomes horizontally scrollable on smaller screens.
  */
  useEffect(() => {
    const track = controlTrackRef.current;

    if (!track || track.scrollWidth <= track.clientWidth) {
      return;
    }

    const activeControl = track.querySelector(
      `[data-section-id="${activeSection}"]`,
    );

    if (!activeControl) {
      return;
    }

    const targetLeft =
      activeControl.offsetLeft -
      track.clientWidth / 2 +
      activeControl.clientWidth / 2;

    track.scrollTo({
      left: targetLeft,
      behavior: "smooth",
    });
  }, [activeSection]);

  /*
    Clear any pending selection lock timer when the component unmounts.
  */
  useEffect(() => {
    return () => {
      if (selectionTimerRef.current) {
        window.clearTimeout(selectionTimerRef.current);
      }
    };
  }, []);

  const handleSectionSelection = (event, sectionId) => {
    event.preventDefault();

    const section = document.getElementById(sectionId);

    if (!section) {
      return;
    }

    /*
    Manual workspace navigation ends any previous Global Search focus.

    This prevents stale ?focus=...&id=... parameters from restoring
    Operations when the Dashboard is refreshed later.
  */
    navigate("/", {
      replace: true,
    });

    setActiveSection(sectionId);

    selectionLockRef.current = true;

    if (selectionTimerRef.current) {
      window.clearTimeout(selectionTimerRef.current);
    }

    if (sectionId === "dashboard-overview") {
      window.scrollTo({
        top: 0,
        behavior: "smooth",
      });
    } else {
      section.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
    }

    selectionTimerRef.current = window.setTimeout(() => {
      selectionLockRef.current = false;
      selectionTimerRef.current = null;
    }, 1200);
  };

  return (
    <aside
      ref={navRef}
      className="dashboard-section-nav"
      aria-label="Dashboard section controls"
    >
      <div className="dashboard-section-nav__status">
        <div>
          <span className="dashboard-section-nav__eyebrow">
            Section Control
          </span>

          <span className="dashboard-section-nav__instruction">
            Select operational workspace
          </span>
        </div>

        <span className="dashboard-section-nav__sync">
          <span className="dashboard-section-nav__sync-light" />
          Scroll Sync
        </span>
      </div>

      <nav
        ref={controlTrackRef}
        className="dashboard-section-nav__track"
        aria-label="Dashboard sections"
      >
        {dashboardSections.map((section) => {
          const Icon = section.icon;
          const isActive = activeSection === section.id;

          return (
            <a
              key={section.id}
              href={`#${section.id}`}
              data-section-id={section.id}
              className="dashboard-section-nav__control"
              aria-current={isActive ? "location" : undefined}
              style={{
                "--section-color": section.color,
                "--section-color-rgb": section.rgb,
              }}
              onClick={(event) => handleSectionSelection(event, section.id)}
            >
              <span className="dashboard-section-nav__indicator" />

              <Icon
                className="dashboard-section-nav__icon"
                size={16}
                strokeWidth={2}
                aria-hidden="true"
              />

              <span className="dashboard-section-nav__label">
                {section.label}
              </span>
            </a>
          );
        })}
      </nav>
    </aside>
  );
}

export default DashboardSectionNav;
