const { getRepoTree, getRepoFile } = require('./_github');

module.exports = async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { file } = req.query;

  try {
    // If specific file requested, return just that file as plain text
    if (file) {
      const path = file.startsWith('content/') ? file : `content/${file}`;
      const data = await getRepoFile(path);
      if (!data) {
        return res.status(404).json({ error: 'File not found' });
      }
      res.setHeader('Content-Type', 'text/plain; charset=utf-8');
      return res.status(200).send(data.content);
    }

    // Otherwise return full context: all markdown files concatenated
    const tree = await getRepoTree('main');
    const files = tree
      .filter((item) => item.type === 'blob')
      .filter((item) => item.path.startsWith('content/') && item.path.toLowerCase().endsWith('.md'))
      .filter((item) => !item.path.startsWith('content/_graph/'));

    const sections = [];
    sections.push('# Nael Mind - Personal Knowledge System');
    sections.push(`Generated: ${new Date().toISOString()}`);
    sections.push(`Total files: ${files.length}`);
    sections.push('');
    sections.push('---');
    sections.push('');

    for (const item of files) {
      const data = await getRepoFile(item.path);
      if (!data) continue;
      sections.push(`## ${item.path}`);
      sections.push('');
      sections.push(data.content);
      sections.push('');
      sections.push('---');
      sections.push('');
    }

    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    res.setHeader('Cache-Control', 'public, max-age=300');
    return res.status(200).send(sections.join('\n'));
  } catch (error) {
    return res.status(500).json({ error: 'Internal error', message: error.message });
  }
};
