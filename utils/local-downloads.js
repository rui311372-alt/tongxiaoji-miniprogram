// Persistent files belong to this mini-program's local user directory.
const store = require('./store');
const files = require('./files');
const types = files.documentTypes.concat('txt');
function directory() {
  if (!wx.env || !wx.env.USER_DATA_PATH) throw new Error('无法取得本机文件目录，请重新打开小程序。');
  return wx.env.USER_DATA_PATH + '/txj-download-';
}
function managed(path) {
  if (typeof path !== 'string') return false;
  const prefix = directory();
  return path.indexOf(prefix) === 0 && /^[a-z0-9-]+\.(txt|pdf|doc|docx|xls|xlsx|ppt|pptx)$/.test(path.slice(prefix.length));
}
function key(item) { return 'txj.download.v1.' + item.school_id + ':' + item.id; }
function getSaved(item) {
  const row = store.read(key(item), null);
  if (row === null) return null;
  if (typeof row !== 'object' || row.resourceId !== item.id || row.schoolId !== item.school_id || !managed(row.path) || !types.includes(row.type) || !row.path.endsWith('.' + row.type) || !Number.isInteger(row.size) || row.size < 1 || row.size > files.MAX_BYTES || typeof row.name !== 'string' || !row.name || row.name.length > 200) throw new Error('本机下载记录格式异常，请稍后重试。');
  return Object.assign({}, row);
}
function invoke(action, options, message) {
  return new Promise((resolve, reject) => {
    try { action(Object.assign({}, options, { success: resolve, fail: () => reject(new Error(message)) })); }
    catch (error) { reject(new Error(message)); }
  });
}
function info(path) { return invoke(options => wx.getFileSystemManager().getFileInfo(options), { filePath: path }, '本机文件无法读取，请重新下载。'); }
async function remove(path) {
  if (!managed(path)) return;
  try { await invoke(options => wx.getFileSystemManager().unlink(options), { filePath: path }, '文件清理失败'); } catch (error) {}
}
async function save(item, type, name, write, active) {
  const previous = getSaved(item);
  const path = directory() + Date.now() + '-' + Math.random().toString(36).slice(2, 12) + '.' + type;
  let committed = false;
  try {
    await write(path);
    const measured = await info(path);
    if (!Number.isInteger(measured.size) || measured.size < 1 || measured.size > files.MAX_BYTES) throw new Error('保存的文件不完整或超过 5MB，请重试。');
    if (active && !active()) throw new Error('页面已关闭，下载未保存。');
    const saved = { resourceId: item.id, schoolId: item.school_id, path, name, type, size: measured.size, savedAt: Date.now() };
    store.write(key(item), saved);
    committed = true;
    if (previous && previous.path !== path) await remove(previous.path);
    return saved;
  } catch (error) {
    if (!committed) await remove(path);
    throw error;
  }
}
function saveText(item, active) {
  if (!item || typeof item.body !== 'string' || !item.body.trim()) return Promise.reject(new Error('这份资料没有文字正文，请下载资料文件。'));
  const name = String(item.title || '学习资料').replace(/[\\/:*?"<>|\x00-\x1f]/g, '-').slice(0, 70) + '.txt';
  const content = item.title + '\n\n' + item.body;
  return save(item, 'txt', name, async path => {
    await invoke(options => wx.getFileSystemManager().writeFile(options), { filePath: path, data: content, encoding: 'utf8' }, '下载保存失败，请释放本机空间后重试。');
    const result = await invoke(options => wx.getFileSystemManager().readFile(options), { filePath: path, encoding: 'utf8' }, '保存后的文件无法读取，请重试。');
    if (result.data !== content) throw new Error('保存的文字内容不完整，请重新下载。');
  }, active);
}
async function saveAttachment(item, active) {
  const attachment = files.validateSavedAttachment(item.attachment);
  const measured = await info(attachment.path);
  if (measured.size !== attachment.size) throw new Error('原资料文件已丢失或不完整，暂时无法下载。');
  return save(item, attachment.type, attachment.name, async path => {
    await invoke(options => wx.getFileSystemManager().copyFile(options), { srcPath: attachment.path, destPath: path }, '资料下载保存失败，请释放本机空间后重试。');
    const copied = await info(path);
    if (copied.size !== attachment.size) throw new Error('下载文件不完整，请重新下载。');
  }, active);
}
async function openSaved(item, active) {
  const saved = getSaved(item);
  if (!saved) throw new Error('这份资料还没有本机下载，请先下载。');
  const measured = await info(saved.path);
  if (measured.size !== saved.size) throw new Error('本机下载文件已丢失或不完整，请重新下载。');
  if (active && !active()) return null;
  if (saved.type === 'txt') {
    const result = await invoke(options => wx.getFileSystemManager().readFile(options), { filePath: saved.path, encoding: 'utf8' }, '本机文字文件无法读取，请重新下载。');
    return { name: saved.name, text: result.data };
  }
  await invoke(options => wx.openDocument(options), { filePath: saved.path, fileType: saved.type, showMenu: true }, '当前设备无法预览该文件，下载仍保存在小程序本机空间。');
  return null;
}
module.exports = { getSaved, saveText, saveAttachment, openSaved };
