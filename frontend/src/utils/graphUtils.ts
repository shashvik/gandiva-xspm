import { NodeData } from './mockData';

// Snap node position to grid
export const snapToGrid = (position: number, gridSize: number): number => {
  return Math.round(position / gridSize) * gridSize;
};

// Get color based on node type with dark mode support
export const getNodeColor = (type: NodeData['type'], darkMode = false): string => {
  if (darkMode) {
    switch (type) {
      case 'ec2':
        return 'bg-blue-900 text-blue-100';
      case 'iam':
        return 'bg-purple-900 text-purple-100';
      case 's3':
        return 'bg-green-900 text-green-100';
      default:
        return 'bg-gray-800 text-gray-100';
    }
  } else {
    switch (type) {
      case 'ec2':
        return 'bg-blue-100 text-blue-800';
      case 'iam':
        return 'bg-purple-100 text-purple-800';
      case 's3':
        return 'bg-green-100 text-green-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  }
};
// Get border color based on node type with dark mode support
export const getNodeBorderColor = (type: NodeData['type'], darkMode = false): string => {
  if (darkMode) {
    switch (type) {
      case 'ec2':
        return 'border-blue-700';
      case 'iam':
        return 'border-purple-700';
      case 's3':
        return 'border-green-700';
      default:
        return 'border-gray-700';
    }
  } else {
    switch (type) {
      case 'ec2':
        return 'border-blue-200';
      case 'iam':
        return 'border-purple-200';
      case 's3':
        return 'border-green-200';
      default:
        return 'border-gray-200';
    }
  }
};

// Format property value for display
export const formatPropertyValue = (value: any): string => {
  if (typeof value === 'boolean') {
    return value ? 'Yes' : 'No';
  }
  
  if (value === null || value === undefined) {
    return '-';
  }
  
  if (typeof value === 'object') {
    return JSON.stringify(value);
  }
  
  return String(value);
};

// Debounce function for performance
export const debounce = <F extends (...args: any[]) => any>(
  func: F,
  waitFor: number
) => {
  let timeout: ReturnType<typeof setTimeout> | null = null;

  return (...args: Parameters<F>): Promise<ReturnType<F>> => {
    if (timeout !== null) {
      clearTimeout(timeout);
    }
    
    return new Promise(resolve => {
      timeout = setTimeout(() => resolve(func(...args)), waitFor);
    });
  };
};

// Generate a unique ID
export const generateId = (): string => {
  return Math.random().toString(36).substring(2, 11);
};

// Calculate distance between two points
export const calculateDistance = (x1: number, y1: number, x2: number, y2: number): number => {
  return Math.sqrt(Math.pow(x2 - x1, 2) + Math.pow(y2 - y1, 2));
};
