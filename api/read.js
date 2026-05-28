const { getRepoFile } = require('./_github');

module.exports = async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { filename } = req.query;
  if (!filename) {
    return res.status(400).json({ error: 'Missing filename query param' });
  }

  try {
    let path = filename.startsWith('content/') ? filename : `content/${filename}`;
    let data = await getRepoFile(path);
    if (!data && !path.toLowerCase().endsWith('.md')) {
      path = path.endsWith('.md') ? path : `${path}.md`;
      data = await getRepoFile(path);
    }
    if (!data) {
      return res.status(404).json({ error: 'File not found' });
    }

    return res.status(200).json({
      filename: data.path,
      content: data.content,
      sha: data.sha,
    });
  } catch (error) {
    return res.status(500).json({ error: 'Internal error', message: error.message });
  }
};
