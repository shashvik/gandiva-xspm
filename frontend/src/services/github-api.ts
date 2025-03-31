import { authAxios } from './auth';

// GitHub Credentials Management
export const getGitHubCredentials = async () => {
  try {
    const response = await authAxios.get('/github-credentials');
    return response.data;
  } catch (error) {
    console.error('Error fetching GitHub credentials:', error);
    throw error;
  }
};

export const saveGitHubCredential = async (credential) => {
  try {
    const response = await authAxios.post('/github-credentials', credential);
    return response.data;
  } catch (error) {
    console.error('Error saving GitHub credential:', error);
    throw error;
  }
};

export const updateGitHubCredential = async (name, credential) => {
  try {
    const response = await authAxios.put(`/github-credentials/${name}`, credential);
    return response.data;
  } catch (error) {
    console.error(`Error updating GitHub credential ${name}:`, error);
    throw error;
  }
};

export const deleteGitHubCredential = async (name) => {
  try {
    const response = await authAxios.delete(`/github-credentials/${name}`);
    return response.data;
  } catch (error) {
    console.error(`Error deleting GitHub credential ${name}:`, error);
    throw error;
  }
};

// GitHub Scanner
export const scanGitHubRepository = async (credentialName) => {
  try {
    const response = await authAxios.post('/github-scanner', { credential_name: credentialName });
    return response.data;
  } catch (error) {
    console.error('Error scanning GitHub repository:', error);
    throw error;
  }
};

export const getGitHubScanResults = async () => {
  try {
    const response = await authAxios.get('/github-scanner');
    return response.data;
  } catch (error) {
    console.error('Error fetching GitHub scan results:', error);
    throw error;
  }
};

export const getGitHubScanResultById = async (scanId) => {
  try {
    const response = await authAxios.get(`/github-scanner/${scanId}`);
    return response.data;
  } catch (error) {
    console.error(`Error fetching GitHub scan result ${scanId}:`, error);
    throw error;
  }
};
