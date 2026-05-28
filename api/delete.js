module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { filename, commit_message } = req.body;

  if (!filename) {
    return res.status(400).json({ error: 'filename required' });
  }

  const normalizeContentPath = (input) => {
    const value = String(input || '').trim().replace(/^\/+/, '').replace(/\/+$/, '');

    if (!value || value === 'content') {
      return 'content';
    }

    const parts = value.split('/');
    if (parts.some((part) => part === '.' || part === '..')) {
      throw new Error('Invalid path');
    }

    return value.startsWith('content/') ? value : `content/${value}`;
  };

  const filePath = normalizeContentPath(filename);
  const repo = process.env.GITHUB_REPO || 'naelrudd/nael-mind';
  const token = process.env.GITHUB_PAT;
  const apiUrl = `https://api.github.com/repos/${repo}/contents/${filePath}`;

  try {
    // 1. Get SHA of file to delete
    const getRes = await fetch(apiUrl, {
      headers: {
        'Authorization': `token ${token}`,
        'Accept': 'application/vnd.github.v3+json',
      },
    });

    if (getRes.status === 404) {
      return res.status(404).json({ error: 'File not found' });
    }

    if (!getRes.ok) {
      const err = await getRes.json();
      return res.status(getRes.status).json({ error: 'Failed to get file info', details: err });
    }

    const fileData = await getRes.json();
    const sha = fileData.sha;

    // 2. Delete file via GitHub API
    const delRes = await fetch(apiUrl, {
      method: 'DELETE',
      headers: {
        'Authorization': `token ${token}`,
        'Accept': 'application/vnd.github.v3+json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        message: commit_message || `delete: ${filename}`,
        sha: sha,
      }),
    });

    const result = await delRes.json();

    if (!delRes.ok) {
      return res.status(delRes.status).json({
        error: 'GitHub API error',
        details: result,
      });
    }

    return res.status(200).json({
      success: true,
      filename: filePath,
      deleted: true,
      commit: result.commit?.sha,
    });

  } catch (error) {
    return res.status(500).json({
      error: 'Internal error',
      message: error.message,
    });
  }
}
