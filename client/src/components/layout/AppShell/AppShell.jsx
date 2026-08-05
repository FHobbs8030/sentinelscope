import { useEffect, useState } from "react";

import "./AppShell.css";

import Sidebar from "../Sidebar/Sidebar";
import Topbar from "../Topbar/Topbar";

function AppShell({ children }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const handleMenuToggle = () => {
    setSidebarOpen((current) => !current);
  };

  const closeSidebar = () => {
    setSidebarOpen(false);
  };

  // Close the sidebar whenever the viewport changes.
  // This prevents stale drawer state after responsive transitions.
  useEffect(() => {
    const handleResize = () => {
      setSidebarOpen(false);
    };

    window.addEventListener("resize", handleResize);

    return () => {
      window.removeEventListener("resize", handleResize);
    };
  }, []);

  // Allow Escape to close the sidebar.
  useEffect(() => {
    if (!sidebarOpen) {
      return undefined;
    }

    const handleKeyDown = (event) => {
      if (event.key === "Escape") {
        setSidebarOpen(false);
      }
    };

    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [sidebarOpen]);

  // Prevent the page behind the drawer from scrolling while open.
  useEffect(() => {
    document.body.style.overflow = sidebarOpen ? "hidden" : "";

    return () => {
      document.body.style.overflow = "";
    };
  }, [sidebarOpen]);

  return (
    <div
      className="app-shell"
      data-sidebar={sidebarOpen ? "open" : "collapsed"}
    >
      <Sidebar
        className={[
          "sidebar",
          sidebarOpen ? "sidebar--open" : "sidebar--collapsed",
        ].join(" ")}
        onClose={closeSidebar}
      />

      <div
        className={
          sidebarOpen
            ? "sidebar-overlay sidebar-overlay--visible"
            : "sidebar-overlay"
        }
        onClick={closeSidebar}
        aria-hidden="true"
      />

      <div className="app-shell-main">
        <Topbar onMenuToggle={handleMenuToggle} sidebarOpen={sidebarOpen} />

        <main className="page-container">{children}</main>
      </div>
    </div>
  );
}

export default AppShell;
