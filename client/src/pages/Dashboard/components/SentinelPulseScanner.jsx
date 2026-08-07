import { useEffect, useRef, useState } from "react";

import "./SentinelPulseScanner.css";

import useMissionQueue from "../../../hooks/useMissionQueue";
import useScans from "../../../hooks/useScans";

const MINIMUM_ACTIVE_TIME = 2200;
const COAST_DURATION = 600;
const CENTERING_DURATION = 1250;
const STOP_FADE_DURATION = 1500;

function SentinelPulseScanner() {
  const { runningScans } = useScans();
  const { metrics: queueMetrics } = useMissionQueue();

  const queueIsActive = queueMetrics.busy;
  const runtimeIsActive =
    runningScans.length > 0 || queueIsActive;

  const [visualPhase, setVisualPhase] = useState("idle");

  const activatedAtRef = useRef(0);

  const activationTimerRef = useRef(null);
  const coastTimerRef = useRef(null);
  const centerTimerRef = useRef(null);
  const stopTimerRef = useRef(null);
  const idleTimerRef = useRef(null);

  useEffect(() => {
    if (activationTimerRef.current) {
      window.clearTimeout(activationTimerRef.current);
      activationTimerRef.current = null;
    }

    if (coastTimerRef.current) {
      window.clearTimeout(coastTimerRef.current);
      coastTimerRef.current = null;
    }

    if (centerTimerRef.current) {
      window.clearTimeout(centerTimerRef.current);
      centerTimerRef.current = null;
    }

    if (stopTimerRef.current) {
      window.clearTimeout(stopTimerRef.current);
      stopTimerRef.current = null;
    }

    if (idleTimerRef.current) {
      window.clearTimeout(idleTimerRef.current);
      idleTimerRef.current = null;
    }

    if (runtimeIsActive) {
      activatedAtRef.current = performance.now();

      activationTimerRef.current = window.setTimeout(() => {
        setVisualPhase("active");
        activationTimerRef.current = null;
      }, 0);
    } else if (activatedAtRef.current > 0) {
      const elapsedTime = performance.now() - activatedAtRef.current;

      const minimumTimeRemaining = Math.max(
        0,
        MINIMUM_ACTIVE_TIME - elapsedTime,
      );

      coastTimerRef.current = window.setTimeout(() => {
        setVisualPhase("coasting");
        coastTimerRef.current = null;
      }, minimumTimeRemaining);

      centerTimerRef.current = window.setTimeout(() => {
        setVisualPhase("centering");
        centerTimerRef.current = null;
      }, minimumTimeRemaining + COAST_DURATION);

      stopTimerRef.current = window.setTimeout(
        () => {
          setVisualPhase("stopping");
          stopTimerRef.current = null;
        },
        minimumTimeRemaining + COAST_DURATION + CENTERING_DURATION,
      );

      idleTimerRef.current = window.setTimeout(
        () => {
          setVisualPhase("idle");

          activatedAtRef.current = 0;
          idleTimerRef.current = null;
        },
        minimumTimeRemaining +
          COAST_DURATION +
          CENTERING_DURATION +
          STOP_FADE_DURATION,
      );
    }

    return () => {
      if (activationTimerRef.current) {
        window.clearTimeout(activationTimerRef.current);
      }

      if (coastTimerRef.current) {
        window.clearTimeout(coastTimerRef.current);
      }

      if (centerTimerRef.current) {
        window.clearTimeout(centerTimerRef.current);
      }

      if (stopTimerRef.current) {
        window.clearTimeout(stopTimerRef.current);
      }

      if (idleTimerRef.current) {
        window.clearTimeout(idleTimerRef.current);
      }
    };
  }, [runtimeIsActive]);
  const scannerLabel =
    runningScans.length > 0
      ? `${runningScans.length} scan${
          runningScans.length === 1 ? "" : "s"
        } actively running`
      : queueIsActive
        ? `${queueMetrics.queued} queued scan${
            queueMetrics.queued === 1 ? "" : "s"
          }; scanner preparing next target`
        : visualPhase === "coasting"
      ? "Scanner decelerating"
      : visualPhase === "centering"
        ? "Scanner returning to center"
        : visualPhase === "stopping"
          ? "Scanner completing shutdown"
          : "Sentinel scanner idle";

  return (
    <div
      className={`sentinel-pulse-scanner sentinel-pulse-scanner--${visualPhase}`}
      role="status"
      aria-live="polite"
      aria-label={scannerLabel}
    >
      <div className="sentinel-pulse-scanner__housing">
        <span className="sentinel-pulse-scanner__ambient" />
        <span className="sentinel-pulse-scanner__rail" />
        <span className="sentinel-pulse-scanner__beam" />
      </div>
    </div>
  );
}

export default SentinelPulseScanner;
