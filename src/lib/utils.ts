import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function getAllPaths(obj: any, prefix = '', options = { includeArrayIndices: false }): string[] {
  if (!obj || typeof obj !== 'object') return [];
  
  return Object.entries(obj).reduce((paths: string[], [key, value]) => {
    const currentPath = prefix ? `${prefix}.${key}` : key;
    
    if (Array.isArray(value)) {
      // Always add the array path itself
      const arrayPaths = [currentPath];
      
      // If array has items, get paths from the first item
      if (value.length > 0) {
        if (options.includeArrayIndices) {
          // Add indexed path if requested (e.g., items[0])
          arrayPaths.push(`${currentPath}[0]`);
          
          // If the first item is an object, get its nested paths with index
          if (typeof value[0] === 'object' && value[0] !== null) {
            const itemPaths = getAllPaths(value[0], `${currentPath}[0]`, options);
            arrayPaths.push(...itemPaths);
          }
        } else {
          // Get paths from first item without index for logic blocks
          if (typeof value[0] === 'object' && value[0] !== null) {
            // For nested objects in arrays, use the array path as prefix
            const itemPaths = getAllPaths(value[0], currentPath, options);
            arrayPaths.push(...itemPaths);
          }
        }
      }
      
      return [...paths, ...arrayPaths];
    } else if (value && typeof value === 'object' && value !== null) {
      // For objects, include both the object path and all nested paths
      const objectPaths = [currentPath, ...getAllPaths(value, currentPath, options)];
      return [...paths, ...objectPaths];
    }
    
    // For primitive values, just add the path
    return [...paths, currentPath];
  }, []);
}

// Helper function to get paths specifically for logic blocks
export function getLogicBlockPaths(obj: any): string[] {
  return getAllPaths(obj, '', { includeArrayIndices: false });
}

// Helper function to get paths with array indices (for other uses)
export function getFullPaths(obj: any): string[] {
  return getAllPaths(obj, '', { includeArrayIndices: true });
}
