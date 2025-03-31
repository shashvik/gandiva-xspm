import axios from 'axios';
import { authAxios } from './auth';

// API Configuration
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000';

// GitHub credential management
export const getGitHubCredentials = async () => {
  try {
    const response = await authAxios.get('/github-credentials');
    return response.data;
  } catch (error) {
    console.error('Error fetching GitHub credentials:', error);
    throw error;
  }
};

export const saveGitHubCredential = async (credential: any) => {
  try {
    const response = await authAxios.post('/github-credentials', credential);
    return response.data;
  } catch (error) {
    console.error('Error saving GitHub credential:', error);
    throw error;
  }
};

export const updateGitHubCredential = async (name: string, credential: any) => {
  try {
    const response = await authAxios.put(`/github-credentials/${name}`, credential);
    return response.data;
  } catch (error) {
    console.error(`Error updating GitHub credential ${name}:`, error);
    throw error;
  }
};

export const deleteGitHubCredential = async (name: string) => {
  try {
    const response = await authAxios.delete(`/github-credentials/${name}`);
    return response.data;
  } catch (error) {
    console.error(`Error deleting GitHub credential ${name}:`, error);
    throw error;
  }
};

// GitHub secret scanning
export const getGitHubSecretScanResults = async () => {
  try {
    const response = await authAxios.get('/github-secret-scan');
    return response.data;
  } catch (error) {
    console.error('Error fetching GitHub secret scan results:', error);
    throw error;
  }
};

export const getGitHubSecretScanResultById = async (scanId: string) => {
  try {
    const response = await authAxios.get(`/github-secret-scan/${scanId}`);
    return response.data;
  } catch (error) {
    console.error(`Error fetching GitHub secret scan result ${scanId}:`, error);
    throw error;
  }
};

export const scanGitHubRepositoryForSecrets = async (credentialName: string) => {
  try {
    const response = await authAxios.post('/github-secret-scan', { credential_name: credentialName });
    return response.data;
  } catch (error) {
    console.error('Error scanning GitHub repository for secrets:', error);
    throw error;
  }
};
