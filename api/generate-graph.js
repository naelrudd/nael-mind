const path = require('path');
const { getRepo, getRepoTree, getRepoFile, upsertRepoFile } = require('./_github');

function slugify(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '') || 'node';
}

function topLevelKey(path) {
  const parts = String(path || '').split('/').filter(Boolean);
  return parts[0] || 'root';
}

function stripExtension(filename) {
  return String(filename || '').replace(/\.md$/i, '').replace(/\.markdown$/i, '');
}

function extractHeadings(text) {
  const lines = String(text || '').split('\n');
  const headings = [];
  for (const line of lines) {
    const match = line.match(/^(#{1,4})\s+(.+)/);
    if (match) {
      headings.push({
        level: match[1].length,
        text: match[2].trim().replace(/^['"`]|['"`]$/g, ''),
      });
    }
  }
  return headings;
}

function extractFrontmatter(content) {
  const value = String(content || '').replace(/\r\n/g, '\n');
  const match = value.match(/^---\n([\s\S]*?)\n---\n?/);

  if (!match) {
    return { tags: [], body: value };
  }

  const tagsMatch = match[1].match(/tags:\s*\[(.*?)\]/i);
  const tags = tagsMatch
    ? tagsMatch[1].split(',').map((tag) => tag.trim().replace(/^['"]|['"]$/g, '')).filter(Boolean)
    : [];

  return {
    tags,
    body: value.slice(match[0].length),
  };
}

function extractWikiLinks(text) {
  const matches = [...String(text || '').matchAll(/\[\[([^\]]+)\]\]/g)];
  return matches.map((match) => match[1].split('|')[0].trim()).filter(Boolean);
}

function extractMarkdownLinks(text) {
  const matches = [...String(text || '').matchAll(/\[[^\]]*\]\(([^)]+)\)/g)];
  return matches.map((match) => match[1].trim()).filter(Boolean);
}

function resolveNotePath(raw, currentPath, pathSet, titleIndex) {
  const input = String(raw || '').trim().replace(/\\/g, '/').split('#')[0].split('?')[0];
  if (!input || /^https?:\/\//i.test(input) || input.startsWith('mailto:')) return null;

  const currentDir = path.posix.dirname(currentPath);
  const candidates = [];

  if (input.startsWith('/')) {
    candidates.push(`content${input}`);
  } else if (input.startsWith('content/')) {
    candidates.push(input);
  } else if (input.includes('/')) {
    candidates.push(path.posix.normalize(path.posix.join(currentDir, input)));
  } else {
    const titleHit = titleIndex.get(input.toLowerCase());
    if (titleHit) return titleHit;
    candidates.push(path.posix.normalize(path.posix.join(currentDir, input)));
    candidates.push(path.posix.normalize(path.posix.join(currentDir, `${input}.md`)));
    candidates.push(`content/${input}`);
    candidates.push(`content/${input}.md`);
  }

  for (const candidate of candidates) {
    const normalized = candidate.endsWith('.md') ? candidate : `${candidate}.md`;
    if (pathSet.has(normalized)) return normalized;
  }

  return null;
}

async function buildGraph(tree, repo) {
  const nodes = [];
  const links = [];
  const nodeMap = new Map();
  const communities = new Map();

  const ensureCommunity = (key) => {
    if (!communities.has(key)) {
      communities.set(key, communities.size);
    }
    return communities.get(key);
  };

  const addNode = (node) => {
    if (nodeMap.has(node.id)) return;
    nodeMap.set(node.id, true);
    nodes.push(node);
  };

  const addLink = (source, target, type = 'contains') => {
    const id = `${source}->${target}:${type}`;
    if (nodeMap.has(id)) return;
    nodeMap.set(id, true);
    links.push({ source, target, type });
  };

  addNode({
    id: 'content-root',
    label: 'content',
    file_type: 'root',
    type: 'root',
    community: 0,
    importance: 10,
    description: 'Content root',
  });

  const files = tree
    .filter((item) => item.type === 'blob')
    .filter((item) => item.path.startsWith('content/') && item.path.toLowerCase().endsWith('.md'))
    .filter((item) => !item.path.startsWith('content/_graph/'));

  const pathSet = new Set(files.map((item) => item.path));
  const titleIndex = new Map();
  const parsedFiles = [];

  for (const item of files) {
    const file = await getRepoFile(item.path);
    if (!file) continue;

    const { tags, body } = extractFrontmatter(file.content);
    const title = stripExtension(path.posix.basename(file.path));
    const noteId = `note:${slugify(file.path)}`;
    const note = {
      id: noteId,
      label: title,
      file_type: 'note',
      type: 'note',
      source_file: file.path,
      description: file.path,
      tags,
      community: ensureCommunity(topLevelKey(file.path)),
      importance: 5,
    };

    addNode(note);
    addLink('content-root', noteId, 'contains');
    titleIndex.set(title.toLowerCase(), file.path);
    parsedFiles.push({ ...note, body });

    const headings = extractHeadings(body);
    for (const h of headings) {
      const sectionId = `section:${slugify(file.path)}:${slugify(h.text)}`;
      addNode({
        id: sectionId,
        label: h.text.length > 40 ? h.text.slice(0, 40) + '...' : h.text,
        file_type: 'section',
        type: 'section',
        source_file: file.path,
        description: `${file.path} # ${h.text}`,
        community: ensureCommunity(topLevelKey(file.path)),
        importance: 4 - h.level * 0.5,
        level: h.level,
      });
      addLink(noteId, sectionId, 'contains');
    }

    for (const tag of tags) {
      const tagId = `tag:${slugify(tag)}`;
      addNode({
        id: tagId,
        label: `#${tag}`,
        file_type: 'tag',
        type: 'tag',
        source_file: tag,
        description: `Tag ${tag}`,
        community: ensureCommunity(`tag:${tag}`),
        importance: 2,
      });
      addLink(noteId, tagId, 'tag');
    }
  }

  for (const file of parsedFiles) {
    const linksFromNote = [
      ...extractWikiLinks(file.body),
      ...extractMarkdownLinks(file.body),
    ];

    for (const raw of linksFromNote) {
      const targetPath = resolveNotePath(raw, file.source_file, pathSet, titleIndex);
      if (!targetPath) continue;
      const targetId = `note:${slugify(targetPath)}`;
      if (targetId === file.id) continue;
      addLink(file.id, targetId, 'ref');
    }
  }

  return { nodes, links, files: parsedFiles };
}

async function callOpenAI(baseUrl, apiKey, model, prompt) {
  const response = await fetch(baseUrl, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model,
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.2,
      max_tokens: 4096,
    }),
  });
  if (!response.ok) return { error: response.status };
  const data = await response.json();
  const content = data?.choices?.[0]?.message?.content;
  return content ? { content } : { error: 500 };
}

async function callAI(prompt) {
  const model = process.env.GRAPH_MODEL || '';

  // Ordered fallback chains: try models in sequence, skip on 429/error.
  const opencodeKey = process.env.OPENCODE_API_KEY;
  const genfityKey = process.env.GENFITY_API_KEY;
  const googleKey = process.env.GOOGLE_API_KEY;

  const opencodeModels = model
    ? [model]
    : ['minimax-m2.5-free', 'big-pickle', 'nemotron-3-super-free',
       'mimo-v2-pro-free', 'deepseek-v4-flash-free', 'mimo-v2-omni-free', 'qwen3.6-plus-free'];

  // 1) OpenCode Zen — auto-fallback across free models
  if (opencodeKey) {
    for (const m of opencodeModels) {
      const result = await callOpenAI('https://opencode.ai/zen/v1/chat/completions', opencodeKey, m, prompt);
      if (result.content) return result.content;
    }
  }

  // 2) Genfity — auto-fallback across available models
  if (genfityKey) {
    const genfityModels = model
      ? [model]
      : ['genfity/claude-opus-4.6:free', 'genfity/gpt-5.5:free'];
    for (const m of genfityModels) {
      const result = await callOpenAI('https://ai.genfity.com/v1/chat/completions', genfityKey, m, prompt);
      if (result.content) return result.content;
    }
  }

  // 3) Google Gemini — fallback
  if (googleKey) {
    try {
      const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${encodeURIComponent(googleKey)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ role: 'user', parts: [{ text: prompt }] }],
          generationConfig: {
            temperature: 0.2,
            responseMimeType: 'application/json',
          },
        }),
      });
      if (response.ok) {
        const data = await response.json();
        const content = data?.candidates?.[0]?.content?.parts?.map((part) => part.text || '').join('');
        if (content) return content;
      }
    } catch (_) { }
  }

  return null;
}

