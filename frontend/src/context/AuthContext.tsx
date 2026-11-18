import React, { createContext, useContext, useState, useEffect } from 'react';
import { User } from '../types';
import { api } from '../services/api';

interface TrialSignupPayload {
  full_name: string;
  email: string;
  password: string;
  phone?: string;
  course_id: string;
}

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<User>;
  trialSignup: (payload: TrialSignupPayload) => Promise<User>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(() => {
    const saved = localStorage.getItem('aptech_user');
    return saved ? JSON.parse(saved) : null;
  });
  const [isLoading, setIsLoading] = useState<boolean>(true);

  const refreshUser = async () => {
    const token = localStorage.getItem('aptech_token');
    if (!token) {
      setUser(null);
      setIsLoading(false);
      return;
    }

    try {
      const res = await api.get<User>('/auth/me');
      setUser(res.data);
      localStorage.setItem('aptech_user', JSON.stringify(res.data));
    } catch {
      setUser(null);
      localStorage.removeItem('aptech_user');
      localStorage.removeItem('aptech_token');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    refreshUser();
  }, []);

  const login = async (email: string, password: string): Promise<User> => {
    const res = await api.post('/auth/login', { email, password });
    if (res.data.access_token) {
      localStorage.setItem('aptech_token', res.data.access_token);
    }
    const userData: User = {
      id: res.data.user_id,
      email: res.data.email,
      full_name: res.data.full_name,
      role: res.data.role,
      is_active: true,
      is_suspended: false,
      aptech_student_id: res.data.aptech_student_id,
      track_type: res.data.track_type,
    };
    setUser(userData);
    localStorage.setItem('aptech_user', JSON.stringify(userData));
    return userData;
  };

  const trialSignup = async (payload: TrialSignupPayload): Promise<User> => {
    const res = await api.post('/auth/trial-signup', payload);
    if (res.data.access_token) {
      localStorage.setItem('aptech_token', res.data.access_token);
    }
    const userData: User = {
      id: res.data.user_id,
      email: res.data.email,
      full_name: res.data.full_name,
      role: res.data.role,
      is_active: true,
      is_suspended: false,
      aptech_student_id: res.data.aptech_student_id,
      track_type: res.data.track_type,
    };
    setUser(userData);
    localStorage.setItem('aptech_user', JSON.stringify(userData));
    return userData;
  };

  const logout = async () => {
    try {
      await api.post('/auth/logout');
    } catch {
      // ignore
    } finally {
      setUser(null);
      localStorage.removeItem('aptech_user');
      localStorage.removeItem('aptech_token');
      window.location.href = '/login';
    }
  };

  return (
    <AuthContext.Provider value={{ user, isLoading, login, trialSignup, logout, refreshUser }}>
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
