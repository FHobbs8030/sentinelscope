import { apiRequest } from "./apiClient";

export const getBackendHealth = ({ signal } = {}) => {
  return apiRequest("health", {
    signal,
    cache: "no-store",
  });
};
