const { getRepoTree } = require('./_github');

function nameFromPath(path) {
  const parts = String(path || '').split('/').filter(Boolean);
  return parts.length ? parts[parts.length - 1] : '';
}

module.exports = async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const tree = await getRepoTree('main');
    const queryPath = (req.query.path || 'content').replace(/^\/+|\/+$/g, '');

    const items = tree
      .filter((item) => {
        if (!item.path.startsWith(queryPath)) return false;
        if (item.path === queryPath) return false;
        const rest = item.path.slice(queryPath.length).replace(/^\/+/, '');
        return rest && !rest.includes('/');
      })
      .map((item) => ({
        path: item.path,
        name: nameFromPath(item.path),
        type: item.type === 'tree' ? 'dir' : item.type === 'blob' ? 'file' : item.type,
        sha: item.sha,
        size: item.size || 0,
      }));

    return res.status(200).json({ files: items });
  } catch (error) {
    return res.status(500).json({ error: 'Internal error', message: error.message });
  }
};
