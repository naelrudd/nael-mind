const { getRepoTree, getRepoFile } = require('./_github');

module.exports = async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const tree = await getRepoTree('main');
    const files = tree
      .filter((item) => item.type === 'blob')
      .filter((item) => item.path.startsWith('content/') && item.path.toLowerCase().endsWith('.md'))
      .filter((item) => !item.path.startsWith('content/_graph/'));

    const allContent = [];
    for (const item of files) {
      const data = await getRepoFile(item.path);
      if (!data) continue;
      allContent.push({
        path: data.path,
        content: data.content,
      });
    }

    return res.status(200).json({
      total: allContent.length,
      files: allContent,
    });
  } catch (error) {
    return res.status(500).json({ error: 'Internal error', message: error.message });
  }
};
