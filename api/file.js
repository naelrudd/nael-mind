module.exports = async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const { path } = req.query;
  if (!path) return res.status(400).json({ error: 'Path parameter is required' });

  const repo = 'naelrudd/nael-mind';
  const token = process.env.GITHUB_PAT;
  
  // Ensure path starts with content/
  const normalizedPath = path.startsWith('content/') ? path : `content/${path}`;
  const apiUrl = `https://api.github.com/repos/${repo}/contents/${normalizedPath}`;

  try {
    const response = await fetch(apiUrl, {
      headers: {
        'Authorization': `token ${token}`,
        'Accept': 'application/vnd.github.v3+json',
      },
    });

    const data = await response.json();
    if (!response.ok) return res.status(response.status).json({ error: data });

    // GitHub returns content in base64
    const content = Buffer.from(data.content, 'base64').toString('utf-8');

    // Return as plain text if requested via header, else JSON
    if (req.headers['accept'] === 'text/plain') {
      res.setHeader('Content-Type', 'text/plain');
      return res.status(200).send(content);
    }

    return res.status(200).json({
      path: data.path,
      content: content
    });
  } catch (error) {
    return res.status(500).json({ error: 'Internal error', message: error.message });
  }
};
