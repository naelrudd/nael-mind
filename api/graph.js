const { getRepoFile } = require('./_github');

module.exports = async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const file = await getRepoFile('content/_graph/graph.json');

    if (!file) {
      return res.status(404).json({ error: 'graph.json not found' });
    }

    const data = JSON.parse(file.content || '{}');
    res.setHeader('Cache-Control', 'no-store');
    return res.status(200).json(data);
  } catch (error) {
    return res.status(500).json({ error: 'Internal error', message: error.message });
  }
};
