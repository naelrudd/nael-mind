module.exports = async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
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

  const { path = '' } = req.query;
  const contentPath = normalizeContentPath(path);
  const repo = 'naelrudd/nael-mind';
  const token = process.env.GITHUB_PAT;
  const apiUrl = `https://api.github.com/repos/${repo}/contents/${contentPath}`;

  try {
    const response = await fetch(apiUrl, {
      headers: {
        'Authorization': `token ${token}`,
        'Accept': 'application/vnd.github.v3+json',
      },
    });

    const data = await response.json();

    if (!response.ok) {
      return res.status(response.status).json({ error: data });
    }

    // Format response
    const files = Array.isArray(data) 
      ? data.map(item => ({
          name: item.name,
          type: item.type, // file or dir
          path: item.path,
          url: item.html_url,
        }))
      : [{
          name: data.name,
          type: 'file',
          path: data.path,
          url: data.html_url,
        }];

    return res.status(200).json({ path: contentPath, files });

  } catch (error) {
    return res.status(500).json({ 
      error: 'Internal error', 
      message: error.message 
    });
  }
}