async function enrichWithAI(graph) {
  const fileNodes = graph.nodes.filter((node) => node.type === 'note');
  const files = fileNodes.slice(0, 100).map((node) => ({
    path: node.source_file,
    title: node.label,
    tags: node.tags || [],
  }));

  if (!files.length) return graph;

  const prompt = [
    'You are clustering markdown notes from a personal knowledge base into communities.',
    'Return STRICT JSON only with this shape:',
    '{"communities":{"content/note.md":0},"links":[{"source":"content/note.md","target":"content/other.md","type":"related"}]}',
    'Rules:',
    '- Only use note paths from the provided list.',
    '- Communities must be small integers starting at 0.',
    '- Return at most 25 links.',
    '- Do not include markdown fences or commentary.',
    '',
    'Notes (path, title, tags):',
    JSON.stringify(files, null, 2),
  ].join('\n');

  const text = await callAI(prompt);
  if (!text) return graph;

  try {
    const cleaned = text.replace(/^```json?\s*/i, '').replace(/```\s*$/i, '').trim();
    const parsed = JSON.parse(cleaned);
    const communityMap = parsed.communities || {};
    const extraLinks = Array.isArray(parsed.links) ? parsed.links : [];
    const pathToId = new Map(graph.nodes.map((node) => [node.source_file || node.description, node.id]));
    const seenLinks = new Set(graph.links.map((link) => `${link.source}->${link.target}:${link.type || 'related'}`));

    const noteFileToCommunity = new Map();

    graph.nodes.forEach((node) => {
      if (node.type !== 'note') return;
      const path = node.source_file || node.description;
      if (communityMap[path] !== undefined) {
        node.community = Number(communityMap[path]) || 0;
        noteFileToCommunity.set(path, node.community);
      }
    });

    graph.nodes.forEach((node) => {
      if (node.type !== 'section') return;
      const path = node.source_file || node.description;
      if (noteFileToCommunity.has(path)) {
        node.community = noteFileToCommunity.get(path);
      }
    });

    extraLinks.forEach((link) => {
      const sourceId = pathToId.get(link?.source);
      const targetId = pathToId.get(link?.target);
      if (!sourceId || !targetId) return;
      const id = `${sourceId}->${targetId}:${link.type || 'related'}`;
      if (seenLinks.has(id)) return;
      seenLinks.add(id);
      graph.links.push({
        source: sourceId,
        target: targetId,
        type: link.type || 'related',
      });
    });
  } catch (error) {
    return graph;
  }

  return graph;
}

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const repo = getRepo();

  try {
    const tree = await getRepoTree('main');
    const baseGraph = await buildGraph(tree, repo);
    const graph = await enrichWithAI(baseGraph);
    const payload = {
      directed: false,
      multigraph: false,
      graph: {},
      nodes: graph.nodes,
      links: graph.links,
    };

    await upsertRepoFile('content/_graph/graph.json', JSON.stringify(payload, null, 2), 'chore: regenerate content graph');

    res.setHeader('Cache-Control', 'no-store');
    return res.status(200).json({
      success: true,
      repo,
      nodes: payload.nodes.length,
      links: payload.links.length,
      communities: new Set(payload.nodes.map((node) => node.community)).size,
    });
  } catch (error) {
    return res.status(500).json({ error: 'Internal error', message: error.message });
  }
};
