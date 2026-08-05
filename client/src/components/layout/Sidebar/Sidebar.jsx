import { NavLink } from "react-router-dom";
import "./Sidebar.css";

const navigation = [
  {
    section: "MAIN",
    items: [
      {
        icon: "🏠",
        label: "Dashboard",
        path: "/",
      },
      {
        icon: "🎯",
        label: "Targets",
        path: "/targets",
      },
      {
        icon: "🔍",
        label: "Scans",
        path: "/scans",
      },
    ],
  },

  {
    section: "RECON",
    items: [
      {
        icon: "🛰️",
        label: "Recon",
        path: "/recon",
      },
      {
        icon: "📡",
        label: "Enumeration",
        path: "/enumeration",
      },
      {
        icon: "🔌",
        label: "Port Scanning",
        path: "/port-scanning",
      },
      {
        icon: "🌐",
        label: "DNS Analysis",
        path: "/dns-analysis",
      },
    ],
  },
];

function Sidebar({ className = "sidebar", onClose }) {
  return (
    <aside id="primary-sidebar" className={className}>
      <div className="sidebar-header">
        <div className="sidebar-logo">
          <div className="sidebar-logo-icon">S</div>

          <div className="sidebar-logo-text">
            <h2>SentinelScope</h2>

            <p>Attack Surface Intelligence</p>
          </div>
        </div>

        <button
          className="sidebar-mobile-close"
          type="button"
          onClick={onClose}
          aria-label="Close navigation menu"
        >
          ✕
        </button>
      </div>

      <nav className="sidebar-navigation">
        {navigation.map((group) => (
          <div key={group.section} className="sidebar-section">
            <p className="sidebar-section-title">{group.section}</p>

            <ul className="sidebar-menu">
              {group.items.map((item) => (
                <li key={item.label} className="sidebar-item">
                  <NavLink
                    to={item.path}
                    className={({ isActive }) =>
                      isActive ? "sidebar-button active" : "sidebar-button"
                    }
                    onClick={onClose}
                  >
                    <span className="sidebar-icon">{item.icon}</span>

                    <span className="sidebar-label">{item.label}</span>
                  </NavLink>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </nav>
    </aside>
  );
}

export default Sidebar;
