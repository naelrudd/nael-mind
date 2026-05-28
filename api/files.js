module.exports = async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const repo = process.env.GITHUB_REPO || 'naelrudd/nael-mind';
  const token = process.env.GITHUB_PAT;
  const apiUrl = `https://api.github.com/repos/${repo}/git/trees/main?recursive=1`;

  try {
    const response = await fetch(apiUrl, {
      headers: {
        'Authorization': `token ${token}`,
        'Accept': 'application/vnd.github.v3+json',
      },
    });

    const data = await response.json();
    if (!response.ok) return res.status(response.status).json({ error: data });

    // Filter hanya file .md yang ada di folder content/
    const allFiles = data.tree
      .filter(item => item.type === 'blob' && item.path.startsWith('content/') && item.path.endsWith('.md'))
      .map(item => ({
        path: item.path,
        name: item.path.replace('content/', ''),
        url: `https://github.com/${repo}/blob/main/${item.path}`
      }));

    return res.status(200).json({
      total: allFiles.length,
      files: allFiles
    });
  } catch (error) {
    return res.status(500).json({ error: 'Internal error', message: error.message });
  }
};
