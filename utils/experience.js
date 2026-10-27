// 本机课堂体验：同台设备的昵称修改不会创建另一个账号，不连接真人或付款。
// 订单、信用、评价、足迹和出价用一个新 key 同步写入，保留旧档案/收藏/发布记录。
const catalog = require('./catalog');
const store = require('./store');
const auctionSeeds = require('./auction-seeds');
const community = require('./community');
const KEY = 'txj.experience.v1';
const SELF = 'current-local-student';
const DAY = 86400000;
function fail(message) { throw new Error(message); }
function clone(value) { return JSON.parse(JSON.stringify(value)); }
function uid(prefix) { return prefix + '-' + Date.now() + '-' + Math.random().toString(36).slice(2, 10); }
function school(id) { if (!catalog.schools.some(function (s) { return s.id === id; })) fail('请选择有效学校。'); return id; }
function blank() { return { version: 1, score: 100, orders: [], ledger: [], reviews: [], trails: [], auctions: [], bids: [] }; }
function cents(value) { return Number.isSafeInteger(value) && value >= 1 && value <= 99999999; }
function time(value) { return typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= 8640000000000000; }
function validate(raw, writing) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw) || raw.version !== 1 || !Number.isInteger(raw.score) || raw.score < 0 || raw.score > 120) fail('本机体验记录格式异常，请勿继续覆盖。');
  for (const bucket of ['orders', 'ledger', 'reviews', 'trails', 'auctions', 'bids']) {
    if (Array.isArray(raw[bucket]) && raw[bucket].length > 2000 && writing) fail('本机体验记录已达容量上限，本次操作未保存，原记录保持不变。');
    if (!Array.isArray(raw[bucket]) || raw[bucket].length > 2000 || raw[bucket].some(function (row) { return !row || typeof row !== 'object' || typeof row.id !== 'string' || !catalog.schools.some(function (s) { return s.id === row.school_id; }); })) fail('本机体验记录异常，暂时无法读取。');
  }
  if (raw.reviews.some(function (review) { return !Number.isInteger(review.score) || review.score < 1 || review.score > 5; })) fail('本机评价评分格式异常，评分必须为 1—5 星整数，原记录未覆盖。');
  const invalidAuction = raw.auctions.some(function (a) { return typeof a.product_id !== 'string' || typeof a.owner_id !== 'string' || typeof a.winner !== 'string' || !cents(a.start_price_cents) || !cents(a.current_cents) || !Number.isInteger(a.increment_cents) || a.increment_cents < 1 || a.increment_cents > 1000000 || !Number.isInteger(a.bid_count) || a.bid_count < 0 || a.bid_count > 2000 || !time(a.end_at) || !time(a.created_at) || a.current_cents < a.start_price_cents || (a.current_cents - a.start_price_cents) % a.increment_cents !== 0 || (a.bid_count === 0 && (a.current_cents !== a.start_price_cents || a.winner !== '')) || (a.bid_count > 0 && !a.winner); });
  const invalidOrder = raw.orders.some(function (o) { return typeof o.product_id !== 'string' || ['reserved', 'completed', 'cancelled', 'no_show'].indexOf(o.status) < 0 || !Number.isInteger(o.attempt) || o.attempt < 1 || !cents(o.price_cents) || !time(o.meeting_at) || !time(o.created_at) || !time(o.updated_at); });
  const invalidBid = raw.bids.some(function (b) { return typeof b.auction_id !== 'string' || typeof b.product_id !== 'string' || typeof b.bidder_id !== 'string' || !cents(b.amount_cents) || !time(b.created_at); });
  const invalidCredit = raw.ledger.some(function (e) { return typeof e.order_id !== 'string' || typeof e.product_id !== 'string' || ['completed', 'cancelled', 'no_show'].indexOf(e.action) < 0 || !Number.isInteger(e.attempt) || e.attempt < 1 || !Number.isInteger(e.score_before) || e.score_before < 0 || e.score_before > 120 || !Number.isInteger(e.score_after) || e.score_after < 0 || e.score_after > 120 || !Number.isInteger(e.delta) || e.score_after - e.score_before !== e.delta || !time(e.created_at); });
  if (invalidAuction || invalidOrder || invalidBid || invalidCredit) fail('本机拍卖、预约或信用记录格式异常，原记录未覆盖，请检查后重试。');
}
function read() {
  const raw = store.read(KEY, null);
  if (raw === null) return blank();
  validate(raw, false);
  return clone(raw);
}
function write(state) {
  // 和读取使用同一容量/格式约束，避免最后一次写入成功、下一次却无法读取。
  validate(state, true);
  if (JSON.stringify(state).length > 1200000) fail('本机演示记录接近容量上限，请先清理足迹等记录。');
  store.write(KEY, state);
}
function text(value, label, min, max) {
  const result = typeof value === 'string' ? value.trim() : '';
  if (result.length < min || result.length > max || /[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]/.test(result)) fail(label + '请填写 ' + min + '—' + max + ' 个字符。');
  return result;
}
function sectionName(section) { return section === 'resource' ? 'resources' : section === 'product' ? 'market' : section; }
function item(section, id, schoolId) {
  school(schoolId);
  const source = section === 'resources' ? community.getResources() : section === 'market' ? community.getProducts() : [];
  const found = source.find(function (row) { return row.id === id && row.school_id === schoolId; });
  if (!found) fail('内容不存在或不属于当前学校。');
  return found;
}
function getReviewSummaries(schoolId) {
  school(schoolId);
  const result = {};
  read().reviews.filter(function (row) { return row.school_id === schoolId; }).forEach(function (row) {
    if (!result[row.resource_id]) result[row.resource_id] = { count: 0, average: 0 };
    const summary = result[row.resource_id];
    summary.average = (summary.average * summary.count + row.score) / (summary.count + 1);
    summary.count++;
  });
  return result;
}
function getReviews(resourceId, schoolId) {
  const resource = item('resources', resourceId, schoolId);
  const reviews = read().reviews.filter(function (r) { return r.resource_id === resourceId && r.school_id === schoolId; }).map(function (r) { return Object.assign({}, r, { stars: r.score, isMine: true }); });
  const distribution = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
  reviews.forEach(function (r) { distribution[r.score]++; });
  return { reviews, average: reviews.length ? reviews.reduce(function (n, r) { return n + r.score; }, 0) / reviews.length : null, count: reviews.length, distribution, mine: reviews[0] || null, canReview: !resource.isLocal };
}
function saveReview(resourceId, schoolId, data) {
  const resource = item('resources', resourceId, schoolId);
  if (resource.isLocal) fail('不能给自己上传的资料评分。');
  if (!data || !Number.isInteger(data.score) || data.score < 1 || data.score > 5) fail('请选择 1—5 星的整数评分。');
  const comment = text(data.comment, '使用感受', 5, 240), state = read();
  const old = state.reviews.find(function (r) { return r.resource_id === resourceId && r.school_id === schoolId; });
  const now = Date.now();
  const review = { id: old ? old.id : uid('review'), resource_id: resourceId, school_id: schoolId, score: data.score, comment, author: store.getProfile().nickname, isMine: true, created_at: old ? old.created_at : now, updated_at: now };
  state.reviews = state.reviews.filter(function (r) { return !(r.resource_id === resourceId && r.school_id === schoolId); });
  state.reviews.unshift(review);
  write(state);
  return getReviews(resourceId, schoolId);
}
function removeReview(resourceId, schoolId) {
  item('resources', resourceId, schoolId);
  const state = read();
  state.reviews = state.reviews.filter(function (r) { return !(r.resource_id === resourceId && r.school_id === schoolId); });
  write(state);
  return getReviews(resourceId, schoolId);
}
function limit(score) { return score < 60 ? 0 : score < 80 ? 1 : 3; }
function level(score, completed) { return score < 60 ? '暂停新预约' : score < 80 ? '预约受限' : score < 100 ? '注意履约' : score >= 110 ? '履约积极' : completed ? '记录良好' : '初始信用'; }
function getCredit(schoolId) {
  school(schoolId);
  const state = read(), completed = state.ledger.filter(function (r) { return r.action === 'completed'; }).length;
  return { score: state.score, level: level(state.score, completed), limit: limit(state.score), activeCount: state.orders.filter(function (o) { return o.status === 'reserved'; }).length, ledger: state.ledger.filter(function (r) { return r.school_id === schoolId; }).sort(function (a, b) { return b.created_at - a.created_at; }), completedCount: completed, scope: '当前本机账号，所有学校共用信用与预约限额' };
}
function getOrders(schoolId) { school(schoolId); return read().orders.filter(function (o) { return o.school_id === schoolId; }).sort(function (a, b) { return b.updated_at - a.updated_at; }); }
function initializeSeeds(state) {
  let changed = false;
  const now = Date.now();
  auctionSeeds.forEach(function (seed) {
    if (state.auctions.some(function (a) { return a.product_id === seed.product_id && a.school_id === seed.school_id; })) return;
    const a = { id: 'auction-sample-' + seed.product_id, product_id: seed.product_id, school_id: seed.school_id, start_price_cents: seed.start_price_cents, current_cents: seed.start_price_cents + (seed.ended_example ? seed.increment_cents : 0), increment_cents: seed.increment_cents, end_at: now + seed.hours * 3600000, owner_id: 'example-seller-' + seed.school_id, bid_count: seed.ended_example ? 1 : 0, winner: seed.ended_example ? 'example-bidder-' + seed.school_id : '', created_at: now, is_seed: true };
    state.auctions.push(a);
    if (seed.ended_example) state.bids.push({ id: 'bid-sample-' + seed.product_id, auction_id: a.id, product_id: seed.product_id, school_id: seed.school_id, bidder_id: a.winner, nickname: '示例出价（非真人）', amount_cents: a.current_cents, created_at: now - 7200000, isMine: false, demo: true });
    changed = true;
  });
  return changed;
}
function initializeAuction(state, product) {
  let auction = state.auctions.find(function (a) { return a.product_id === product.id && a.school_id === product.school_id; });
  if (auction) return auction;
  if (product.sale_mode !== 'auction') return null;
  const rawEnd = product.auction_end_at === undefined ? product.end_at : product.auction_end_at;
  const end = typeof rawEnd === 'number' ? rawEnd : Date.parse(rawEnd);
  const increment = product.bid_increment_cents === undefined ? product.increment_cents : product.bid_increment_cents;
  if (!Number.isFinite(end) || !Number.isInteger(increment) || increment < 1 || increment > 1000000 || !Number.isInteger(product.price_cents) || product.price_cents < 1) fail('拍卖配置异常，请重新打开商品。');
  auction = { id: 'auction-' + product.id, product_id: product.id, school_id: product.school_id, start_price_cents: product.price_cents, current_cents: product.price_cents, increment_cents: increment, end_at: end, owner_id: product.isLocal ? SELF : 'example-seller-' + product.school_id, bid_count: 0, winner: '', created_at: Date.now(), is_seed: false };
  state.auctions.push(auction);
  return auction;
}
function auctionResult(state, auction, product) {
  if (!auction) return null;
  const ended = auction.end_at <= Date.now();
  const bids = state.bids.filter(function (b) { return b.auction_id === auction.id && b.product_id === product.id && b.school_id === product.school_id; });
  const myBids = bids.filter(function (b) { return b.bidder_id === SELF && !b.demo; });
  return { id: auction.id, product_id: product.id, school_id: product.school_id, start_price_cents: auction.start_price_cents, current_cents: auction.current_cents, next_cents: auction.bid_count ? auction.current_cents + auction.increment_cents : auction.start_price_cents, increment_cents: auction.increment_cents, end_at: auction.end_at, ended, bid_count: auction.bid_count, bids: bids.sort(function (a, b) { return b.created_at - a.created_at || b.amount_cents - a.amount_cents; }).slice(0, 30), myBidCount: myBids.length, myHighestBidCents: myBids.reduce(function (highest,b) { return Math.max(highest,b.amount_cents); },0), myLastBidAt: myBids.reduce(function (latest,b) { return Math.max(latest,b.created_at); },0), winner: auction.winner, isWinner: ended && auction.bid_count > 0 && auction.winner === SELF, isOwner: !!product.isLocal || auction.owner_id === SELF };
}
function getAuctionProducts() {
  const products = community.getProducts();
  const state = read();
  let changed = initializeSeeds(state);
  const result = products.filter(function (product) { return product.sale_mode === 'auction' || auctionSeeds.some(function (seed) { return seed.product_id === product.id && seed.school_id === product.school_id; }); }).map(function (product) {
    const count = state.auctions.length, auction = initializeAuction(state, product);
    if (count !== state.auctions.length) changed = true;
    if (!auction) fail('拍卖记录无法读取，原记录未覆盖。');
    return Object.assign({}, product, { sale_mode: 'auction', end_at: auction.end_at, increment_cents: auction.increment_cents, auction: auctionResult(state, auction, product) });
  });
  if (changed) write(state);
  return result;
}
function getAuction(productId, schoolId) {
  const product = item('market', productId, schoolId), state = read();
  const seeded = initializeSeeds(state), count = state.auctions.length;
  const auction = initializeAuction(state, product);
  if (seeded || count !== state.auctions.length) write(state);
  return auctionResult(state, auction, product);
}
function bid(productId, schoolId, amount) {
  const product = item('market', productId, schoolId), state = read();
  initializeSeeds(state);
  const auction = initializeAuction(state, product);
  if (!auction) fail('这件物品未开启拍卖。');
  if (product.isLocal || auction.owner_id === SELF) fail('不能给自己发布的物品出价。');
  if (auction.end_at <= Date.now()) fail('拍卖已结束，不能继续出价。');
  if (state.score < 60) fail('当前信用低于 60 分，暂停新的出价。');
  if (!Number.isInteger(amount) || amount < 1 || amount > 99999999) fail('出价请填写有效金额，最多保留两位小数。');
  const minimum = auction.bid_count ? auction.current_cents + auction.increment_cents : auction.start_price_cents;
  if (amount < minimum) fail('本次至少出价 ¥' + (minimum / 100).toFixed(2) + '。');
  const base = auction.bid_count ? auction.current_cents : auction.start_price_cents;
  if ((amount - base) % auction.increment_cents !== 0) fail('请按每次 ¥' + (auction.increment_cents / 100).toFixed(2) + ' 的幅度加价。');
  const row = { id: uid('bid'), auction_id: auction.id, product_id: productId, school_id: schoolId, bidder_id: SELF, nickname: store.getProfile().nickname, amount_cents: amount, created_at: Date.now(), isMine: true, demo: false };
  auction.current_cents = amount; auction.bid_count++; auction.winner = SELF;
  state.bids.unshift(row);
  write(state);
  return auctionResult(state, auction, product);
}
function reserve(productId, schoolId, data) {
  const product = item('market', productId, schoolId);
  if (product.isLocal) fail('不能预约自己发布的物品。');
  if (!data || !Number.isFinite(data.meeting_at) || data.meeting_at <= Date.now()) fail('请选择未来的见面时间。');
  if (data.meeting_at > Date.now() + 15 * DAY) fail('见面时间最多可预约未来 15 天，请重新选择。');
  const place = text(data.place, '见面地点', 1, 80), note = text(data.note || '', '补充说明', 0, 240), state = read();
  initializeSeeds(state);
  const auction = initializeAuction(state, product);
  let price = product.price_cents;
  if (auction || product.sale_mode === 'auction') {
    if (!auction || auction.end_at > Date.now()) fail('这件物品正在拍卖，结束后由最高出价者预约。');
    if (!auction.bid_count || auction.winner !== SELF) fail('拍卖已结束，仅最高出价者可以预约。');
    price = auction.current_cents;
  }
  const previous = state.orders.find(function (o) { return o.product_id === productId && o.school_id === schoolId; });
  if (data.expectedAttempt !== undefined && data.expectedAttempt !== (previous ? previous.attempt : 0)) fail('预约轮次已经变化，请刷新后操作。');
  if (previous && previous.status === 'reserved') return previous;
  if (previous && previous.status !== 'cancelled') fail('该商品的预约已结束，不能重新预约。');
  if (state.score < 60) fail('当前信用低于 60 分，暂停新预约；已有订单仍可处理。');
  if (state.orders.filter(function (o) { return o.status === 'reserved'; }).length >= limit(state.score)) fail('当前信用最多同时保留 ' + limit(state.score) + ' 个待见面预约，请先处理已有预约。');
  if (!Number.isInteger(price) || price < 1) fail('物品价格异常，暂时无法预约。');
  const now = Date.now();
  const order = { id: previous ? previous.id : uid('order'), product_id: productId, school_id: schoolId, title: product.title, image: product.image || '', price_cents: price, place, note, meeting_at: data.meeting_at, created_at: now, updated_at: now, status: 'reserved', attempt: previous ? previous.attempt + 1 : 1 };
  state.orders = state.orders.filter(function (o) { return o.id !== order.id; });
  state.orders.unshift(order);
  write(state);
  return clone(order);
}
function transitionOrder(orderId, schoolId, action, expectedAttempt) {
  school(schoolId);
  if (['completed', 'cancelled', 'no_show'].indexOf(action) < 0) fail('订单状态无效。');
  if (!Number.isInteger(expectedAttempt) || expectedAttempt < 1) fail('预约信息已更新，请刷新后操作。');
  const state = read(), order = state.orders.find(function (o) { return o.id === orderId && o.school_id === schoolId; });
  if (!order) fail('无法访问此学校的订单。');
  if (order.attempt !== expectedAttempt) fail('这是旧一轮预约，请刷新订单后操作。');
  const prior = state.ledger.find(function (e) { return e.order_id === orderId && e.attempt === expectedAttempt; });
  if (prior) { if (prior.action === action) return clone(order); fail('此预约已按其他方式结束，不能重复计分。'); }
  if (order.status !== 'reserved') fail('订单已结束，不能重复处理。');
  const now = Date.now(), remaining = order.meeting_at - now;
  let status = action, delta = 0, reason = '';
  if (action === 'completed') { delta = 2; reason = '完成模拟预约'; }
  else if (action === 'no_show') { delta = -10; reason = '课堂演练：模拟本人爽约'; }
  else if (remaining <= 0) { status = 'no_show'; delta = -10; reason = '过时取消，计为爽约'; }
  else if (remaining < 7200000) { delta = -3; reason = '不足两小时取消'; }
  else reason = '提前至少两小时取消';
  const after = Math.min(120, Math.max(0, state.score + delta));
  state.ledger.unshift({ id: uid('credit'), school_id: schoolId, order_id: orderId, product_id: order.product_id, title: order.title, attempt: order.attempt, action, reason, rule_delta: delta, delta: after - state.score, score_before: state.score, score_after: after, created_at: now });
  state.score = after; order.status = status; order.updated_at = now;
  write(state);
  return clone(order);
}
function recordTrail(section, id, schoolId) {
  section = sectionName(section);
  const found = item(section, id, schoolId), state = read();
  state.trails = state.trails.filter(function (r) { return !(r.item_id === id && r.section === section && r.school_id === schoolId); });
  state.trails.unshift({ id: section + ':' + schoolId + ':' + id, item_id: id, section, school_id: schoolId, title: found.title, image: found.image || '', subtitle: section === 'resources' ? found.course + ' · ' + found.major : '¥' + (found.price_cents / 100).toFixed(2) + ' · ' + found.condition, visited_at: Date.now() });
  state.trails = state.trails.slice(0, 40);
  write(state);
}
function getTrails(schoolId) { school(schoolId); return read().trails.filter(function (r) { return r.school_id === schoolId; }).map(function (r) { return Object.assign({}, r, { id: r.item_id }); }); }
function clearTrails(schoolId) { school(schoolId); const state = read(); state.trails = state.trails.filter(function (r) { return r.school_id !== schoolId; }); write(state); }
module.exports = { getReviews, getReviewSummaries, saveReview, removeReview, getCredit, getOrders, reserve, transitionOrder, recordTrail, getTrails, clearTrails, getAuction, getAuctionProducts, bid };
