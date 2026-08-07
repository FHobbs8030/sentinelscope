const SCAN_QUEUE_DRAINED_EVENT =
  "sentinelscope:scan-queue-drained";

export function emitScanQueueDrained(detail = {}) {
  window.dispatchEvent(
    new CustomEvent(SCAN_QUEUE_DRAINED_EVENT, {
      detail,
    }),
  );
}

export function subscribeToScanQueueDrained(listener) {
  if (typeof listener !== "function") {
    return () => {};
  }

  const handleQueueDrained = (event) => {
    listener(event.detail ?? {});
  };

  window.addEventListener(
    SCAN_QUEUE_DRAINED_EVENT,
    handleQueueDrained,
  );

  return () => {
    window.removeEventListener(
      SCAN_QUEUE_DRAINED_EVENT,
      handleQueueDrained,
    );
  };
}
