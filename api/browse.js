const { getRepoFile } = require('./_github');

module.exports = async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { path } = req.query;
  if (!path) {
    return res.status(400).json({ error: 'Missing path query param' });
  }

  try {
    const filePath = path.startsWith('content/') ? path : `content/${path}`;
    const withMd = filePath.toLowerCase().endsWith('.md') ? filePath : `${filePath}.md`;
    let data = await getRepoFile(filePath);
    if (!data) data = await getRepoFile(withMd);

    if (!data) {
      return res.status(404).json({ error: 'File not found', path: filePath });
    }

    return res.status(200).json({
      path: data.path,
      content: data.content,
      success: true,
    });
  } catch (error) {
    return res.status(500).json({ error: 'Internal error', message: error.message });
  }
};
