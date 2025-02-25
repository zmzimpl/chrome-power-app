import fetch from 'node-fetch';

const BASE_URL = 'http://localhost:2018';

export async function openProfile(windowId) {
  const response = await fetch(`${BASE_URL}/profiles/open?windowId=${windowId}`);
  return await response.json();
}

export async function closeProfile(windowId) {
  const response = await fetch(`${BASE_URL}/profiles/close?windowId=${windowId}`);
  return await response.json();
}
