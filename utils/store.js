// 本机课堂演示资料与收藏；不连接微信登录或服务器。
const { schools, resources, products } = require('./catalog');
const { majors } = require('./majors');
const PROFILE_KEY = 'txj.profile.v1';
const FAVORITES_KEY = 'txj.favorites.v1';

function problem(message, code) {
  const error = new Error(message);
  error.code = code;
  return error;
}
function read(key, fallback) {
  let value;
  try { value = wx.getStorageSync(key); }
  catch (error) { throw problem('无法读取本机记录，请稍后重新打开页面。', 'STORAGE_READ'); }
  return value === '' || value === undefined || value === null ? fallback : value;
}
function write(key, value) {
  try { wx.setStorageSync(key, value); }
  catch (error) { throw problem('保存失败，本机存储可能已满。原记录未主动删除，请重试。', 'STORAGE_WRITE'); }
  return value;
}
function isManagedAvatar(filePath) {
  const base = wx.env && wx.env.USER_DATA_PATH;
  if (!base || typeof filePath !== 'string') return false;
  const prefix = base + '/txj-avatar-';
  return filePath.indexOf(prefix) === 0 && /^[a-zA-Z0-9_-]+\.jpg$/.test(filePath.slice(prefix.length));
}
function getProfile() {
  const value = read(PROFILE_KEY, {});
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw problem('本机资料格式异常，暂时无法读取。', 'STORAGE_INVALID');
  return {
    nickname: typeof value.nickname === 'string' && value.nickname.trim() ? value.nickname.trim() : '同校同学',
    major: typeof value.major === 'string' && majors.indexOf(value.major) >= 0 ? value.major : '公共课程',
    avatar: typeof value.avatar === 'string' ? value.avatar : '',
    demo_verified: value.demo_verified === true
  };
}
function saveProfile(value) {
  const nickname = typeof value.nickname === 'string' ? value.nickname.trim() : '';
  if (!nickname || nickname.length > 20 || /[\x00-\x1f\x7f]/.test(nickname)) throw problem('昵称请填写 1—20 个字符。', 'VALIDATION');
  if (majors.indexOf(value.major) < 0) throw problem('请从列表中选择专业。', 'VALIDATION');
  if (value.avatar !== '' && !isManagedAvatar(value.avatar)) throw problem('头像还未保存到本机，请重新选择。', 'VALIDATION');
  if (value.demo_verified !== undefined && typeof value.demo_verified !== 'boolean') throw problem('演示认证选项格式不正确。', 'VALIDATION');
  const profile = { nickname, major: value.major, avatar: value.avatar, demo_verified: value.demo_verified === undefined ? getProfile().demo_verified : value.demo_verified };
  write(PROFILE_KEY, profile);
  return Object.assign({}, profile);
}
function isValidItem(section, id, schoolId) {
  if (typeof id !== 'string' || !schools.some(s => s.id === schoolId)) return false;
  const community = require('./community');
  const source = section === 'resources' ? community.getResources() : section === 'market' ? community.getProducts() : null;
  return Boolean(source && source.some(row => row.id === id && row.school_id === schoolId));
}
function allFavorites() {
  const value = read(FAVORITES_KEY, []);
  if (!Array.isArray(value)) throw problem('本机收藏格式异常，暂时无法读取。', 'STORAGE_INVALID');
  const seen = {};
  return value.filter(row => {
    if (!row || !isValidItem(row.section, row.id, row.schoolId)) return false;
    const key = row.section + ':' + row.schoolId + ':' + row.id;
    if (seen[key]) return false;
    seen[key] = true;
    return true;
  }).map(row => ({ section: row.section, id: row.id, schoolId: row.schoolId }));
}
function getFavorites(schoolId) {
  if (!schools.some(s => s.id === schoolId)) return [];
  return allFavorites().filter(row => row.schoolId === schoolId);
}
function isFavorite(section, id, schoolId) {
  if (!isValidItem(section, id, schoolId)) return false;
  return getFavorites(schoolId).some(row => row.section === section && row.id === id);
}
function toggleFavorite(section, id, schoolId) {
  if (!isValidItem(section, id, schoolId)) throw problem('内容不存在或不属于当前学校，不能收藏。', 'VALIDATION');
  const rows = allFavorites();
  const index = rows.findIndex(row => row.section === section && row.id === id && row.schoolId === schoolId);
  if (index >= 0) rows.splice(index, 1);
  else rows.unshift({ section, id, schoolId });
  write(FAVORITES_KEY, rows);
  return index < 0;
}
module.exports = { getProfile, saveProfile, isFavorite, toggleFavorite, getFavorites, isManagedAvatar, read, write };
