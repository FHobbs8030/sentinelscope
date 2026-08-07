const ALERT_CREATED_EVENT = "sentinelscope:alert-created";

export function emitAlertCreated(detail = {}) {
  window.dispatchEvent(
    new CustomEvent(ALERT_CREATED_EVENT, {
      detail,
    }),
  );
}

export function subscribeToAlertCreated(listener) {
  if (typeof listener !== "function") {
    return () => {};
  }

  const handleAlertCreated = (event) => {
    listener(event.detail ?? {});
  };

  window.addEventListener(ALERT_CREATED_EVENT, handleAlertCreated);

  return () => {
    window.removeEventListener(
      ALERT_CREATED_EVENT,
      handleAlertCreated,
    );
  };
}
