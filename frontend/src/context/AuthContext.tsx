import React, { createContext, useContext, useState, useEffect, type ReactNode } from "react";
import axios from "axios";

const API_BASE_URL = import.meta.env.VITE_API_URL || "http://127.0.0.1:8000/api";

interface User {
  id: number;
  email: string;
  username: string;
  full_name?: string;
  role: "admin" | "user" | "iot_device";
}

interface AuthContextType {
  user: User | null;
  accessToken: string | null;
  refreshToken: string | null;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  signup: (email: string, username: string, password: string, fullName?: string) => Promise<void>;
  logout: () => void;
  isAuthenticated: boolean;
  isAdmin: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [refreshToken, setRefreshToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Initialize from localStorage
  useEffect(() => {
    const savedToken = localStorage.getItem("accessToken");
    const savedRefreshToken = localStorage.getItem("refreshToken");

    if (savedToken && savedRefreshToken) {
      setAccessToken(savedToken);
      setRefreshToken(savedRefreshToken);

      // Verify token by fetching user info
      verifyToken(savedToken)
        .then((currentUser) => setUser(currentUser))
        .catch(() => {
          localStorage.removeItem("accessToken");
          localStorage.removeItem("refreshToken");
          setAccessToken(null);
          setRefreshToken(null);
          setUser(null);
        })
        .finally(() => setIsLoading(false));
    } else {
      setIsLoading(false);
    }
  }, []);

  const verifyToken = async (token: string): Promise<User> => {
    const response = await axios.get<User>(`${API_BASE_URL}/auth/me`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    return response.data;
  };

  const login = async (email: string, password: string) => {
    try {
      const response = await axios.post(`${API_BASE_URL}/auth/login`, {
        email,
        password,
      });

      const { access_token: newAccessToken, refresh_token: newRefreshToken } = response.data;
      const currentUser = await verifyToken(newAccessToken);

      setAccessToken(newAccessToken);
      setRefreshToken(newRefreshToken);
      setUser(currentUser);
      localStorage.setItem("accessToken", newAccessToken);
      localStorage.setItem("refreshToken", newRefreshToken);
    } catch (error: any) {
      throw new Error(getAuthErrorMessage(error, "Login failed"));
    }
  };

  const signup = async (email: string, username: string, password: string, fullName?: string) => {
    try {
      const response = await axios.post(`${API_BASE_URL}/auth/signup`, {
        email,
        username,
        password,
        full_name: fullName,
      });

      const { access_token: newAccessToken, refresh_token: newRefreshToken } = response.data;
      const currentUser = await verifyToken(newAccessToken);

      setAccessToken(newAccessToken);
      setRefreshToken(newRefreshToken);
      setUser(currentUser);
      localStorage.setItem("accessToken", newAccessToken);
      localStorage.setItem("refreshToken", newRefreshToken);
    } catch (error: any) {
      throw new Error(getAuthErrorMessage(error, "Signup failed"));
    }
  };

  const logout = () => {
    setUser(null);
    setAccessToken(null);
    setRefreshToken(null);
    localStorage.removeItem("accessToken");
    localStorage.removeItem("refreshToken");
  };

  const value: AuthContextType = {
    user,
    accessToken,
    refreshToken,
    isLoading,
    login,
    signup,
    logout,
    isAuthenticated: !!user && !!accessToken,
    isAdmin: user?.role === "admin",
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

function getAuthErrorMessage(error: unknown, fallback: string): string {
  if (!axios.isAxiosError(error)) {
    return error instanceof Error ? error.message : fallback;
  }

  const detail = error.response?.data?.detail;
  if (typeof detail === "string") return detail;
  if (Array.isArray(detail)) {
    return detail.map((issue: { msg?: string }) => issue.msg).filter(Boolean).join(" ") || fallback;
  }
  if (!error.response) {
    return "Unable to connect to UrbanIQ. Start the backend server and try again.";
  }
  return fallback;
}

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};
