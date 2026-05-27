export default async function handler(req, res) {
  // CORS & method check
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { filename, content, commit_message, append = false } = req.body;

  if (!filename || !content) {
    return res.status(400).json({ error: 'filename and content required' });
  }

  const repo = 'naelrudd/nael-mind';
  const token = process.env.GITHUB_PAT;
  const apiUrl = `https://api.github.com/repos/${repo}/contents/${filename}`;

  try {
    // 1. Check if file exists (need SHA for update)
    let sha = null;
    const getRes = await fetch(apiUrl, {
      headers: {
        'Authorization': `token ${token}`,
        'Accept': 'application/vnd.github.v3+json',
      },
    });

    if (getRes.status === 200) {
      const fileData = await getRes.json();
      sha = fileData.sha;
    }

    // 2. Prepare content
    let finalContent = content;
    
    if (append && sha) {
      // Decode existing content and append
      const existing = Buffer.from(fileData.content, 'base64').toString('utf8');
      finalContent = existing + '\n\n' + content;
    }

    // 3. Create/Update file via GitHub API
    const putRes = await fetch(apiUrl, {
      method: 'PUT',
      headers: {
        'Authorization': `token ${token}`,
        'Accept': 'application/vnd.github.v3+json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        message: commit_message || `update: ${filename}`,
        content: Buffer.from(finalContent).toString('base64'),
        ...(sha && { sha }), // include SHA if updating existing file
      }),
    });

    const result = await putRes.json();

    if (!putRes.ok) {
      return res.status(putRes.status).json({ 
        error: 'GitHub API error', 
        details: result 
      });
    }

    return res.status(200).json({
      success: true,
      filename,
      commit: result.commit?.sha,
      url: result.content?.html_url,
    });

  } catch (error) {
    return res.status(500).json({ 
      error: 'Internal error', 
      message: error.message 
    });
  }
}