export const BACKEND_RECOVERED_EVENT = "sentinelscope:backend-recovered";

export const announceBackendRecovery = (detail = {}) => {
  window.dispatchEvent(
    new CustomEvent(BACKEND_RECOVERED_EVENT, {
      detail,
    }),
  );
};

export const subscribeToBackendRecovery = (listener) => {
  window.addEventListener(BACKEND_RECOVERED_EVENT, listener);

  return () => {
    window.removeEventListener(BACKEND_RECOVERED_EVENT, listener);
  };
};
