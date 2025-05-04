export const BASE_URL = 'https://eodhistoricaldata.com/api';

// Safe retrieval of API key with a function that will throw a clear error message if used without a key
const getApiKey = () => {
  const apiKey = process.env.NEXT_PUBLIC_EOD_API_KEY;
  if (!apiKey) {
    console.error('EOD Historical Data API key is not configured. Please set NEXT_PUBLIC_EOD_API_KEY in .env.local');
    return null; // Return null to prevent undefined errors
  }
  return apiKey;
};

export const API_KEY = getApiKey();

// Function to safely check if we have a valid API key before making requests
export const hasValidApiKey = () => {
  return API_KEY !== null && API_KEY !== undefined;
};
