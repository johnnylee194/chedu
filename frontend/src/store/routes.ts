import { create } from 'zustand';

interface Route {
  id: number;
  title: string;
  description: string;
  total_distance: number;
  estimated_duration: number;
  total_ascent: number;
  max_elevation: number;
  difficulty: number;
  vehicle_type: string;
  tracks: any[];
  pois: any[];
  images: any[];
}

interface RouteState {
  routes: Route[];
  currentRoute: Route | null;
  isLoading: boolean;
  error: string | null;
  setRoutes: (routes: Route[]) => void;
  setCurrentRoute: (route: Route | null) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
}

export const useRouteStore = create<RouteState>((set) => ({
  routes: [],
  currentRoute: null,
  isLoading: false,
  error: null,
  setRoutes: (routes) => set({ routes }),
  setCurrentRoute: (route) => set({ currentRoute: route }),
  setLoading: (isLoading) => set({ isLoading }),
  setError: (error) => set({ error }),
}));
