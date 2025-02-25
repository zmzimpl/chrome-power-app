import fetch from 'node-fetch';

const BASE_URL = 'http://localhost:2018';

export async function createWindow(name) {
  const response = await fetch(`${BASE_URL}/window/create`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      name,
    }),
  });
  return await response.json();
}

export async function batchCreateWindows(windows) {
  const results = [];
  for (const window of windows) {
    try {
      const result = await createWindow(window.name);
      results.push(result);
    } catch (error) {
      console.error(`创建窗口失败: ${window.name}`, error);
    }
  }
  return results;
}

export async function getAllWindows() {
  const response = await fetch(`${BASE_URL}/window/all`);
  return await response.json();
}
