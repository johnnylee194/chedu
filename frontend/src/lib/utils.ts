import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatDistance(km: number): string {
  if (km < 1) {
    return `${Math.round(km * 1000)}m`;
  }
  return `${km.toFixed(1)}km`;
}

export function formatDuration(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;

  if (hours === 0) {
    return `${mins}分钟`;
  }
  if (mins === 0) {
    return `${hours}小时`;
  }
  return `${hours}小时${mins}分钟`;
}

export function formatElevation(meters: number): string {
  return `${meters.toFixed(0)}m`;
}

export function getDifficultyColor(difficulty: number): string {
  if (difficulty <= 2) return 'bg-green-500';
  if (difficulty <= 3) return 'bg-yellow-500';
  return 'bg-red-500';
}

export function getDifficultyLabel(difficulty: number): string {
  if (difficulty <= 2) return '简单';
  if (difficulty <= 3) return '中等';
  return '困难';
}

export function getPOIIcon(type: string): string {
  const icons: Record<string, string> = {
    camping: '🏕️',
    fuel: '⛽',
    water: '💧',
    danger: '⚠️',
    scenic: '📸',
    poi: '📍',
  };
  return icons[type] || '📍';
}
