const API_BASE = '';

const state = {
  currentFile: null,
  allFiles: [],
  isEditing: false,
  currentFolder: 'content',
  createFolder: 'content',
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
const folderContextEl = document.getElementById('folder-context');
const createModalEl = document.getElementById('create-modal');
const createFolderFilterEl = document.getElementById('create-folder-filter');
const createFolderSelectEl = document.getElementById('create-folder-select');
const createFolderInputEl = document.getElementById('create-folder-input');
const createFilenameInputEl = document.getElementById('create-filename-input');
const createFolderNameInputEl = document.getElementById('create-folder-name-input');
const createFolderBtnEl = document.getElementById('btn-create-folder');
const folderDeleteBtnEl = document.getElementById('btn-folder-delete');
const createPathPreviewEl = document.getElementById('create-path-preview');
const moveModalEl = document.getElementById('move-modal');
const moveFolderSelectEl = document.getElementById('move-folder-select');
const moveFolderInputEl = document.getElementById('move-folder-input');
const moveFilenameInputEl = document.getElementById('move-filename-input');
const movePathPreviewEl = document.getElementById('move-path-preview');
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

function folderFromFilePath(path) {
  const normalized = normalizeContentPath(path);
  if (normalized === 'content') return 'content';
  const parts = normalized.split('/');
  parts.pop();
  return parts.join('/') || 'content';
}

function fileNameFromPath(path) {
  const normalized = normalizeContentPath(path);
  if (normalized === 'content') return '';
  return normalized.split('/').pop();
}

function uniqueFolders(files) {
  const folders = new Set(['content']);
  files.forEach((file) => {
    const normalized = normalizeContentPath(file.path);
    let current = folderFromFilePath(normalized);
    while (current && current !== 'content') {
      folders.add(current);
      current = folderFromFilePath(current);
      if (current === 'content') {
        folders.add('content');
        break;
      }
    }
    folders.add(folderFromFilePath(normalized));
  });
  return Array.from(folders).sort();
}

function filterFolders(query) {
  const q = String(query || '').trim().toLowerCase();
  const folders = uniqueFolders(state.allFiles);
  if (!q) return folders;
  return folders.filter((folder) => folder.toLowerCase().includes(q));
}

function buildCreateTarget() {
  const parent = normalizeContentPath(createFolderSelectEl.value || state.createFolder || 'content');
  const subfolder = String(createFolderInputEl.value || '').trim().replace(/^\/+|\/+$/g, '');
  const filename = String(createFilenameInputEl.value || '').trim().replace(/^\/+/, '');

  if (!filename) {
    return { path: '', error: 'Filename required' };
  }

  if (!filename.toLowerCase().endsWith('.md')) {
    return { path: '', error: 'Filename must end with .md' };
  }

  const finalFolder = [parent, subfolder].filter(Boolean).join('/').replace(/\/+/g, '/');
  const normalizedFolder = normalizeContentPath(finalFolder || 'content');
  const finalPath = normalizedFolder === 'content' ? `content/${filename}` : `${normalizedFolder}/${filename}`;

  return { path: normalizeContentPath(finalPath), folder: normalizedFolder };
}

function updateCreatePreview() {
  const result = buildCreateTarget();
  createPathPreviewEl.textContent = result.error ? `Target: ${result.error}` : `Target: ${result.path}`;
}

function syncFolderContext(folder) {
  const normalized = normalizeContentPath(folder || 'content');
  state.currentFolder = normalized;
  updateFolderBar();
}

function updateFolderBar() {
  if (!folderContextEl) {
    return;
  }

  const display = toDisplayPath(state.currentFolder);
  folderContextEl.textContent = display === 'content' ? 'Folder: content' : `Folder: content/${display}`;
}

function openCreateModal(folder = state.currentFolder) {
  state.createFolder = normalizeContentPath(folder || 'content');
  renderCreateFolderOptions();
  createFolderSelectEl.value = state.createFolder;
  createFolderFilterEl.value = '';
  createFolderInputEl.value = '';
  createFilenameInputEl.value = '';
  createFolderNameInputEl.value = '';
  updateCreatePreview();
  createModalEl.style.display = 'flex';
}

function closeCreateModal() {
  createModalEl.style.display = 'none';
}

function renderCreateFolderOptions(query = '') {
  const folders = filterFolders(query);
  createFolderSelectEl.innerHTML = folders.map((folder) => `<option value="${folder}">${folder}</option>`).join('');
  if (!folders.includes(state.createFolder)) {
    const option = document.createElement('option');
    option.value = state.createFolder;
    option.textContent = state.createFolder;
    createFolderSelectEl.appendChild(option);
  }
  createFolderSelectEl.value = state.createFolder;
}

function renderMoveFolderOptions(query = '') {
  const folders = filterFolders(query);
  moveFolderSelectEl.innerHTML = folders.map((folder) => `<option value="${folder}">${folder}</option>`).join('');
  moveFolderSelectEl.value = state.currentFolder;
}

function updateMovePreview() {
  const folder = normalizeContentPath(moveFolderSelectEl.value || state.currentFolder || 'content');
  const subfolder = String(moveFolderInputEl.value || '').trim().replace(/^\/+|\/+$/g, '');
  const filename = String(moveFilenameInputEl.value || '').trim();
  const finalFolder = [folder, subfolder].filter(Boolean).join('/').replace(/\/+/g, '/');
  const normalizedFolder = normalizeContentPath(finalFolder || 'content');
  const target = filename ? (normalizedFolder === 'content' ? `content/${filename}` : `${normalizedFolder}/${filename}`) : `${normalizedFolder}/`;
  movePathPreviewEl.textContent = `Target: ${target}`;
}

function openMoveModal(targetFolder = state.currentFolder) {
  if (!state.currentFile) {
    showToast('Select a file first', 'error');
    return;
  }

  renderMoveFolderOptions();
  moveFolderSelectEl.value = normalizeContentPath(targetFolder || 'content');
  moveFolderInputEl.value = '';
  moveFilenameInputEl.value = fileNameFromPath(state.currentFile);
  updateMovePreview();
  moveModalEl.style.display = 'flex';
}

function closeMoveModal() {
  moveModalEl.style.display = 'none';
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

function collectCreateFolderOptions() {
  renderCreateFolderOptions(createFolderFilterEl?.value || '');
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
        header.dataset.folder = node.path;

        const children = document.createElement('div');
        children.className = 'folder-content';
        children.style.display = 'block';

        header.addEventListener('click', () => {
          state.currentFolder = node.path;
          updateFolderBar();
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
  collectCreateFolderOptions();
}

async function loadFile(path) {
  const filePath = normalizeContentPath(path);
  state.currentFile = filePath;
  state.isEditing = false;
  syncFolderContext(folderFromFilePath(filePath));

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

  const baseFolder = state.currentFile ? folderFromFilePath(state.currentFile) : state.currentFolder;
  const filename = normalizeContentPath(filenameInput.includes('/') ? filenameInput : `${baseFolder}/${filenameInput}`);
  const tags = editTagsEl.value.split(',').map((tag) => tag.trim()).filter(Boolean);
  const rawContent = editContentEl.value.replace(/^---\n[\s\S]*?\n---\n?/, '');
  const fullContent = buildFrontmatter(tags) + rawContent.replace(/^\n+/, '');

  try {
    const result = await apiUpdate(filename, fullContent, state.currentFile ? `update: ${filename}` : `add: ${filename}`);
    if (result.success) {
      showToast('Saved successfully');
      state.currentFile = filename;
      state.isEditing = false;
      syncFolderContext(folderFromFilePath(filename));
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
  openCreateModal(state.currentFolder);
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

async function handleCreateFile() {
  const result = buildCreateTarget();
  if (result.error) {
    showToast(result.error, 'error');
    return;
  }

  syncFolderContext(result.folder);
  state.currentFile = null;
  state.isEditing = true;
  editFilenameEl.value = fileNameFromPath(result.path);
  editTagsEl.value = '';
  editContentEl.value = '# New Note\n\n';
  breadcrumbEl.innerHTML = `<span>content/</span>${toDisplayPath(result.folder) === 'content' ? '' : toDisplayPath(result.folder)}`;
  viewerEl.style.display = 'none';
  editorEl.style.display = 'flex';
  updateToolbar();
  updatePreview();
  closeCreateModal();
}

async function handleCreateFolder() {
  const parent = normalizeContentPath(createFolderSelectEl.value || state.createFolder || 'content');
  const name = String(createFolderNameInputEl.value || '').trim().replace(/^\/+|\/+$/g, '');

  if (!name) {
    showToast('Folder name required', 'error');
    return;
  }

  if (name.includes('.')) {
    showToast('Folder name should not contain dots', 'error');
    return;
  }

  const targetFolder = parent === 'content' ? `content/${name}` : `${parent}/${name}`;
  const placeholderFile = `${normalizeContentPath(targetFolder)}/.keep`;
  const result = await apiUpdate(placeholderFile, '# folder placeholder\n', `create folder: ${targetFolder}`);

  if (!result.success) {
    showToast(result.error || 'Failed to create folder', 'error');
    return;
  }

  createFolderNameInputEl.value = '';
  showToast(`Folder created: ${targetFolder}`);
  await refreshFileTree();
  state.createFolder = normalizeContentPath(targetFolder);
  renderCreateFolderOptions(createFolderFilterEl.value || '');
  createFolderSelectEl.value = state.createFolder;
  updateCreatePreview();
}

async function handleDeleteFolder() {
  const target = normalizeContentPath(createFolderSelectEl.value || state.createFolder || 'content');
  if (target === 'content') {
    showToast('Cannot delete content root', 'error');
    return;
  }

  const filesInFolder = state.allFiles.filter((file) => folderFromFilePath(file.path) === target || file.path.startsWith(`${target}/`));
  if (filesInFolder.length > 1 || (filesInFolder.length === 1 && fileNameFromPath(filesInFolder[0].path) !== '.keep')) {
    showToast('Folder is not empty', 'error');
    return;
  }

  const placeholder = filesInFolder.find((file) => file.path.endsWith('/.keep'));
  if (!placeholder) {
    showToast('No placeholder found for folder', 'error');
    return;
  }

  const result = await apiDelete(placeholder.path, `delete folder placeholder: ${target}`);
  if (!result.success) {
    showToast(result.error || 'Failed to delete folder', 'error');
    return;
  }

  showToast(`Folder deleted: ${target}`);
  await refreshFileTree();
  state.createFolder = 'content';
  renderCreateFolderOptions(createFolderFilterEl.value || '');
  createFolderSelectEl.value = state.createFolder;
  updateCreatePreview();
}

async function handleMoveFile() {
  if (!state.currentFile) {
    showToast('Select a file first', 'error');
    return;
  }

  const folder = normalizeContentPath(moveFolderSelectEl.value || state.currentFolder || 'content');
  const subfolder = String(moveFolderInputEl.value || '').trim().replace(/^\/+|\/+$/g, '');
  const filename = String(moveFilenameInputEl.value || '').trim();
  if (!filename) {
    showToast('Filename required', 'error');
    return;
  }

  const finalFolder = [folder, subfolder].filter(Boolean).join('/').replace(/\/+/g, '/');
  const targetPath = normalizeContentPath(finalFolder === 'content' ? `content/${filename}` : `${finalFolder}/${filename}`);
  if (targetPath === state.currentFile) {
    showToast('Nothing changed', 'error');
    return;
  }

  const readRes = await fetch(`${API_BASE}/api/read?filename=${encodeURIComponent(state.currentFile)}`);
  const readData = await readRes.json();
  if (!readRes.ok) {
    showToast(readData.error || 'Failed to read file', 'error');
    return;
  }

  const saveRes = await apiUpdate(targetPath, readData.content, `move: ${state.currentFile} -> ${targetPath}`);
  if (!saveRes.success) {
    showToast(saveRes.error || 'Failed to move file', 'error');
    return;
  }

  await apiDelete(state.currentFile, `remove old after move: ${state.currentFile}`);
  state.currentFile = targetPath;
  syncFolderContext(folderFromFilePath(targetPath));
  await refreshFileTree();
  await loadFile(targetPath);
  closeMoveModal();
  showToast(`Moved to ${targetPath}`);
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

  document.getElementById('btn-edit').addEventListener('click', startEdit);
  document.getElementById('btn-save').addEventListener('click', saveFile);
  document.getElementById('btn-cancel').addEventListener('click', cancelEdit);
  document.getElementById('btn-delete').addEventListener('click', confirmDelete);
  document.getElementById('btn-move-selected-folder').addEventListener('click', () => openMoveModal(state.currentFolder));
  document.getElementById('btn-new-file-here').addEventListener('click', () => openCreateModal(state.currentFolder));

  document.getElementById('btn-upload').addEventListener('click', () => {
    document.getElementById('upload-modal').style.display = 'flex';
  });
  document.getElementById('btn-upload-cancel').addEventListener('click', () => {
    document.getElementById('upload-modal').style.display = 'none';
  });
  document.getElementById('btn-upload-confirm').addEventListener('click', handleUpload);
  document.getElementById('btn-create-cancel').addEventListener('click', closeCreateModal);
  document.getElementById('btn-create-confirm').addEventListener('click', handleCreateFile);
  createFolderFilterEl.addEventListener('input', () => renderCreateFolderOptions(createFolderFilterEl.value));
  createFolderSelectEl.addEventListener('change', () => {
    state.createFolder = normalizeContentPath(createFolderSelectEl.value || 'content');
    updateCreatePreview();
  });
  createFolderInputEl.addEventListener('input', updateCreatePreview);
  createFilenameInputEl.addEventListener('input', updateCreatePreview);
  createFolderNameInputEl.addEventListener('input', updateCreatePreview);
  createFolderBtnEl.addEventListener('click', handleCreateFolder);
  folderDeleteBtnEl.addEventListener('click', handleDeleteFolder);

  document.getElementById('btn-move-cancel').addEventListener('click', closeMoveModal);
  document.getElementById('btn-move-confirm').addEventListener('click', handleMoveFile);
  moveFolderSelectEl.addEventListener('change', updateMovePreview);
  moveFolderInputEl.addEventListener('input', updateMovePreview);
  moveFilenameInputEl.addEventListener('input', updateMovePreview);

  document.getElementById('btn-new-file').addEventListener('click', () => openCreateModal(state.currentFolder));

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
