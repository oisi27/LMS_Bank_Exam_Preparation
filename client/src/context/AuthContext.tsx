import React, { createContext, useContext, useState, useEffect } from 'react';
import axios from 'axios';
import type { UserRole } from '../../../shared';

export interface User {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  targetExam?: string;
  targetDate?: string;
  targetBank?: string;
  targetPosition?: string;
  phone?: string;
}

interface AuthContextType {
  user: User | null;
  token: string | null;
  isLoading: boolean;
  login: (identifierOrEmail: string, password: string) => Promise<void>;
  register: (data: { email: string; password: string; name: string; role?: UserRole; phone?: string }) => Promise<{ requiresVerification?: boolean; email?: string; phone?: string; message?: string; user?: User }>;
  registerPhone: (data: { phone: string; password: string; name: string; email?: string; role?: UserRole }) => Promise<{ requiresVerification?: boolean; phone?: string; message?: string; user?: User }>;
  logout: () => Promise<void>;
  completeOnboarding: (data: { targetExam?: string; targetBank?: string; targetPosition?: string; targetDate?: string }) => Promise<void>;
  updateGoal: (data: { targetBank: string; targetPosition: string; targetDate?: string | null }) => Promise<any>;
  verifyOtp: (destination: string, code: string) => Promise<{ success: boolean; activated?: boolean; message?: string }>;
  requestOtp: (destination: string, type: 'EMAIL' | 'PHONE') => Promise<string>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  // Configure axios defaults with credentials to support HttpOnly cookie
  axios.defaults.withCredentials = true;

  // Track active refresh promise to coalesce concurrent 401s into a single refresh request
  let refreshPromise: Promise<string | null> | null = null;

  // Centralized Axios Interceptor for Automatic & Transparent Token Refresh
  useEffect(() => {
    // Request interceptor to always attach current token from memory or localStorage
    const reqInterceptor = axios.interceptors.request.use((config) => {
      const activeToken = localStorage.getItem('token');
      if (activeToken && !config.headers['Authorization']) {
        config.headers['Authorization'] = `Bearer ${activeToken}`;
      }
      return config;
    });

    // Response interceptor to catch 401 and retry once after silent refresh
    const resInterceptor = axios.interceptors.response.use(
      (response) => response,
      async (error) => {
        const originalRequest = error.config;
        if (!originalRequest) return Promise.reject(error);

        // Do not intercept authentication endpoints to avoid recursion
        const requestUrl = originalRequest.url || '';
        const isAuthUrl = requestUrl.includes('/api/auth/login') ||
                          requestUrl.includes('/api/auth/refresh') ||
                          requestUrl.includes('/api/auth/register') ||
                          requestUrl.includes('/api/auth/otp');

        if (error.response?.status === 401 && !originalRequest._retry && !isAuthUrl) {
          originalRequest._retry = true;

          try {
            if (!refreshPromise) {
              refreshPromise = (async () => {
                try {
                  const refreshRes = await axios.post('http://localhost:5000/api/auth/refresh', {}, {
                    withCredentials: true
                  });
                  if (refreshRes.data.success && refreshRes.data.accessToken) {
                    const newToken = refreshRes.data.accessToken;
                    const refreshedUser = refreshRes.data.user;
                    setToken(newToken);
                    localStorage.setItem('token', newToken);
                    axios.defaults.headers.common['Authorization'] = `Bearer ${newToken}`;
                    if (refreshedUser) {
                      setUser(refreshedUser);
                      localStorage.setItem('user', JSON.stringify(refreshedUser));
                    }
                    return newToken;
                  }
                  return null;
                } catch (refreshErr) {
                  return null;
                } finally {
                  refreshPromise = null;
                }
              })();
            }

            const refreshedToken = await refreshPromise;
            if (refreshedToken) {
              // Retry original request with freshly minted token
              originalRequest.headers = originalRequest.headers || {};
              originalRequest.headers['Authorization'] = `Bearer ${refreshedToken}`;
              return axios(originalRequest);
            } else {
              // Genuine refresh failure: session is dead
              clearAuth();
              return Promise.reject(error);
            }
          } catch (retryErr) {
            return Promise.reject(retryErr);
          }
        }

        return Promise.reject(error);
      }
    );

    return () => {
      axios.interceptors.request.eject(reqInterceptor);
      axios.interceptors.response.eject(resInterceptor);
    };
  }, []);

  // Restore session on initial mount
  useEffect(() => {
    const restoreSession = async () => {
      const storedToken = localStorage.getItem('token');
      const storedUser = localStorage.getItem('user');

      if (storedToken && storedUser) {
        try {
          setToken(storedToken);
          setUser(JSON.parse(storedUser));
          axios.defaults.headers.common['Authorization'] = `Bearer ${storedToken}`;

          // Validate token with backend /me endpoint
          const res = await axios.get('http://localhost:5000/api/auth/me');
          if (res.data.success && res.data.user) {
            setUser(res.data.user);
            localStorage.setItem('user', JSON.stringify(res.data.user));
          }
        } catch (err: any) {
          // Attempt silent refresh via HttpOnly refresh cookie
          try {
            const refreshRes = await axios.post('http://localhost:5000/api/auth/refresh');
            if (refreshRes.data.success) {
              const newToken = refreshRes.data.accessToken;
              const refreshedUser = refreshRes.data.user;
              setToken(newToken);
              setUser(refreshedUser);
              localStorage.setItem('token', newToken);
              localStorage.setItem('user', JSON.stringify(refreshedUser));
              axios.defaults.headers.common['Authorization'] = `Bearer ${newToken}`;
            } else {
              clearAuth();
            }
          } catch {
            clearAuth();
          }
        }
      } else {
        // In case cookie exists without localStorage (e.g. fresh tab)
        try {
          const refreshRes = await axios.post('http://localhost:5000/api/auth/refresh');
          if (refreshRes.data.success) {
            const newToken = refreshRes.data.accessToken;
            const refreshedUser = refreshRes.data.user;
            setToken(newToken);
            setUser(refreshedUser);
            localStorage.setItem('token', newToken);
            localStorage.setItem('user', JSON.stringify(refreshedUser));
            axios.defaults.headers.common['Authorization'] = `Bearer ${newToken}`;
          }
        } catch {}
      }
      setIsLoading(false);
    };

    restoreSession();
  }, []);

