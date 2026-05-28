const { getRepoTree, getRepoFile } = require('./_github');

function escapeHtml(text) {
  return String(text || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

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

    const sections = [];
    for (const item of files) {
      const data = await getRepoFile(item.path);
      if (!data) continue;
      sections.push(`<h2>${escapeHtml(item.path)}</h2>`);
      sections.push(`<pre>${escapeHtml(data.content)}</pre>`);
      sections.push('<hr>');
    }

    const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Nael Mind - Full Context</title>
  <meta name="description" content="Nael Mind personal knowledge system - all markdown content">
  <style>
    body { font-family: Inter, Geist, Roboto, sans-serif; background: #0d0d0f; color: #f4f1ea; margin: 0; padding: 20px; line-height: 1.6; }
    h1 { color: #d97954; border-bottom: 1px solid rgba(255,255,255,0.08); padding-bottom: 10px; }
    h2 { color: #b78b72; margin-top: 30px; }
    pre { background: rgba(255,255,255,0.04); padding: 16px; border-radius: 8px; overflow-x: auto; white-space: pre-wrap; word-wrap: break-word; font-size: 14px; border: 1px solid rgba(255,255,255,0.08); }
    hr { border: none; border-top: 1px solid rgba(255,255,255,0.08); margin: 30px 0; }
    a { color: #d97954; }
    .meta { color: #a8a299; font-size: 14px; margin-bottom: 20px; }
  </style>
</head>
<body>
  <h1>Nael Mind</h1>
  <div class="meta">Personal Knowledge System — ${files.length} files — Generated ${new Date().toISOString()}</div>
  ${sections.join('\n')}
</body>
</html>`;

    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.setHeader('Cache-Control', 'public, max-age=300');
    return res.status(200).send(html);
  } catch (error) {
    return res.status(500).json({ error: 'Internal error', message: error.message });
  }
};
