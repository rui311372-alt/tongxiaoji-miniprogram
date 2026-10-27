// 仅本机课堂演示：不上传内容，也不连接真实卖家。
const catalog = require('./catalog');
const { majors } = require('./majors');
const store = require('./store');
const files = require('./files');
// 静态声明全部内置数据依赖，让微信开发工具完整收集新增模块。
const marketExpansion = require('./market-expansion');
const majorResources = require('./major-resources');
const wantedSeeds = require('./wanted-seeds');
const auctionSeeds = require('./auction-seeds');
const KEY = 'txj.community.v1';
const resourceCategories = ['课程笔记', '复习提纲', '习题整理', '其他'];
const productCategories = ['宿舍好物', '数码设备', '出行运动', '书籍教材', '其他'];
const conditions = ['全新未使用', '九成新', '八成新', '正常使用', '有使用痕迹'];
function fail(message) { throw new Error(message); }
function blank() { return { resources: [], products: [], requests: [], wanted: [], threads: [] }; }
function read() {
  const value = store.read(KEY, null);
  if (value === null) return blank();
  if (!value || typeof value !== 'object' || Array.isArray(value)) fail('本机发布和消息记录格式异常，请勿继续覆盖。');
  for (const key of ['resources', 'products', 'requests', 'wanted', 'threads']) {
    if (!Array.isArray(value[key]) || value[key].length > (key === 'threads' ? 30 : 80)) fail('本机记录异常或超出容量，请检查存储。');
    if (value[key].some(row => !row || typeof row.id !== 'string' || !catalog.schools.some(s => s.id === row.school_id))) fail('本机记录格式异常，请勿继续覆盖。');
  }
  return value;
}
function save(value) {
  if (JSON.stringify(value).length > 800000) fail('本机演示记录已接近容量上限，暂时无法保存。');
  store.write(KEY, value);
}
function text(value, label, max, optional) {
  if (value === undefined || value === null) value = '';
  if (typeof value !== 'string') fail(label + '格式不正确。');
  const result = value.trim();
  if ((!optional && !result) || result.length > max || /[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]/.test(result)) fail(label + '请填写' + (optional ? '不超过 ' : '1—') + max + ' 个字符。');
  return result;
}
function school(id) { if (!catalog.schools.some(s => s.id === id)) fail('请选择有效学校。'); return id; }
function money(value, label) {
  const raw = String(value === undefined ? '' : value).trim();
  if (!/^\d+(\.\d{1,2})?$/.test(raw)) fail(label + '请填写金额，最多两位小数。');
  const cents = Math.round(Number(raw) * 100);
  if (!Number.isSafeInteger(cents) || cents < 1 || cents > 9999900) fail(label + '范围为 0.01—99999 元。');
  return cents;
}
function id(prefix) { return prefix + '-local-' + Date.now() + '-' + Math.random().toString(36).slice(2, 10); }
function getResources() { return read().resources.concat(catalog.resources, majorResources.resources).map(row => Object.assign({ attachment: null }, row)); }
function productSource() {
  return catalog.products.map(row => Object.assign({}, row, marketExpansion.imageOverrides[row.id] || {})).concat(marketExpansion.products);
}
function getProducts() { return read().products.concat(productSource()).map(row => Object.assign({ sale_mode: 'fixed', auction_end_at: null, bid_increment_cents: 0, photos: row.image ? [row.image] : [] }, row)); }
function getRequests() { return read().requests.slice(); }
function getWanted() { return read().wanted.concat(wantedSeeds); }
function publish(kind, data) {
  const buckets = { resource: 'resources', product: 'products', request: 'requests', wanted: 'wanted' };
  if (!buckets[kind] || !data || typeof data !== 'object') fail('发布类型不正确。');
  const state = read();
  const bucket = state[buckets[kind]];
  if (bucket.length >= 80) fail('这类本机发布已达 80 条上限。');
  const row = { id: id(kind), school_id: school(data.school_id), title: text(data.title, '标题', 80), description: text(data.description, '内容说明', 3000), created_at: new Date().toISOString(), isLocal: true, author_name: store.getProfile().nickname, status: 'open' };
  if (kind === 'resource' || kind === 'request') {
    row.course = text(data.course, '课程', 60);
    row.major = text(data.major, '专业', 60);
    if (majors.indexOf(row.major) < 0) fail('请从列表选择专业。');
  }
  if (kind === 'resource') {
    if (resourceCategories.indexOf(data.category) < 0) fail('请选择资料分类。');
    row.category = data.category;
    row.attachment = data.attachment ? files.validateSavedAttachment(data.attachment) : null;
    row.body = text(data.body, '资料正文', 30000, Boolean(row.attachment));
    row.demoScore = 0;
    row.gold = false;
  }
  if (kind === 'product') {
    if (productCategories.indexOf(data.category) < 0) fail('请选择闲置分类。');
    if (conditions.indexOf(data.condition) < 0) fail('请选择物品成色。');
    row.category = data.category;
    row.condition = data.condition;
    if (data.price_cents !== undefined) {
      if (!Number.isInteger(data.price_cents) || data.price_cents < 1 || data.price_cents > 9999900) fail('价格范围为 0.01—99999 元。');
      row.price_cents = data.price_cents;
    } else row.price_cents = money(data.price, '价格');
    row.place = text(data.place, '公共交接地点', 100);
    const photos = data.photos === undefined ? (data.image ? [data.image] : []) : data.photos;
    if (!Array.isArray(photos) || photos.length > 3 || photos.some(path => !files.isPhotoPath(path))) fail('商品照片需保存到本机，最多 3 张。');
    row.photos = photos.slice();
    row.image = photos[0] || '';
    row.sale_mode = data.sale_mode || 'fixed';
    if (!['fixed', 'auction'].includes(row.sale_mode)) fail('请选择固定价格或校园竞价。');
    row.auction_end_at = null;
    row.bid_increment_cents = 0;
    if (row.sale_mode === 'auction') {
      const end = Number(data.auction_end_at);
      const now = Date.now();
      if (!Number.isFinite(end) || end <= now || end > now + 15 * 86400000) fail('竞价截止时间须在未来 15 天内。');
      const increment = data.bid_increment_cents !== undefined ? data.bid_increment_cents : money(data.increment, '每次加价');
      if (!Number.isInteger(increment) || increment < 1 || increment > 1000000) fail('每次加价范围为 0.01—10000 元。');
      row.auction_end_at = end;
      row.bid_increment_cents = increment;
      row.end_at = end;
      row.increment_cents = increment;
    }
  }
  if (kind === 'wanted') {
    if (data.category !== undefined && productCategories.indexOf(data.category) < 0) fail('请选择求闲置分类。');
    row.category = data.category || '其他';
    row.budget_cents = data.budget === undefined || String(data.budget).trim() === '' ? null : money(data.budget, '预算');
    row.place = text(data.place, '期望交接地点', 100, true);
  }
  bucket.unshift(row);
  save(state);
  return row.id;
}
function updateRequest(requestId, schoolId, change) {
  school(schoolId);
  const state = read();
  const row = state.requests.find(item => item.id === requestId && item.school_id === schoolId);
  if (!row) fail('只能修改自己在本机发布的求资料。');
  if (!change || ['open', 'resolved'].indexOf(change.status) < 0) fail('求资料状态不正确。');
  if (change.status === 'resolved') {
    const resource = state.resources.concat(catalog.resources, majorResources.resources).find(item => item.id === change.resource_id && item.school_id === schoolId);
    if (!resource) fail('请选择当前学校可阅读的关联资料。');
    row.resource_id = resource.id;
  } else row.resource_id = null;
  row.status = change.status;
  row.updated_at = new Date().toISOString();
  save(state);
  return row;
}
function updateWanted(wantedId, schoolId, status) {
  school(schoolId);
  const state = read();
  const row = state.wanted.find(item => item.id === wantedId && item.school_id === schoolId);
  if (!row) fail('只能修改自己在本机发布的求闲置。');
  if (['open', 'resolved'].indexOf(status) < 0) fail('求闲置状态不正确。');
  row.status = status;
  row.updated_at = new Date().toISOString();
  save(state);
  return row;
}
function validThread(row) {
  if (!row || !Array.isArray(row.messages) || row.messages.length > 100) fail('会话记录异常，暂时无法读取。');
  const source = read().products.concat(productSource());
  const product = source.find(item => item.id === row.product_id && item.school_id === row.school_id);
  const snapshot = Object.assign({}, product || {}, row.product || {});
  if (typeof snapshot.title !== 'string' || !snapshot.title) fail('会话对应的物品信息不完整。');
  snapshot.image = snapshot.image || (product && product.image) || '';
  snapshot.isLocal = Boolean(product ? product.isLocal : snapshot.isLocal);
  const seed = auctionSeeds.find(item => item.product_id === row.product_id && item.school_id === row.school_id);
  snapshot.sale_mode = product && product.sale_mode === 'auction' || seed || snapshot.sale_mode === 'auction' ? 'auction' : 'fixed';
  const messages = row.messages.map(item => {
    if (!item || typeof item.id !== 'string' || typeof item.text !== 'string') fail('消息记录异常，暂时无法读取。');
    return Object.assign({}, item, { role: item.role === 'me' ? 'me' : 'seller', demo: item.role !== 'me' });
  });
  const latest = messages.length ? messages[messages.length - 1].created_at : '';
  const updated = Number.isFinite(Date.parse(row.updated_at)) ? row.updated_at : Number.isFinite(Date.parse(latest)) ? latest : '1970-01-01T00:00:00.000Z';
  return Object.assign({}, row, { product: snapshot, messages, updated_at: updated });
}
function startChat(productId, schoolId) {
  school(schoolId);
  const state = read();
  const product = state.products.concat(productSource()).find(row => row.id === productId && row.school_id === schoolId);
  if (!product) fail('找不到当前学校的这件物品。');
  if (product.isLocal) fail('这是自己发布的物品，无需联系自己。可在“我的发布”查看。');
  const existing = state.threads.find(row => row.product_id === productId && row.school_id === schoolId);
  if (existing) return validThread(existing).id;
  if (state.threads.length >= 30) fail('本机最多保存 30 个演示会话，请到“消息”的“管理”中删除不需要的会话后重试。');
  const now = new Date().toISOString();
  const auction = product.sale_mode === 'auction' || auctionSeeds.some(item => item.product_id === productId && item.school_id === schoolId);
  const thread = { id: id('chat'), school_id: schoolId, product_id: productId, product: { title: product.title, description: product.description, place: product.place, price_cents: product.price_cents, condition: product.condition, image: product.image || '', sale_mode: auction ? 'auction' : 'fixed', isLocal: false }, updated_at: now, messages: [{ id: id('message'), role: 'seller', text: '【演示自动回复】你好，这里是本机模拟会话。可以询问物品、价格或交接地点，消息不会发送给真实卖家。', created_at: now, demo: true }] };
  state.threads.unshift(thread);
  save(state);
  return thread.id;
}
function getThreads(schoolId) {
  school(schoolId);
  return read().threads.filter(row => row.school_id === schoolId).map(validThread).sort((a, b) => b.updated_at.localeCompare(a.updated_at));
}
function getThread(threadId) {
  const found = read().threads.find(row => row.id === threadId);
  if (!found) fail('会话不存在，请从物品详情重新进入。');
  return validThread(found);
}
function scopedThread(state, threadId, schoolId) {
  if (typeof threadId !== 'string' || !threadId) fail('请选择要管理的会话。');
  const row = state.threads.find(item => item.id === threadId && item.school_id === schoolId);
  if (!row) fail('当前学校找不到这段会话，请刷新消息列表。');
  return row;
}
function deleteThread(threadId, schoolId) {
  school(schoolId);
  const state = read();
  scopedThread(state, threadId, schoolId);
  const threads = state.threads.filter(row => !(row.id === threadId && row.school_id === schoolId));
  save(Object.assign({}, state, { threads }));
  return true;
}
function clearThreads(schoolId) {
  school(schoolId);
  const state = read();
  const threads = state.threads.filter(row => row.school_id !== schoolId);
  const removed = state.threads.length - threads.length;
  if (removed) save(Object.assign({}, state, { threads }));
  return removed;
}
function saveThreadMessages(state, original, messages) {
  const latest = messages.length ? messages[messages.length - 1].created_at : '';
  // 清理历史不算新消息；空会话排到列表末尾，页面不展示其时间。
  const updated_at = Number.isFinite(Date.parse(latest)) ? latest : '1970-01-01T00:00:00.000Z';
  const thread = validThread(Object.assign({}, original, { messages, updated_at }));
  const threads = state.threads.map(row => row.id === original.id && row.school_id === original.school_id ? thread : row);
  save(Object.assign({}, state, { threads }));
  return thread;
}
function clearThreadMessages(threadId, schoolId) {
  school(schoolId);
  const state = read();
  const thread = validThread(scopedThread(state, threadId, schoolId));
  if (!thread.messages.length) return thread;
  return saveThreadMessages(state, thread, []);
}
function deleteMessage(threadId, messageId, schoolId) {
  school(schoolId);
  const state = read();
  const thread = validThread(scopedThread(state, threadId, schoolId));
  if (typeof messageId !== 'string' || !thread.messages.some(message => message.id === messageId)) fail('这条消息已不存在，请刷新会话。');
  return saveThreadMessages(state, thread, thread.messages.filter(message => message.id !== messageId));
}
function replyFor(product, message) {
  let reply;
  if (/地点|哪里|哪儿|交接|见面/.test(message)) reply = '这件物品填写的公共交接地点是：' + product.place + '。可以在物品详情记录本机模拟预约；此回复不会通知真实卖家。';
  else if (/价格|多少钱|便宜|议价|预算/.test(message)) reply = product.sale_mode === 'auction' ? '这件物品参加校园竞价，起拍价为 ¥' + (product.price_cents / 100).toFixed(2) + '。当前出价、截止状态与最终可预约金额请以物品详情为准；起拍价不代表成交价。仅本机模拟，不处理付款。' : '当前标价为 ¥' + (product.price_cents / 100).toFixed(2) + '。本机演示不处理议价确认或付款。';
  else if (/成色|瑕疵|情况|介绍|说明/.test(message)) reply = product.condition + '。商品说明：' + (product.description || '暂无补充说明。').slice(0, 320);
  else reply = '你正在了解“' + product.title + '”。可以继续问价格、成色或交接地点；这是自动演示回复，不代表卖家承诺。';
  return '【演示自动回复】' + reply;
}
function sendMessage(threadId, value) {
  const content = text(value, '消息', 500);
  const state = read();
  const thread = validThread(state.threads.find(row => row.id === threadId));
  if (thread.product.isLocal) fail('这是自己发布的物品，不能向自己发送卖家咨询。');
  const now = new Date().toISOString();
  thread.messages.push({ id: id('message'), role: 'me', text: content, created_at: now, demo: false });
  thread.messages.push({ id: id('message'), role: 'seller', text: replyFor(thread.product, content), created_at: now, demo: true });
  thread.messages = thread.messages.slice(-100);
  thread.updated_at = now;
  state.threads = state.threads.map(row => row.id === thread.id ? thread : row);
  save(state);
  return thread;
}
module.exports = { getResources, getProducts, getRequests, getWanted, publish, updateRequest, updateWanted, startChat, getThreads, getThread, sendMessage, deleteThread, clearThreads, clearThreadMessages, deleteMessage, resourceCategories, productCategories, conditions };