  const clearAuth = () => {
    setUser(null);
    setToken(null);
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    delete axios.defaults.headers.common['Authorization'];
  };

  const login = async (identifierOrEmail: string, password: string) => {
    const res = await axios.post('http://localhost:5000/api/auth/login', {
      identifier: identifierOrEmail,
      email: identifierOrEmail,
      password
    });
    if (res.data.success) {
      const { user: loggedInUser, accessToken } = res.data;
      setUser(loggedInUser);
      setToken(accessToken);
      localStorage.setItem('token', accessToken);
      localStorage.setItem('user', JSON.stringify(loggedInUser));
      axios.defaults.headers.common['Authorization'] = `Bearer ${accessToken}`;
    } else {
      throw new Error(res.data.error || 'Login failed');
    }
  };

  const register = async (data: { email: string; password: string; name: string; role?: UserRole; phone?: string }) => {
    const res = await axios.post('http://localhost:5000/api/auth/register', data);
    if (res.data.success) {
      if (res.data.requiresVerification) {
        return { requiresVerification: true, email: res.data.email, message: res.data.message };
      }
      const { user: registeredUser, accessToken } = res.data;
      if (registeredUser && accessToken) {
        setUser(registeredUser);
        setToken(accessToken);
        localStorage.setItem('token', accessToken);
        localStorage.setItem('user', JSON.stringify(registeredUser));
        axios.defaults.headers.common['Authorization'] = `Bearer ${accessToken}`;
      }
      return { requiresVerification: false, user: registeredUser };
    } else {
      throw new Error(res.data.error || 'Registration failed');
    }
  };

  const registerPhone = async (data: { phone: string; password: string; name: string; email?: string; role?: UserRole }) => {
    const res = await axios.post('http://localhost:5000/api/auth/register-phone', data);
    if (res.data.success) {
      if (res.data.requiresVerification) {
        return { requiresVerification: true, phone: res.data.phone, message: res.data.message };
      }
      const { user: registeredUser, accessToken } = res.data;
      if (registeredUser && accessToken) {
        setUser(registeredUser);
        setToken(accessToken);
        localStorage.setItem('token', accessToken);
        localStorage.setItem('user', JSON.stringify(registeredUser));
        axios.defaults.headers.common['Authorization'] = `Bearer ${accessToken}`;
      }
      return { requiresVerification: false, user: registeredUser };
    } else {
      throw new Error(res.data.error || 'Phone registration failed');
    }
  };

  const completeOnboarding = async (data: string | { targetExam?: string; targetBank?: string; targetPosition?: string; targetDate?: string }, targetDateParam?: string) => {
    const payload = typeof data === 'string'
      ? { targetExam: data, targetDate: targetDateParam }
      : data;

    const res = await axios.post('http://localhost:5000/api/auth/onboarding', payload);
    if (res.data.success) {
      const updatedUser = res.data.user;
      setUser(updatedUser);
      localStorage.setItem('user', JSON.stringify(updatedUser));
    } else {
      throw new Error(res.data.error || 'Onboarding failed');
    }
  };

  const updateGoal = async (data: { targetBank: string; targetPosition: string; targetDate?: string | null }) => {
    const res = await axios.put('http://localhost:5000/api/auth/goal', data);
    if (res.data.success) {
      const updatedUser = res.data.user;
      setUser(updatedUser);
      localStorage.setItem('user', JSON.stringify(updatedUser));
      return res.data;
    } else {
      throw new Error(res.data.error || 'Failed to update preparation goal');
    }
  };

  const logout = async () => {
    try {
      await axios.post('http://localhost:5000/api/auth/logout');
    } catch (e) {
      console.warn('Logout notification to backend failed', e);
    } finally {
      clearAuth();
    }
  };

  const requestOtp = async (destination: string, type: 'EMAIL' | 'PHONE'): Promise<string> => {
    const res = await axios.post('http://localhost:5000/api/auth/otp/request', { destination, type });
    return res.data.message;
  };

  const verifyOtp = async (destination: string, code: string): Promise<{ success: boolean; activated?: boolean; message?: string }> => {
    const res = await axios.post('http://localhost:5000/api/auth/otp/verify', { destination, code });
    if (res.data.success) {
      if (res.data.activated && res.data.user && res.data.accessToken) {
        const { user: activeUser, accessToken } = res.data;
        setUser(activeUser);
        setToken(accessToken);
        localStorage.setItem('token', accessToken);
        localStorage.setItem('user', JSON.stringify(activeUser));
        axios.defaults.headers.common['Authorization'] = `Bearer ${accessToken}`;
      }
      return { success: true, activated: res.data.activated, message: res.data.message };
    }
    return { success: false, message: res.data.error || 'Verification failed.' };
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        isLoading,
        login,
        register,
        registerPhone,
        logout,
        completeOnboarding,
        updateGoal,
        requestOtp,
        verifyOtp
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
