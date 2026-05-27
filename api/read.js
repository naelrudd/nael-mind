export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { filename } = req.query;

  if (!filename) {
    return res.status(400).json({ error: 'filename query param required' });
  }

  const repo = 'naelrudd/nael-mind';
  const token = process.env.GITHUB_PAT;
  const apiUrl = `https://api.github.com/repos/${repo}/contents/${filename}`;

  try {
    const response = await fetch(apiUrl, {
      headers: {
        'Authorization': `token ${token}`,
        'Accept': 'application/vnd.github.v3+json',
      },
    });

    if (response.status === 404) {
      return res.status(404).json({ error: 'File not found' });
    }

    const data = await response.json();
    const content = Buffer.from(data.content, 'base64').toString('utf8');

    return res.status(200).json({
      filename,
      content,
      sha: data.sha,
      url: data.html_url,
      lastUpdated: data.commit?.html_url,
    });

  } catch (error) {
    return res.status(500).json({ 
      error: 'Internal error', 
      message: error.message 
    });
  }
}