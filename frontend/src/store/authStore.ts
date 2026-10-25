import { create } from 'zustand';

interface User {
  id: number;
  username: string;
  role: 'admin' | 'user';
}

interface AuthState {
  userToken: string | null;
  userData: User | null;
  userLogin: (token: string, user: User) => void;
  userLogout: () => void;

  adminToken: string | null;
  adminData: User | null;
  adminLogin: (token: string, user: User) => void;
  adminLogout: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  userToken: localStorage.getItem('chedu_user_token'),
  userData: localStorage.getItem('chedu_user_data') ? JSON.parse(localStorage.getItem('chedu_user_data')!) : null,
  userLogin: (token, user) => {
    localStorage.setItem('chedu_user_token', token);
    localStorage.setItem('chedu_user_data', JSON.stringify(user));
    set({ userToken: token, userData: user });
  },
  userLogout: () => {
    localStorage.removeItem('chedu_user_token');
    localStorage.removeItem('chedu_user_data');
    set({ userToken: null, userData: null });
  },

  adminToken: localStorage.getItem('chedu_admin_token'),
  adminData: localStorage.getItem('chedu_admin_data') ? JSON.parse(localStorage.getItem('chedu_admin_data')!) : null,
  adminLogin: (token, user) => {
    localStorage.setItem('chedu_admin_token', token);
    localStorage.setItem('chedu_admin_data', JSON.stringify(user));
    set({ adminToken: token, adminData: user });
  },
  adminLogout: () => {
    localStorage.removeItem('chedu_admin_token');
    localStorage.removeItem('chedu_admin_data');
    set({ adminToken: null, adminData: null });
  }
}));
