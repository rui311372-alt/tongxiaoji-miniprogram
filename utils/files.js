// 本项目仅在微信沙箱中保留课堂附件；绝不删除其他应用或用户路径。
const MAX_BYTES = 5 * 1024 * 1024;
const documentTypes = ['pdf', 'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx'];
const imageTypes = ['jpg', 'png', 'webp'];
function problem(message) { return new Error(message); }
function base() {
  if (!wx.env || typeof wx.env.USER_DATA_PATH !== 'string' || !wx.env.USER_DATA_PATH) throw problem('无法取得本机文件目录，请重新打开小程序。');
  return wx.env.USER_DATA_PATH + '/txj-content-';
}
function isManaged(path) {
  if (typeof path !== 'string' || !wx.env || typeof wx.env.USER_DATA_PATH !== 'string') return false;
  const prefix = wx.env.USER_DATA_PATH + '/txj-content-';
  return path.indexOf(prefix) === 0 && /^(image|attachment)-[a-z0-9-]+\.(jpg|png|webp|pdf|doc|docx|xls|xlsx|ppt|pptx)$/.test(path.slice(prefix.length));
}
function isPhotoPath(path) { return isManaged(path) && /^image-/.test(path.slice(base().length)) && /\.(jpg|png|webp)$/.test(path); }
function cancel(error) { return error && /cancel/i.test(error.errMsg || error.message || ''); }
function invoke(fn, options, label) {
  return new Promise((resolve, reject) => {
    try { fn(Object.assign({}, options, { success: resolve, fail: error => reject(problem(label + (error && error.errMsg ? '（' + error.errMsg + '）' : ''))) })); }
    catch (error) { reject(problem(label)); }
  });
}
function info(path) {
  return invoke(options => wx.getFileSystemManager().getFileInfo(options), { filePath: path }, '文件无法读取，请重新选择。');
}
function checkSize(size) { if (!Number.isInteger(size) || size < 1 || size > MAX_BYTES) throw problem('文件需大于 0 字节，且不超过 5MB。'); return size; }
function extension(name) { return String(name || '').split('.').pop().toLowerCase(); }
function validateSavedAttachment(value) {
  if (!value || typeof value !== 'object' || !isManaged(value.path) || value.path.indexOf(base() + 'attachment-') !== 0) throw problem('资料文件尚未保存，请重新选择。');
  const type = String(value.type || '').toLowerCase();
  if (documentTypes.indexOf(type) < 0 || extension(value.path) !== type || extension(value.name) !== type) throw problem('资料文件格式仅支持 PDF、Word、Excel、PPT。');
  if (typeof value.name !== 'string' || !value.name.trim() || value.name.length > 200 || /[\x00-\x1f\x7f\\/]/.test(value.name)) throw problem('资料文件名不正确，请重命名后选择。');
  return { name: value.name, path: value.path, size: checkSize(value.size), type };
}
async function chooseAttachment() {
  let chosen;
  try {
    chosen = await new Promise((resolve, reject) => wx.chooseMessageFile({ count: 1, type: 'file', extension: documentTypes, success: resolve, fail: error => cancel(error) ? resolve(null) : reject(problem('未能选择资料文件，请重试。')) }));
  } catch (error) { throw problem(error.message || '当前微信不支持选择资料文件，请更新微信后重试。'); }
  if (!chosen) return null;
  const file = chosen.tempFiles && chosen.tempFiles[0];
  if (!file || typeof file.path !== 'string' || !file.path) throw problem('选择的资料无法读取，请重试。');
  const name = String(file.name || '').split(/[\\/]/).pop();
  const type = extension(name);
  if (documentTypes.indexOf(type) < 0 || name.length > 200 || !name) throw problem('请选择 PDF、Word、Excel 或 PPT，且文件名不超过 200 字。');
  const measured = await info(file.path);
  return { kind: 'attachment', tempPath: file.path, name, type, size: checkSize(measured.size) };
}
async function choosePhoto() {
  let chosen;
  try {
    chosen = await new Promise((resolve, reject) => wx.chooseMedia({ count: 1, mediaType: ['image'], sourceType: ['album', 'camera'], sizeType: ['compressed'], success: resolve, fail: error => cancel(error) ? resolve(null) : reject(problem('未能选择照片，请重试。')) }));
  } catch (error) { throw problem(error.message || '当前微信不支持选择照片，请更新微信后重试。'); }
  if (!chosen) return null;
  const file = chosen.tempFiles && chosen.tempFiles[0];
  if (!file || !file.tempFilePath) throw problem('照片无法读取，请重新选择。');
  const original = await invoke(options => wx.getImageInfo(options), { src: file.tempFilePath }, '照片无法打开，请重新选择。');
  if (!original.width || !original.height) throw problem('照片尺寸不正确，请重新选择。');
  const ratio = Math.min(1, 1200 / Math.max(original.width, original.height));
  const compressed = await invoke(options => wx.compressImage(options), { src: file.tempFilePath, quality: 78, compressedWidth: Math.max(1, Math.round(original.width * ratio)), compressedHeight: Math.max(1, Math.round(original.height * ratio)) }, '照片压缩失败，请尝试换一张照片。');
  const tempPath = compressed.tempFilePath;
  const image = await invoke(options => wx.getImageInfo(options), { src: tempPath }, '照片无法打开，请选择 JPG、PNG 或 WebP。');
  let type = String(image.type || '').toLowerCase();
  if (type === 'jpeg') type = 'jpg';
  if (imageTypes.indexOf(type) < 0 || !image.width || !image.height) throw problem('照片仅支持 JPG、PNG、WebP。');
  const measured = await info(tempPath);
  return { kind: 'image', tempPath, name: '商品照片.' + type, type, size: checkSize(measured.size) };
}
async function remove(path) {
  if (!isManaged(path)) return false;
  try { await invoke(options => wx.getFileSystemManager().unlink(options), { filePath: path }, '未能清理本机文件。'); return true; }
  catch (error) { return false; }
}
async function keep(candidate) {
  if (!candidate || !['image', 'attachment'].includes(candidate.kind) || typeof candidate.tempPath !== 'string' || !candidate.tempPath) throw problem('文件尚未准备好，请重新选择。');
  checkSize(candidate.size);
  const types = candidate.kind === 'image' ? imageTypes : documentTypes;
  if (types.indexOf(candidate.type) < 0) throw problem('文件格式不支持，请重新选择。');
  const destination = base() + candidate.kind + '-' + Date.now() + '-' + Math.random().toString(36).slice(2, 12) + '.' + candidate.type;
  try {
    // copyFile 保留临时源文件，使存储写入失败后仍可再次尝试发布。
    await invoke(options => wx.getFileSystemManager().copyFile(options), { srcPath: candidate.tempPath, destPath: destination }, '文件保存失败，请释放本机空间后重试。');
    const measured = await info(destination);
    const size = checkSize(measured.size);
    if (size !== candidate.size) throw problem('保存的文件不完整，请重新选择。');
    const saved = { name: candidate.name, path: destination, size, type: candidate.type };
    if (candidate.kind === 'attachment') validateSavedAttachment(saved);
    return saved;
  } catch (error) { await remove(destination); throw error; }
}
async function openDocument(attachment) {
  const saved = validateSavedAttachment(attachment);
  const measured = await info(saved.path);
  if (measured.size !== saved.size) throw problem('资料文件已丢失或不完整，请重新选择并发布。');
  await invoke(options => wx.openDocument(options), { filePath: saved.path, fileType: saved.type, showMenu: true }, '当前设备无法打开这份文件，请检查文件内容或在电脑中查看。');
}
module.exports = { MAX_BYTES, documentTypes, choosePhoto, chooseAttachment, keep, remove, isManaged, isPhotoPath, validateSavedAttachment, openDocument };
