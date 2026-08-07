import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";

import "./ScanResultsModal.css";

import { getFindingsPage } from "../../../services/api/findingsApi";
import { getStableScanId } from "../../../utils/operationalIdentity";

const MODAL_EXIT_DURATION_MS = 480;
const FINDINGS_PAGE_SIZE = 200;

const getScanIdentityValues = (scan) => {
  return [scan?.mongoId, scan?._id, scan?.id, getStableScanId(scan)]
    .filter(Boolean)
    .map(String);
};

const formatLabel = (value = "") => {
  const normalizedValue = String(value).trim();

  if (!normalizedValue) {
    return "Unknown";
  }

  return normalizedValue
    .replace(/[-_]+/g, " ")
    .replace(/\b\w/g, (character) => character.toUpperCase());
};

const formatScanType = (scan) => {
  const scanType = scan?.type ?? scan?.scanType ?? "full";

  switch (String(scanType).toLowerCase()) {
    case "full":
      return "Full Recon";

    case "recon":
      return "Recon Scan";

    case "enumeration":
      return "Enumeration Scan";

    case "vulnerability":
      return "Vulnerability Scan";

    default:
      return formatLabel(scanType);
  }
};

const formatTimestamp = (value) => {
  if (!value) {
    return "Not recorded";
  }

  const timestamp = new Date(value);

  if (Number.isNaN(timestamp.getTime())) {
    return "Not recorded";
  }

  return timestamp.toLocaleString();
};

const formatRuntime = (scan) => {
  const elapsedSeconds = Number(scan?.elapsedTime);

  if (Number.isFinite(elapsedSeconds) && elapsedSeconds > 0) {
    const minutes = Math.floor(elapsedSeconds / 60);
    const seconds = Math.round(elapsedSeconds % 60);

    return `${minutes}m ${seconds}s`;
  }

  const startedAt = new Date(scan?.startedAt ?? "");
  const completedAt = new Date(scan?.completedAt ?? "");

  if (
    Number.isNaN(startedAt.getTime()) ||
    Number.isNaN(completedAt.getTime())
  ) {
    return "Not recorded";
  }

  const durationSeconds = Math.max(
    0,
    Math.round((completedAt.getTime() - startedAt.getTime()) / 1000),
  );

  const minutes = Math.floor(durationSeconds / 60);
  const seconds = durationSeconds % 60;

  return `${minutes}m ${seconds}s`;
};

const normalizeTone = (value = "") => {
  const normalizedValue = String(value).toLowerCase();

  return [
    "completed",
    "failed",
    "cancelled",
    "interrupted",
    "critical",
    "high",
    "medium",
    "low",
    "informational",
  ].includes(normalizedValue)
    ? normalizedValue
    : "neutral";
};

