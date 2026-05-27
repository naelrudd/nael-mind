const API_BASE = '';

const state = {
  currentFile: null,
  allFiles: [],
  isEditing: false,
};

const fileTreeEl = document.getElementById('file-tree');
const breadcrumbEl = document.getElementById('breadcrumb');
const fileTitleEl = document.getElementById('file-title');
const fileTagsEl = document.getElementById('file-tags');
const viewerEl = document.getElementById('viewer');
const editorEl = document.getElementById('editor');
const viewerContentEl = document.getElementById('viewer-content');
const previewContentEl = document.getElementById('preview-content');
const editFilenameEl = document.getElementById('edit-filename');
const editTagsEl = document.getElementById('edit-tags');
const editContentEl = document.getElementById('edit-content');
const toastEl = document.getElementById('toast');

function normalizeContentPath(path = '') {
  const value = String(path).trim().replace(/^\/+/, '').replace(/\/+$/, '');
  if (!value || value === 'content') return 'content';

  const parts = value.split('/');
  if (parts.some((part) => part === '.' || part === '..')) {
    throw new Error('Invalid path');
  }

  return value.startsWith('content/') ? value : `content/${value}`;
}

function toDisplayPath(path) {
  return normalizeContentPath(path).replace(/^content\/?/, '') || 'content';
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

function showToast(message, type = 'success') {
  toastEl.textContent = message;
  toastEl.className = `toast ${type}`;
  toastEl.style.display = 'block';
  clearTimeout(showToast._timer);
  showToast._timer = setTimeout(() => {
    toastEl.style.display = 'none';
  }, 2500);
}

function extractFrontmatter(content) {
  const match = content.match(/^---\n([\s\S]*?)\n---\n?/);
  if (!match) return { tags: [], cleanContent: content };

  const frontmatter = match[1];
  const tagsMatch = frontmatter.match(/tags:\s*\[(.*?)\]/i);
  const tags = tagsMatch
    ? tagsMatch[1].split(',').map((tag) => tag.trim().replace(/^['"]|['"]$/g, '')).filter(Boolean)
    : [];

  return {
    tags,
    cleanContent: content.replace(match[0], '').replace(/^\s+/, ''),
  };
}

function buildFrontmatter(tags) {
  if (!tags.length) return '';
  const tagLine = tags.map((tag) => `'${tag}'`).join(', ');
  return `---\ntags: [${tagLine}]\ndate: ${new Date().toISOString().slice(0, 10)}\n---\n\n`;
}

function parseMarkdown(md) {
  const normalized = String(md || '').replace(/\r\n/g, '\n');
  const lines = normalized.split('\n');
  const blocks = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    if (!line.trim()) {
      i += 1;
      continue;
    }

    if (line.startsWith('```')) {
      const codeLines = [];
      i += 1;
      while (i < lines.length && !lines[i].startsWith('```')) {
        codeLines.push(lines[i]);
        i += 1;
      }
      i += 1;
      blocks.push(`<pre><code>${escapeHtml(codeLines.join('\n'))}</code></pre>`);
      continue;
    }

    if (/^#{1,6}\s/.test(line)) {
      const level = line.match(/^#{1,6}/)[0].length;
      blocks.push(`<h${level}>${inlineMarkdown(line.slice(level + 1))}</h${level}>`);
      i += 1;
      continue;
    }

    if (/^>\s/.test(line)) {
      const quoteLines = [];
      while (i < lines.length && /^>\s/.test(lines[i])) {
        quoteLines.push(lines[i].replace(/^>\s?/, ''));
        i += 1;
      }
      blocks.push(`<blockquote>${inlineMarkdown(quoteLines.join(' '))}</blockquote>`);
      continue;
    }

    if (/^---$/.test(line.trim())) {
      blocks.push('<hr>');
      i += 1;
      continue;
    }

    if (/^\s*[-*]\s+/.test(line)) {
      const items = [];
      while (i < lines.length && /^\s*[-*]\s+/.test(lines[i])) {
        items.push(`<li>${inlineMarkdown(lines[i].replace(/^\s*[-*]\s+/, ''))}</li>`);
        i += 1;
      }
      blocks.push(`<ul>${items.join('')}</ul>`);
      continue;
    }

    if (/^\s*\d+\.\s+/.test(line)) {
      const items = [];
      while (i < lines.length && /^\s*\d+\.\s+/.test(lines[i])) {
        items.push(`<li>${inlineMarkdown(lines[i].replace(/^\s*\d+\.\s+/, ''))}</li>`);
        i += 1;
      }
      blocks.push(`<ol>${items.join('')}</ol>`);
      continue;
    }

    const paragraph = [];
    while (
      i < lines.length &&
      lines[i].trim() &&
      !/^#{1,6}\s/.test(lines[i]) &&
      !/^>\s/.test(lines[i]) &&
      !/^```/.test(lines[i]) &&
      !/^---$/.test(lines[i].trim()) &&
      !/^\s*[-*]\s+/.test(lines[i]) &&
      !/^\s*\d+\.\s+/.test(lines[i])
    ) {
      paragraph.push(lines[i]);
      i += 1;
    }
    blocks.push(`<p>${inlineMarkdown(paragraph.join(' '))}</p>`);
  }

  return blocks.join('\n');
}

function inlineMarkdown(text) {
  const escaped = escapeHtml(text);
  return escaped
    .replace(/\*\*\*(.+?)\*\*\*/g, '<strong><em>$1</em></strong>')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    .replace(/`(.+?)`/g, '<code>$1</code>')
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noreferrer">$1</a>');
}

async function apiList(path = 'content') {
  const response = await fetch(`${API_BASE}/api/list?path=${encodeURIComponent(path)}`);
  return response.json();
}

async function apiRead(filename) {
  const response = await fetch(`${API_BASE}/api/read?filename=${encodeURIComponent(filename)}`);
  return response.json();
}

async function apiUpdate(filename, content, commitMessage) {
  const response = await fetch(`${API_BASE}/api/update`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ filename, content, commit_message: commitMessage }),
  });
  return response.json();
}

async function apiDelete(filename, commitMessage) {
  const response = await fetch(`${API_BASE}/api/delete`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ filename, commit_message: commitMessage }),
  });
  return response.json();
}

async function fetchTree(path = 'content') {
  const data = await apiList(path);
  const files = Array.isArray(data.files) ? data.files : [];

  const nodes = [];
  for (const item of files) {
    if (item.type === 'dir') {
      nodes.push({ ...item, children: await fetchTree(item.path) });
    } else {
      nodes.push(item);
    }
  }

  return nodes;
}

function flattenTree(nodes, out = []) {
  nodes.forEach((node) => {
    out.push(node);
    if (node.children) flattenTree(node.children, out);
  });
  return out;
}

function renderBreadcrumb(path) {
  const display = toDisplayPath(path);
  breadcrumbEl.innerHTML = `<span>content/</span>${display === 'content' ? '' : display}`;
}

function renderFileTree(nodes, container = fileTreeEl) {
  container.innerHTML = '';

  nodes
    .slice()
    .sort((a, b) => a.type.localeCompare(b.type) || a.name.localeCompare(b.name))
    .forEach((node) => {
      if (node.type === 'dir') {
        const folderWrap = document.createElement('div');
        folderWrap.className = 'tree-folder-content';

        const header = document.createElement('div');
        header.className = 'tree-item tree-folder';
        header.innerHTML = `<span class="icon">📁</span>${node.name}`;

        const children = document.createElement('div');
        children.className = 'folder-content';
        children.style.display = 'block';

        header.addEventListener('click', () => {
          children.style.display = children.style.display === 'none' ? 'block' : 'none';
        });

        folderWrap.appendChild(header);
        folderWrap.appendChild(children);
        container.appendChild(folderWrap);

        renderFileTree(node.children || [], children);
        return;
      }

      const fileEl = document.createElement('div');
      fileEl.className = 'tree-item';
      fileEl.dataset.path = node.path;
      fileEl.innerHTML = `<span class="icon">📄</span>${node.name}`;
      fileEl.addEventListener('click', () => loadFile(node.path));

      if (state.currentFile === node.path) {
        fileEl.classList.add('active');
      }

      container.appendChild(fileEl);
    });
}

function updateToolbar() {
  document.getElementById('btn-edit').style.display = state.isEditing ? 'none' : 'inline-flex';
  document.getElementById('btn-delete').style.display = state.isEditing ? 'none' : 'inline-flex';
  document.getElementById('btn-save').style.display = state.isEditing ? 'inline-flex' : 'none';
  document.getElementById('btn-cancel').style.display = state.isEditing ? 'inline-flex' : 'none';
}

async function refreshFileTree() {
  fileTreeEl.innerHTML = '<p class="empty-state">Loading...</p>';
  const tree = await fetchTree('content');
  state.allFiles = flattenTree(tree, []).filter((node) => node.type === 'file');
  renderFileTree(tree);
}

async function loadFile(path) {
  const filePath = normalizeContentPath(path);
  state.currentFile = filePath;
  state.isEditing = false;

  document.querySelectorAll('.tree-item').forEach((el) => el.classList.remove('active'));
  document.querySelector(`[data-path="${filePath}"]`)?.classList.add('active');

  renderBreadcrumb(filePath);

  try {
    const data = await apiRead(filePath);
    if (data.error) {
      showToast(data.error, 'error');
      return;
    }

    const { tags, cleanContent } = extractFrontmatter(data.content || '');

    fileTitleEl.textContent = toDisplayPath(filePath).split('/').pop();
    fileTagsEl.innerHTML = tags.map((tag) => `<span class="tag">${escapeHtml(tag)}</span>`).join('');
    viewerContentEl.innerHTML = parseMarkdown(cleanContent);
    editFilenameEl.value = toDisplayPath(filePath);
    editTagsEl.value = tags.join(', ');
    editContentEl.value = data.content || '';

    viewerEl.style.display = 'block';
    editorEl.style.display = 'none';
    updateToolbar();
  } catch (error) {
    showToast('Failed to load file', 'error');
  }
}

function startEdit() {
  if (!state.currentFile) {
    showToast('Select a file first', 'error');
    return;
  }

  state.isEditing = true;
  viewerEl.style.display = 'none';
  editorEl.style.display = 'flex';
  updateToolbar();
  updatePreview();
}

function updatePreview() {
  const { cleanContent } = extractFrontmatter(editContentEl.value || '');
  previewContentEl.innerHTML = parseMarkdown(cleanContent);
}

async function saveFile() {
  const filenameInput = editFilenameEl.value.trim();
  if (!filenameInput) {
    showToast('Filename required', 'error');
    return;
  }

  const filename = normalizeContentPath(filenameInput);
  const tags = editTagsEl.value.split(',').map((tag) => tag.trim()).filter(Boolean);
  const rawContent = editContentEl.value.replace(/^---\n[\s\S]*?\n---\n?/, '');
  const fullContent = buildFrontmatter(tags) + rawContent.replace(/^\n+/, '');

  try {
    const result = await apiUpdate(filename, fullContent, state.currentFile ? `update: ${filename}` : `add: ${filename}`);
    if (result.success) {
      showToast('Saved successfully');
      state.currentFile = filename;
      state.isEditing = false;
      await refreshFileTree();
      await loadFile(filename);
    } else {
      showToast(result.error || 'Save failed', 'error');
    }
  } catch (error) {
    showToast('Save failed', 'error');
  }
}

function cancelEdit() {
  if (state.currentFile) {
    loadFile(state.currentFile);
    return;
  }

  state.isEditing = false;
  viewerEl.style.display = 'block';
  editorEl.style.display = 'none';
  updateToolbar();
}

function confirmDelete() {
  if (!state.currentFile) {
    showToast('Select a file first', 'error');
    return;
  }

  document.getElementById('delete-filename').textContent = state.currentFile;
  document.getElementById('delete-modal').style.display = 'flex';
}

async function doDelete() {
  try {
    const result = await apiDelete(state.currentFile, `delete: ${state.currentFile}`);
    if (result.success) {
      showToast('Deleted successfully');
      state.currentFile = null;
      document.getElementById('delete-modal').style.display = 'none';
      await refreshFileTree();
      fileTitleEl.textContent = 'Select a file';
      fileTagsEl.innerHTML = '';
      viewerContentEl.innerHTML = '<p class="empty-state">Select a file from the sidebar to view</p>';
      breadcrumbEl.innerHTML = '<span>content/</span>';
    } else {
      showToast(result.error || 'Delete failed', 'error');
    }
  } catch (error) {
    showToast('Delete failed', 'error');
  }
}

function startNewFile() {
  state.currentFile = null;
  state.isEditing = true;

  editFilenameEl.value = '';
  editTagsEl.value = '';
  editContentEl.value = '# New Note\n\n';

  viewerEl.style.display = 'none';
  editorEl.style.display = 'flex';
  breadcrumbEl.innerHTML = '<span>content/</span>new-file.md';
  fileTitleEl.textContent = 'New file';
  fileTagsEl.innerHTML = '';
  updateToolbar();
  updatePreview();
}

async function handleUpload() {
  const input = document.getElementById('file-upload');
  const files = input.files;
  if (!files.length) return;

  for (const file of Array.from(files)) {
    const content = await file.text();
    const filename = normalizeContentPath(`content/${file.name}`);
    const result = await apiUpdate(filename, content, `add: ${file.name}`);
    if (!result.success) {
      showToast(`Failed: ${file.name}`, 'error');
    }
  }

  document.getElementById('upload-modal').style.display = 'none';
  await refreshFileTree();
  showToast('Upload complete');
}

function searchFiles(query) {
  const q = String(query || '').trim().toLowerCase();
  if (!q) {
    refreshFileTree();
    return;
  }

  const results = state.allFiles.filter((file) => file.name.toLowerCase().includes(q) || file.path.toLowerCase().includes(q));
  fileTreeEl.innerHTML = '';

  results.forEach((file) => {
    const item = document.createElement('div');
    item.className = 'tree-item';
    item.dataset.path = file.path;
    item.innerHTML = `<span class="icon">📄</span>${file.name}`;
    item.addEventListener('click', () => loadFile(file.path));
    fileTreeEl.appendChild(item);
  });
}

function filterByTag(tag) {
  showToast(`Filter by tag: ${tag} (not implemented yet)`);
}

document.addEventListener('DOMContentLoaded', async () => {
  await refreshFileTree();
  updateToolbar();

  document.getElementById('btn-new-file').addEventListener('click', startNewFile);
  document.getElementById('btn-edit').addEventListener('click', startEdit);
  document.getElementById('btn-save').addEventListener('click', saveFile);
  document.getElementById('btn-cancel').addEventListener('click', cancelEdit);
  document.getElementById('btn-delete').addEventListener('click', confirmDelete);

  document.getElementById('btn-upload').addEventListener('click', () => {
    document.getElementById('upload-modal').style.display = 'flex';
  });
  document.getElementById('btn-upload-cancel').addEventListener('click', () => {
    document.getElementById('upload-modal').style.display = 'none';
  });
  document.getElementById('btn-upload-confirm').addEventListener('click', handleUpload);

  document.getElementById('btn-delete-cancel').addEventListener('click', () => {
    document.getElementById('delete-modal').style.display = 'none';
  });
  document.getElementById('btn-delete-confirm').addEventListener('click', doDelete);

  editContentEl.addEventListener('input', updatePreview);

  document.querySelectorAll('.modal').forEach((modal) => {
    modal.addEventListener('click', (event) => {
      if (event.target === modal) modal.style.display = 'none';
    });
  });

  document.querySelectorAll('.nav-btn').forEach((btn) => {
    btn.addEventListener('click', async () => {
      document.querySelectorAll('.nav-btn').forEach((el) => el.classList.remove('active'));
      btn.classList.add('active');

      const view = btn.dataset.view;
      if (view === 'files') {
        await refreshFileTree();
      } else if (view === 'search') {
        const query = prompt('Search filename or path');
        if (query !== null) searchFiles(query);
      } else if (view === 'tags') {
        const tag = prompt('Filter by tag');
        if (tag !== null) filterByTag(tag);
      }
    });
  });
});
