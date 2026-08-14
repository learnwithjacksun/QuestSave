import axios from "axios";
import useAuthStore from "@/store/useAuthStore";

const API_URL = import.meta.env.VITE_BASE_URL;

const api = axios.create({
  baseURL: API_URL,
  headers: {
    "Content-Type": "application/json",
  },
  withCredentials: true,
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      useAuthStore.getState().setUser(null);
    }
    return Promise.reject(error);
  }
);

export function getApiError(error: unknown, fallback = "Something went wrong") {
  if (axios.isAxiosError(error)) {
    const data = error.response?.data as { message?: string } | undefined;
    if (data?.message) return data.message;
    if (error.response?.status === 401) return "Sign in to continue";
  }
  return fallback;
}

export default api;