function ScanResultsModal({ scan, isOpen, onClose }) {
  const [shouldRender, setShouldRender] = useState(isOpen);
  const [isVisible, setIsVisible] = useState(false);
  const [findings, setFindings] = useState([]);
  const [isLoadingFindings, setIsLoadingFindings] = useState(false);
  const [findingsError, setFindingsError] = useState(null);
  const [retryKey, setRetryKey] = useState(0);

  const closeButtonRef = useRef(null);
  const previousFocusRef = useRef(null);

  const scanIdentityValues = useMemo(
    () => getScanIdentityValues(scan),
    [scan],
  );

  const scanQueryId =
    scan?.mongoId ?? scan?._id ?? scan?.id ?? getStableScanId(scan);

  const loadScanFindings = useCallback(
    async (signal) => {
      if (!scanQueryId) {
        setFindings([]);
        setFindingsError(null);
        return;
      }

      setIsLoadingFindings(true);
      setFindings([]);
      setFindingsError(null);

      try {
        const findingsById = new Map();

        let page = 1;
        let hasNextPage = true;

        while (hasNextPage) {
          const pageData = await getFindingsPage(
            {
              page,
              limit: FINDINGS_PAGE_SIZE,
              search: String(scanQueryId),
            },
            {
              signal,
            },
          );

          if (signal.aborted) {
            return;
          }

          pageData.findings
            .filter((finding) => {
              const findingScanId = finding?.scanId;

              return (
                findingScanId &&
                scanIdentityValues.includes(String(findingScanId))
              );
            })
            .forEach((finding, index) => {
              const findingId =
                finding?._id ??
                finding?.clientFindingId ??
                `${page}-${index}`;

              findingsById.set(String(findingId), finding);
            });

          hasNextPage = Boolean(pageData.meta?.hasNextPage);
          page += 1;
        }

        setFindings(Array.from(findingsById.values()));
      } catch (error) {
        if (signal.aborted) {
          return;
        }

        console.error(
          "[ScanResultsModal] Failed to load scan findings",
          error,
        );

        setFindingsError(
          "Unable to load the persisted findings for this scan.",
        );
      } finally {
        if (!signal.aborted) {
          setIsLoadingFindings(false);
        }
      }
    },
    [scanQueryId, scanIdentityValues],
  );

  useEffect(() => {
    let entryFrameId = null;
    let visibilityFrameId = null;
    let exitTimerId = null;

    if (isOpen) {
      entryFrameId = window.requestAnimationFrame(() => {
        setShouldRender(true);

        visibilityFrameId = window.requestAnimationFrame(() => {
          setIsVisible(true);
        });
      });
    } else {
      visibilityFrameId = window.requestAnimationFrame(() => {
        setIsVisible(false);
      });

      exitTimerId = window.setTimeout(() => {
        setShouldRender(false);
      }, MODAL_EXIT_DURATION_MS);
    }

    return () => {
      if (entryFrameId !== null) {
        window.cancelAnimationFrame(entryFrameId);
      }

      if (visibilityFrameId !== null) {
        window.cancelAnimationFrame(visibilityFrameId);
      }

      if (exitTimerId !== null) {
        window.clearTimeout(exitTimerId);
      }
    };
  }, [isOpen]);

  useEffect(() => {
    if (!shouldRender) {
      return undefined;
    }

    const previousOverflow = document.body.style.overflow;

    document.body.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [shouldRender]);

  useEffect(() => {
    if (!isOpen) {
      return undefined;
    }

    const handleKeyDown = (event) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
      }
    };

    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen, onClose]);

  useEffect(() => {
    if (isOpen) {
      previousFocusRef.current = document.activeElement;

      const focusTimerId = window.setTimeout(() => {
        closeButtonRef.current?.focus();
      }, 40);

      return () => {
        window.clearTimeout(focusTimerId);
      };
    }

    if (!shouldRender) {
      previousFocusRef.current?.focus?.();
      previousFocusRef.current = null;
    }

    return undefined;
  }, [isOpen, shouldRender]);

  useEffect(() => {
    if (!isOpen || !scanQueryId) {
      return undefined;
    }

    const requestController = new AbortController();

    const requestFrameId = window.requestAnimationFrame(() => {
      void loadScanFindings(requestController.signal);
    });

    return () => {
      window.cancelAnimationFrame(requestFrameId);
      requestController.abort();
    };
  }, [isOpen, loadScanFindings, retryKey, scanQueryId]);

  if (!shouldRender || !scan) {
    return null;
  }

  const scanStatus = String(scan.status || "completed").toLowerCase();
  const scanSeverity = String(scan.severity || "medium").toLowerCase();
  const progress = Number(scan.progress) || 0;
  const expectedFindings = Number(scan.findingsCount) || 0;

  const outcomeMessage =
    scanStatus === "completed"
      ? "The operational scan completed successfully."
      : scanStatus === "interrupted"
        ? "The scan was interrupted and requires operator review."
        : scanStatus === "cancelled"
          ? "The scan was cancelled before completion."
          : "The scan ended with an operational failure.";

  const summaryItems = [
    {
      label: "Status",
      value: formatLabel(scanStatus),
      tone: normalizeTone(scanStatus),
    },
    {
      label: "Progress",
      value: `${progress}%`,
      tone: progress === 100 ? "completed" : "neutral",
    },
    {
      label: "Findings",
      value: expectedFindings,
      tone: expectedFindings > 0 ? normalizeTone(scanSeverity) : "completed",
    },
    {
      label: "Severity",
      value: formatLabel(scanSeverity),
      tone: normalizeTone(scanSeverity),
    },
    {
      label: "Runtime",
      value: formatRuntime(scan),
      tone: "neutral",
    },
    {
      label: "Profile",
      value: scan.profile || "General",
      tone: "neutral",
    },
  ];

  return createPortal(
    <div
      className={`scan-results-modal-backdrop ${
        isVisible ? "scan-results-modal-backdrop--visible" : ""
      }`}
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) {
          onClose();
        }
      }}
    >
      <section
        className="scan-results-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="scan-results-modal-title"
        aria-describedby="scan-results-modal-description"
      >
        <header className="scan-results-modal__header">
          <div className="scan-results-modal__heading">
            <span className="scan-results-modal__eyebrow">
              Operational Scan Results
            </span>

            <h2 id="scan-results-modal-title">{scan.target}</h2>

            <p id="scan-results-modal-description">
              {formatScanType(scan)} · Scan ID{" "}
              {getStableScanId(scan) || "Unavailable"}
            </p>
          </div>

          <div className="scan-results-modal__header-actions">
            <span
              className={`scan-results-modal__status scan-results-modal__status--${normalizeTone(
                scanStatus,
              )}`}
            >
              {formatLabel(scanStatus)}
            </span>

            <button
              ref={closeButtonRef}
              type="button"
              className="scan-results-modal__close"
              aria-label="Close scan results"
              onClick={onClose}
            >
              <X size={20} aria-hidden="true" />
            </button>
          </div>
        </header>

        <div className="scan-results-modal__body">
          <div
            className={`scan-results-modal__outcome scan-results-modal__outcome--${normalizeTone(
              scanStatus,
            )}`}
          >
            <strong>{formatLabel(scanStatus)}</strong>
            <span>{outcomeMessage}</span>
          </div>

          <div className="scan-results-modal__summary">
            {summaryItems.map((item) => (
              <article
                key={item.label}
                className={`scan-results-summary-card scan-results-summary-card--${item.tone}`}
              >
                <span>{item.label}</span>
                <strong>{item.value}</strong>
              </article>
            ))}
          </div>

          <section className="scan-results-modal__progress">
            <div className="scan-results-modal__section-heading">
              <div>
                <span>Execution</span>
                <h3>Scan progression</h3>
              </div>

              <strong>{progress}%</strong>
            </div>

            <div className="scan-results-progress-track">
              <div
                className="scan-results-progress-fill"
                style={{
                  width: `${Math.min(100, Math.max(0, progress))}%`,
                }}
              />
            </div>
          </section>

          <div className="scan-results-modal__details">
            <section className="scan-results-detail-panel">
              <span className="scan-results-detail-panel__eyebrow">
                Configuration
              </span>

              <dl>
                <div>
                  <dt>Target</dt>
                  <dd>{scan.target}</dd>
                </div>

                <div>
                  <dt>Scan type</dt>
                  <dd>{formatScanType(scan)}</dd>
                </div>

                <div>
                  <dt>Profile</dt>
                  <dd>{scan.profile || "General"}</dd>
                </div>

                <div>
                  <dt>Severity</dt>
                  <dd>{formatLabel(scanSeverity)}</dd>
                </div>
              </dl>
            </section>

            <section className="scan-results-detail-panel">
              <span className="scan-results-detail-panel__eyebrow">
                Timeline
              </span>

              <dl>
                <div>
                  <dt>Started</dt>
                  <dd>{formatTimestamp(scan.startedAt)}</dd>
                </div>

                <div>
                  <dt>Completed</dt>
                  <dd>{formatTimestamp(scan.completedAt)}</dd>
                </div>

                <div>
                  <dt>Final stage</dt>
                  <dd>
                    {formatLabel(scan.currentStage || scan.status)}
                  </dd>
                </div>

                <div>
                  <dt>Last activity</dt>
                  <dd>{scan.activity || "No activity recorded"}</dd>
                </div>
              </dl>
            </section>
          </div>

          <section className="scan-results-modal__findings">
            <div className="scan-results-modal__section-heading">
              <div>
                <span>Evidence</span>
                <h3>Persisted findings</h3>
              </div>

              <strong>
                {isLoadingFindings
                  ? "Loading…"
                  : `${findings.length} loaded`}
              </strong>
            </div>

            {findingsError ? (
              <div
                className="scan-results-findings-state scan-results-findings-state--error"
                role="alert"
              >
                <span>{findingsError}</span>

                <button
                  type="button"
                  onClick={() => {
                    setRetryKey((currentKey) => currentKey + 1);
                  }}
                >
                  Retry
                </button>
              </div>
            ) : null}

            {isLoadingFindings ? (
              <div
                className="scan-results-findings-state"
                role="status"
                aria-live="polite"
              >
                Loading all persisted findings for this scan…
              </div>
            ) : null}

            {!isLoadingFindings &&
            !findingsError &&
            findings.length === 0 ? (
              <div className="scan-results-findings-state">
                {expectedFindings > 0
                  ? "The scan reported findings, but no matching persisted records are currently available."
                  : "No findings were recorded for this scan."}
              </div>
            ) : null}

            {!isLoadingFindings && findings.length > 0 ? (
              <div className="scan-results-findings-list">
                {findings.map((finding, index) => {
                  const findingSeverity = String(
                    finding.severity || "informational",
                  ).toLowerCase();

                  return (
                    <article
                      key={
                        finding._id ??
                        finding.clientFindingId ??
                        `${finding.title}-${index}`
                      }
                      className="scan-results-finding"
                    >
                      <div className="scan-results-finding__header">
                        <div>
                          <span
                            className={`scan-results-finding__severity scan-results-finding__severity--${normalizeTone(
                              findingSeverity,
                            )}`}
                          >
                            {formatLabel(findingSeverity)}
                          </span>

                          <h4>{finding.title || "Untitled finding"}</h4>
                        </div>

                        <span className="scan-results-finding__status">
                          {formatLabel(finding.status || "open")}
                        </span>
                      </div>

                      <p>
                        {finding.description ||
                          "No finding description was provided."}
                      </p>

                      <div className="scan-results-finding__meta">
                        <span>
                          Category:{" "}
                          {formatLabel(finding.category || "general")}
                        </span>

                        <span>{formatTimestamp(finding.createdAt)}</span>
                      </div>
                    </article>
                  );
                })}
              </div>
            ) : null}
          </section>
        </div>
      </section>
    </div>,
    document.body,
  );
}

export default ScanResultsModal;
