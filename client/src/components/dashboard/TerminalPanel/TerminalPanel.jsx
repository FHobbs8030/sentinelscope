import "./TerminalPanel.css";
import { useEffect, useRef } from "react";

function TerminalPanel({
  title = "Terminal",
  status = "LIVE",
  logs = [],
  height = "420px",
}) {
  const terminalBodyRef = useRef(null);

  useEffect(() => {
    if (terminalBodyRef.current) {
      terminalBodyRef.current.scrollTop =
        terminalBodyRef.current.scrollHeight;
    }
  }, [logs]);

  return (
    <section className="terminal-panel">
      <div className="terminal-panel__header">
        <h3 className="terminal-panel__title">{title}</h3>

        <div className="terminal-panel__status">
          <span className="terminal-panel__status-dot"></span>
          {status}
        </div>
      </div>

      <div
        className="terminal-panel__body"
        ref={terminalBodyRef}
        style={{ height }}
      >
        {logs.map((log) => (
          <div
            key={log.id}
            className={`terminal-panel__log terminal-panel__log--${log.level}`}
          >
            <span className="terminal-panel__timestamp">
              [{new Date(log.timestamp).toLocaleTimeString()}]
            </span>

            <span className="terminal-panel__message">{log.message}</span>
          </div>
        ))}
      </div>

      <div className="terminal-panel__footer">
        <span className="terminal-panel__prompt">●</span>

        <span className="terminal-panel__footer-text">
          Live runtime telemetry stream
        </span>
      </div>
    </section>
  );
}

export default TerminalPanel;
