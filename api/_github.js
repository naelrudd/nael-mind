const DEFAULT_REPO = 'naelrudd/nael-mind';

function getRepo() {
  return process.env.GITHUB_REPO || DEFAULT_REPO;
}

function getToken() {
  return process.env.GITHUB_PAT;
}

function normalizePath(input) {
  const value = String(input || '').trim().replace(/^\/+/, '').replace(/\/+$/, '');
  if (!value) return '';

  const parts = value.split('/');
  if (parts.some((part) => part === '.' || part === '..')) {
    throw new Error('Invalid path');
  }

  return value;
}

function repoApiUrl(path) {
  return `https://api.github.com/repos/${getRepo()}/${path}`;
}

async function githubRequest(path, options = {}) {
  const token = getToken();
  const response = await fetch(repoApiUrl(path), {
    ...options,
    headers: {
      Authorization: `token ${token}`,
      Accept: 'application/vnd.github.v3+json',
      ...(options.headers || {}),
    },
  });

  return response;
}

async function getRepoTree(branch = 'main') {
  const response = await githubRequest(`git/trees/${branch}?recursive=1`);
  const data = await response.json();

  if (!response.ok) {
    throw new Error(data?.message || 'Failed to load repository tree');
  }

  return data.tree || [];
}

async function getRepoFile(path) {
  const filePath = normalizePath(path);
  const response = await githubRequest(`contents/${filePath}`);

  if (response.status === 404) {
    return null;
  }

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data?.message || `Failed to load ${filePath}`);
  }

  const content = data.encoding === 'base64'
    ? Buffer.from(data.content || '', 'base64').toString('utf8')
    : String(data.content || '');

  return {
    path: data.path,
    sha: data.sha,
    htmlUrl: data.html_url,
    content,
    raw: data,
  };
}

async function upsertRepoFile(path, content, message) {
  const filePath = normalizePath(path);
  const existing = await getRepoFile(filePath);

  const response = await githubRequest(`contents/${filePath}`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      message,
      content: Buffer.from(content).toString('base64'),
      ...(existing?.sha ? { sha: existing.sha } : {}),
    }),
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data?.message || `Failed to write ${filePath}`);
  }

  return data;
}

module.exports = {
  getRepo,
  getToken,
  normalizePath,
  githubRequest,
  getRepoTree,
  getRepoFile,
  upsertRepoFile,
};
