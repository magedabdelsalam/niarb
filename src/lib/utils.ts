import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function getAllPaths(obj: any, prefix = ''): string[] {
  if (!obj || typeof obj !== 'object') return [];
  
  return Object.entries(obj).reduce((paths: string[], [key, value]) => {
    const currentPath = prefix ? `${prefix}.${key}` : key;
    
    if (Array.isArray(value)) {
      // For arrays, add the array path and expose nested keys from the first item
      const arrayPaths = [currentPath];
      if (value.length > 0 && typeof value[0] === 'object') {
        arrayPaths.push(...getAllPaths(value[0], currentPath));
      }
      return [...paths, ...arrayPaths];
    } else if (value && typeof value === 'object') {
      return [...paths, currentPath, ...getAllPaths(value, currentPath)];
    }
    return [...paths, currentPath];
  }, []);
}
