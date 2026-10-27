const { schools } = require('../../utils/catalog');
const community = require('../../utils/community');
const { majors } = require('../../utils/majors');
const store = require('../../utils/store');
const photoMap = require('../../utils/photo-map');
const { deriveParticipation } = require('../../utils/auction-participation');
const mainNav = require('../../utils/main-nav');
const tabs = [{ id: 'orders', label: '我的订单' }, { id: 'posts', label: '我的发布' }, { id: 'saved', label: '我的收藏' }, { id: 'history', label: '浏览足迹' }, { id: 'credit', label: '校园信用' }];
const statuses = [{ id: 'all', label: '全部' }, { id: 'reserved', label: '待见面' }, { id: 'completed', label: '已完成' }, { id: 'cancelled', label: '已取消' }, { id: 'no_show', label: '已爽约' }];
const ruleRows = [{ id: 'completed', label: '模拟完成交易', note: '每次预约只计分一次，最高 120 分。', delta: 2 }, { id: 'early_cancel', label: '提前取消预约', note: '距约定时间至少 2 小时。', delta: 0 }, { id: 'late_cancel', label: '临近取消预约', note: '距约定时间不足 2 小时。', delta: -3 }, { id: 'no_show', label: '模拟本人爽约', note: '主动模拟爽约，或在约定时间后取消。', delta: -10 }];
const statusLabels = { reserved: '待见面', completed: '已完成', cancelled: '已取消', no_show: '已爽约' };
function experience() { return require('../../utils/experience'); }
function money(cents) { return (Number(cents || 0) / 100).toFixed(2).replace(/\.00$/, ''); }
function dateText(time) {
  const date = new Date(time);
  if (!Number.isFinite(date.getTime())) return '时间待确认';
  const pad = n => String(n).padStart(2, '0');
  return (date.getFullYear() === new Date().getFullYear() ? '' : date.getFullYear() + '年') + (date.getMonth() + 1) + '月' + date.getDate() + '日 ' + pad(date.getHours()) + ':' + pad(date.getMinutes());
}
function cancellationNote(time) {
  const remaining = Number(time) - Date.now();
  return remaining <= 0 ? '已过约定时间，取消将计为本人爽约，扣 10 分。' : remaining < 7200000 ? '临近约定时间，取消将扣 3 分。' : '提前至少 2 小时取消不扣分。';
}
function deadlineHint(time) {
  const remaining = Number(time) - Date.now();
  if (remaining <= 0) return '已结束';
  if (remaining < 60000) return '即将截止';
  const minutes = Math.ceil(remaining / 60000), hours = Math.floor(minutes / 60);
  return hours >= 24 ? '还剩 ' + Math.floor(hours / 24) + ' 天 ' + hours % 24 + ' 小时' : hours ? '还剩 ' + hours + ' 小时 ' + minutes % 60 + ' 分钟' : '还剩 ' + minutes + ' 分钟';
}
function imagePath(path) { return photoMap[path] || path || ''; }
function removeOwnedFile(filePath) {
  if (!store.isManagedAvatar(filePath)) return;
  try { wx.getFileSystemManager().unlink({ filePath, fail() {} }); } catch (error) { /* Cleanup does not change the saved profile. */ }
}
function keepAvatar(tempFilePath) {
  return new Promise((resolve, reject) => {
    const filePath = wx.env.USER_DATA_PATH + '/txj-avatar-' + Date.now() + '-' + Math.random().toString(36).slice(2, 10) + '.jpg';
    wx.getFileSystemManager().saveFile({ tempFilePath, filePath, success(result) {
      const saved = result.savedFilePath || filePath;
      if (!store.isManagedAvatar(saved)) { reject(new Error('头像文件未正确保存，请重新选择。')); return; }
      resolve(saved);
    }, fail() { reject(new Error('头像保存失败，请重新选择或释放本机空间后再试。')); } });
  });
}
function makeCalendar(order) {
  const escape = value => String(value || '').replace(/\\/g, '\\\\').replace(/\r?\n/g, '\\n').replace(/,/g, '\\,').replace(/;/g, '\\;');
  const stamp = time => new Date(time).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z');
  const fold = line => {
    let result = '', used = 0;
    for (const char of line) {
      const point = char.codePointAt(0), length = point <= 0x7f ? 1 : point <= 0x7ff ? 2 : point <= 0xffff ? 3 : 4;
      if (used + length > 75) { result += '\r\n '; used = 1; }
      result += char; used += length;
    }
    return result;
  };
  return ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Tongxiaoji//Campus Appointment//ZH', 'BEGIN:VEVENT', 'UID:' + escape(order.id) + '-' + order.attempt + '@tongxiaoji', 'DTSTAMP:' + stamp(Date.now()), 'DTSTART:' + stamp(order.meeting_at), 'DTEND:' + stamp(Number(order.meeting_at) + 30 * 60000), 'SUMMARY:' + escape('同校集见面 · ' + order.title), 'LOCATION:' + escape(order.place), 'DESCRIPTION:' + escape('课堂模拟预约，不涉及付款。请按约到场并当面验货。取消或修改小程序预约后，请自行更新已经导入的日历。'), 'END:VEVENT', 'END:VCALENDAR', ''].map(fold).join('\r\n');
}
Page({
  data: {
    editing: false, profileInfo: { nickname: '同校同学', major: '公共课程', avatar: '', demo_verified: false }, school: schools[0], majors, nickname: '', majorIndex: 0, draftAvatar: '', demoVerified: false, saving: false, canSave: false,
    saveHint: '修改后点击保存。', loadError: '', favoritesError: '', dataError: '', experienceError: '', favorites: [], visibleFavorites: [], favoriteKind: 'all', favoriteKinds: [{ id: 'all', label: '全部', count: 0 }, { id: 'resources', label: '学习资料', count: 0 }, { id: 'market', label: '二手闲置', count: 0 }], navigating: false, navigationId: '', focusedOrderId: '',
    tabs, mineTab: 'orders', orderArea: 'appointments', statuses, orderStatus: 'all', orders: [], visibleOrders: [], auctionParticipation: [], visibleAuctions: [], auctionStatus: 'all', auctionFilters: [{ id: 'all', label: '全部' }, { id: 'active', label: '竞拍中' }, { id: 'won', label: '已中拍' }, { id: 'ended', label: '已结束' }], auctionError: '', posts: [], trails: [], credit: null, ledger: [], counts: { posts: 0, saved: 0, pending: 0, history: 0 }, creditCounts: { completed: 0, late_cancel: 0, no_show: 0 }, ruleRows, ruleLabels: ruleRows.map(row => row.label), simulationIndex: 0, projectedScore: 102, projectedLimit: 3, calendarBusy: false
  },
  onLoad(options) {
    this._disposed = false; this._loaded = false; this._avatarCandidate = null;
    if (options && tabs.some(row => row.id === options.tab)) this.setData({ mineTab: options.tab });
    if (options && (options.view === 'auctions' || options.orderSection === 'auctions')) this.setData({ orderArea: 'auctions' });
  },
  onShow() {
    this._leaving = false;
    const school = schools.find(row => row.id === getApp().globalData.schoolId) || schools[0];
    this._hidden = false;
    if (school.id !== this.data.school.id) this.setData({ favorites: [], visibleFavorites: [], posts: [], orders: [], visibleOrders: [], focusedOrderId: '', orderStatus: 'all', auctionParticipation: [], visibleAuctions: [], auctionStatus: 'all', auctionError: '', trails: [], ledger: [], credit: null, counts: { posts: 0, saved: 0, pending: 0, history: 0 }, creditCounts: { completed: 0, late_cancel: 0, no_show: 0 }, favoriteKinds: [{ id: 'all', label: '全部', count: 0 }, { id: 'resources', label: '学习资料', count: 0 }, { id: 'market', label: '二手闲置', count: 0 }] });
    this.setData({ school, navigating: false, navigationId: '' });
    if (!this._loaded) this.reloadProfile();
    this.refreshDashboard();
  },
  onHide() { this._hidden = true; if (this._auctionTimer) { clearTimeout(this._auctionTimer); this._auctionTimer = null; } },
  onUnload() { this._disposed = true; if (this._auctionTimer) { clearTimeout(this._auctionTimer); this._auctionTimer = null; } },
  reloadProfile() {
    if (this.data.saving) return;
    try {
      const profile = store.getProfile();
      this._avatarCandidate = null; this._loaded = true;
      this.setData({ profileInfo: profile, nickname: profile.nickname, majorIndex: Math.max(0, majors.indexOf(profile.major)), draftAvatar: profile.avatar, demoVerified: profile.demo_verified === true, loadError: '', canSave: true, saveHint: '修改后点击保存。' });
    } catch (error) { this.setData({ loadError: error.message, canSave: false }); }
  },
  changeNickname(event) { if (!this.data.saving) this.setData({ nickname: event.detail.value, saveHint: '有修改尚未保存。' }); },
  changeMajor(event) {
    if (this.data.saving) return;
    const index = Number(event.detail.value);
    if (Number.isInteger(index) && index >= 0 && index < majors.length) this.setData({ majorIndex: index, saveHint: '有修改尚未保存。' });
  },
  changeVerification(event) { if (!this.data.saving) this.setData({ demoVerified: event.detail.value.indexOf('verified') >= 0, saveHint: '有修改尚未保存。' }); },
  chooseAvatar(event) {
    if (this.data.saving || !this.data.canSave) return;
    const avatar = event.detail && event.detail.avatarUrl;
    if (typeof avatar !== 'string' || !avatar) return;
    this._avatarCandidate = avatar; this.setData({ draftAvatar: avatar, saveHint: '头像已选择，点击保存资料后生效。' });
  },
  removeAvatar() { if (!this.data.saving) { this._avatarCandidate = ''; this.setData({ draftAvatar: '', saveHint: '头像将在保存资料后移除。' }); } },
  async save() {
    if (this.isBusy() || !this.data.canSave) return;
    const nickname = this.data.nickname.trim();
    if (!nickname || nickname.length > 20 || /[\x00-\x1f\x7f]/.test(nickname)) { wx.showToast({ title: '昵称请填写 1—20 个字符', icon: 'none' }); return; }
    const major = majors[this.data.majorIndex];
    if (!major) { wx.showToast({ title: '请选择专业', icon: 'none' }); return; }
    this.setData({ saving: true, saveHint: '正在保存到本机…' });
    let newFile = '', committed = false, before = null;
    try {
      before = store.getProfile();
      const candidate = this._avatarCandidate;
      let avatar = before.avatar;
      if (candidate === '') avatar = '';
      else if (candidate && candidate !== before.avatar) { newFile = await keepAvatar(candidate); avatar = newFile; }
      if (this._disposed) { if (newFile) removeOwnedFile(newFile); return; }
      const profile = store.saveProfile({ nickname, major, avatar, demo_verified: this.data.demoVerified });
      committed = true; this._avatarCandidate = null;
      this.setData({ profileInfo: profile, nickname: profile.nickname, draftAvatar: profile.avatar, saveHint: '已保存到这台设备。', editing: false });
      if (before.avatar && before.avatar !== avatar) removeOwnedFile(before.avatar);
      wx.showToast({ title: '已保存到本机', icon: 'success' });
    } catch (error) {
      if (!committed && newFile) { removeOwnedFile(newFile); this._avatarCandidate = null; if (!this._disposed) this.setData({ draftAvatar: before ? before.avatar : '' }); }
      if (!this._disposed) { this.setData({ saveHint: (error.message || '保存失败，请重试。') + (newFile ? ' 如需换头像，请重新选择。' : '') }); wx.showToast({ title: '保存失败，请查看页面提示', icon: 'none' }); }
    } finally { if (!this._disposed) this.setData({ saving: false }); }
  },
  refreshFavorites() {
    try {
      const resources = community.getResources(), products = community.getProducts();
      const favorites = store.getFavorites(this.data.school.id).map(row => {
        const item = (row.section === 'resources' ? resources : products).find(item => item.id === row.id && item.school_id === row.schoolId);
        if (!item) return null;
        return Object.assign({}, row, { key: row.section + ':' + row.id, title: item.title, image: imagePath(item.image), label: row.section === 'resources' ? '学习资料' : '二手闲置', subtitle: row.section === 'resources' ? item.course + ' · ' + item.major : '¥' + money(item.price_cents) + ' · ' + item.condition });
      }).filter(Boolean);
      this.setData({ favorites, favoritesError: '', 'counts.saved': favorites.length, favoriteKinds: [{ id: 'all', label: '全部', count: favorites.length }, { id: 'resources', label: '学习资料', count: favorites.filter(row => row.section === 'resources').length }, { id: 'market', label: '二手闲置', count: favorites.filter(row => row.section === 'market').length }] });
      this.filterFavorites();
    } catch (error) { this.setData({ favorites: [], visibleFavorites: [], 'counts.saved': 0, favoritesError: error.message || '收藏读取失败，请重试。' }); }
  },
  refreshDashboard() {
    if (this._disposed) return;
    this.refreshFavorites();
    try {
      const schoolId = this.data.school.id;
      const groups = [{ rows: community.getResources(), kind: 'resource', label: '学习资料', section: 'resources' }, { rows: community.getProducts(), kind: 'product', label: '二手闲置', section: 'market' }, { rows: community.getRequests(), kind: 'request', label: '求资料', section: 'requests' }, { rows: community.getWanted(), kind: 'wanted', label: '求闲置', section: 'wanted' }];
      const posts = [];
      groups.forEach(group => group.rows.filter(row => row.isLocal && row.school_id === schoolId).forEach(row => posts.push(Object.assign({}, row, { key: group.kind + ':' + row.id, kind: group.kind, section: group.section, label: group.label, image: imagePath(row.image), timeLabel: dateText(row.created_at), subtitle: group.kind === 'resource' ? row.course + ' · ' + row.major : group.kind === 'product' ? '¥' + money(row.price_cents) + ' · ' + row.condition + (row.sale_mode === 'auction' ? ' · 拍卖' : '') : row.description, statusLabel: row.status === 'resolved' ? '已解决' : row.status === 'closed' ? '已结束' : '已发布' }))));
      posts.sort((a, b) => new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime());
      this.setData({ posts, dataError: '', 'counts.posts': posts.length });
    } catch (error) { this.setData({ posts: [], 'counts.posts': 0, dataError: error.message || '发布记录读取失败，请重试。' }); }
    try {
      const service = experience(), schoolId = this.data.school.id, credit = service.getCredit(schoolId);
      const orders = service.getOrders(schoolId).map(order => Object.assign({}, order, { image: imagePath(order.image), priceLabel: money(order.price_cents), statusLabel: statusLabels[order.status] || order.status, meetingLabel: dateText(order.meeting_at), cancelNote: cancellationNote(order.meeting_at), overdue: order.status === 'reserved' && Number(order.meeting_at) <= Date.now() }));
      const trails = service.getTrails(schoolId).map(row => Object.assign({}, row, { key: row.section + ':' + row.id, image: imagePath(row.image), label: row.section === 'resources' ? '学习资料' : '二手闲置', timeLabel: dateText(row.visited_at) }));
      const ledger = credit.ledger.map((row, index) => Object.assign({}, row, { key: row.order_id + ':' + row.attempt + ':' + index, deltaLabel: row.delta > 0 ? '+' + row.delta : String(row.delta), timeLabel: dateText(row.created_at), boundary: row.rule_delta !== row.delta }));
      const creditCounts = { completed: ledger.filter(row => row.action === 'completed').length, late_cancel: ledger.filter(row => row.rule_delta === -3).length, no_show: ledger.filter(row => row.action === 'no_show' || row.rule_delta === -10).length };
      this.setData({ credit, creditWidth: Math.round(credit.score / 120 * 100), orders, trails, ledger, creditCounts, experienceError: '', 'counts.pending': orders.filter(row => row.status === 'reserved').length, 'counts.history': trails.length });
      this.filterOrders(); this.updateSimulation();
    } catch (error) { this.setData({ orders: [], visibleOrders: [], focusedOrderId: '', trails: [], ledger: [], credit: null, 'counts.pending': 0, 'counts.history': 0, creditCounts: { completed: 0, late_cancel: 0, no_show: 0 }, experienceError: error.message || '订单与信用记录读取失败，请重试。' }); }
    this.refreshAuctionParticipation();
  },
  isBusy() { return this._disposed || this.data.saving || this.data.calendarBusy || this.data.navigating; },
  changeTab(event) { if (!this.isBusy()) this.selectTab(event.currentTarget.dataset.tab); },
  selectTab(tab) { if (tabs.some(row => row.id === tab)) { this.setData({ mineTab: tab }); if (tab === 'orders' && this.data.orderArea === 'auctions') this.refreshAuctionParticipation(); else this.scheduleAuctionRefresh(); } },
  changeOrderArea(event) { const area = event.currentTarget.dataset.area; if (this.isBusy() || ['appointments', 'auctions'].indexOf(area) < 0) return; this.setData({ orderArea: area }); this.refreshDashboard(); },
  changeAuctionStatus(event) { const status = event.currentTarget.dataset.status; if (this.isBusy() || !this.data.auctionFilters.some(row => row.id === status)) return; this.setData({ auctionStatus: status }); this.filterAuctions(); },
  refreshAuctionParticipation() {
    if (this._disposed) return;
    try {
      const service = experience(), schoolId = this.data.school.id;
      const auctionParticipation = deriveParticipation(service.getAuctionProducts(), service.getOrders(schoolId), schoolId, Date.now()).map(row => Object.assign({}, row, { image: imagePath(row.image), priceLabel: money(row.current_cents), myPriceLabel: money(row.mine_cents), endLabel: dateText(row.end_at), timeHint: deadlineHint(row.end_at), lastBidLabel: dateText(row.last_bid_at) }));
      this.setData({ auctionParticipation, auctionError: '' }); this.filterAuctions();
    } catch (error) { this.setData({ auctionParticipation: [], visibleAuctions: [], auctionError: error.message || '拍卖参与记录读取失败，请重试。' }); }
    this.scheduleAuctionRefresh();
  },
  filterAuctions() { const status = this.data.auctionStatus; this.setData({ visibleAuctions: this.data.auctionParticipation.filter(row => status === 'all' || status === 'active' && !row.ended || status === 'won' && row.won || status === 'ended' && row.ended) }); },
  scheduleAuctionRefresh() {
    if (this._auctionTimer) { clearTimeout(this._auctionTimer); this._auctionTimer = null; }
    if (this._disposed || this._hidden || this.data.saving || this.data.calendarBusy || this.data.navigating || this.data.mineTab !== 'orders' || this.data.orderArea !== 'auctions' || this.data.auctionError) return;
    const pending = this.data.auctionParticipation.filter(row => !row.ended);
    if (!pending.length) return;
    const delay = Math.max(1000, Math.min(30000, Math.min(...pending.map(row => row.end_at)) - Date.now() + 100));
    this._auctionTimer = setTimeout(() => { if (!this._disposed && !this._hidden) this.refreshAuctionParticipation(); }, delay);
  },
  openAuction(event) { const row = this.data.auctionParticipation.find(item => item.id === event.currentTarget.dataset.id && item.school_id === this.data.school.id); if (row) this.openItem('market', row.id); },
  auctionAction(event) {
    const id = event.currentTarget.dataset.id;
    if (this.isBusy() || !this.data.auctionParticipation.some(item => item.id === id && item.school_id === this.data.school.id)) return;
    this.refreshDashboard();
    const row = this.data.auctionParticipation.find(item => item.id === id && item.school_id === this.data.school.id);
    if (!row || this.data.auctionError) { wx.showToast({ title: '拍卖记录已更新，请重新读取', icon: 'none' }); return; }
    if (row.action !== 'order') { this.openItem('market', row.id); return; }
    const order = this.data.orders.find(item => item.id === row.order_id && item.school_id === this.data.school.id);
    if (!order) { this.refreshDashboard(); wx.showToast({ title: '预约信息已更新，请重试', icon: 'none' }); return; }
    this.setData({ orderArea: 'appointments', orderStatus: order.status, focusedOrderId: order.id }); this.filterOrders(); this.scheduleAuctionRefresh();
    if (typeof wx.pageScrollTo === 'function') { const scroll = () => { if (!this._disposed) wx.pageScrollTo({ selector: '#order-' + order.id, duration: 250, fail: () => { if (!this._disposed) wx.pageScrollTo({ scrollTop: 0, duration: 200 }); } }); }; if (typeof wx.nextTick === 'function') wx.nextTick(scroll); else scroll(); }
  },
  changeOrderStatus(event) { const status = event.currentTarget.dataset.status; if (this.isBusy() || !statuses.some(row => row.id === status)) return; this.setData({ orderStatus: status, focusedOrderId: '' }); this.filterOrders(); },
  filterOrders() { this.setData({ visibleOrders: this.data.orders.filter(row => this.data.orderStatus === 'all' || row.status === this.data.orderStatus) }); },
  changeFavoriteKind(event) { const kind = event.currentTarget.dataset.kind; if (['all', 'resources', 'market'].indexOf(kind) < 0) return; this.setData({ favoriteKind: kind }); this.filterFavorites(); },
  filterFavorites() { this.setData({ visibleFavorites: this.data.favorites.filter(row => this.data.favoriteKind === 'all' || row.section === this.data.favoriteKind) }); },
  openFavorite(event) { const { section, id } = event.currentTarget.dataset; if (this.data.favorites.some(row => row.section === section && row.id === id && row.schoolId === this.data.school.id) || this.data.trails.some(row => row.section === section && row.id === id && row.school_id === this.data.school.id)) this.openItem(section, id); },
  openItem(section, id) {
    if (this.isBusy() || ['resources', 'market'].indexOf(section) < 0 || typeof id !== 'string' || !id) return;
    this.setData({ navigating: true, navigationId: id }); this.scheduleAuctionRefresh();
    const reset = () => { if (!this._disposed) { this.setData({ navigating: false, navigationId: '' }); this.scheduleAuctionRefresh(); wx.showToast({ title: '页面未能打开，请重试', icon: 'none' }); } };
    try { wx.navigateTo({ url: '/pages/detail/detail?section=' + section + '&school=' + this.data.school.id + '&id=' + encodeURIComponent(id), fail: reset }); } catch (error) { reset(); }
  },
  openOrder(event) { const order = this.data.orders.find(row => row.id === event.currentTarget.dataset.id && row.school_id === this.data.school.id); if (order) this.openItem('market', order.product_id); },
  openPublished(event) {
    if (this.isBusy()) return;
    const post = this.data.posts.find(row => row.key === event.currentTarget.dataset.key);
    if (!post) return;
    if (post.kind === 'resource' || post.kind === 'product') { this.openItem(post.section, post.id); return; }
    wx.showModal({ title: post.title, content: post.description, confirmText: '前往栏目', success: result => { if (result.confirm && !this._disposed) wx.navigateTo({ url: post.kind === 'request' ? '/pages/browse/browse?section=resources&libraryTab=requests' : '/pages/browse/browse?section=market&marketTab=wanted' }); } });
  },
  removeFavorite(event) {
    try {
      const { section, id } = event.currentTarget.dataset;
      if (!this.data.favorites.some(row => row.section === section && row.id === id && row.schoolId === this.data.school.id)) return;
      const saved = store.isFavorite(section, id, this.data.school.id);
      if (saved) store.toggleFavorite(section, id, this.data.school.id);
      this.refreshFavorites(); wx.showToast({ title: saved ? '已取消收藏' : '这条收藏已经取消', icon: 'none' });
    } catch (error) { wx.showToast({ title: error.message || '取消失败，请重试', icon: 'none' }); }
  },
  changeOrder(event) {
    if (this.isBusy()) return;
    const { id, action } = event.currentTarget.dataset, shown = this.data.orders.find(row => row.id === id);
    if (!shown || shown.status !== 'reserved' || ['completed', 'cancelled', 'no_show'].indexOf(action) < 0) return;
    let order;
    try { order = experience().getOrders(this.data.school.id).find(row => row.id === id); }
    catch (error) { this.refreshDashboard(); wx.showToast({ title: error.message || '预约读取失败，请重试', icon: 'none' }); return; }
    if (!order || order.status !== 'reserved' || order.attempt !== shown.attempt) { this.refreshDashboard(); wx.showToast({ title: '预约状态或轮次已更新，请重新查看', icon: 'none' }); return; }
    const schoolId = this.data.school.id, attempt = order.attempt;
    let title = '确认模拟完成', content = '确认本次交接已完成？信用分增加 2 分（最高 120 分），不发生付款。本次预约只计分一次。';
    if (action === 'cancelled') { title = '取消这次预约'; content = cancellationNote(order.meeting_at) + (Number(order.meeting_at) > Date.now() ? ' 取消后可在商品详情重新预约。' : ' 这次预约将结束，不能重约。') + '实际扣分以确认时的时间为准。'; }
    if (action === 'no_show') { title = '确认模拟本人爽约'; content = '这会将本次预约标记为已爽约，扣除你自己 10 分，写入信用记录；本次订单不能重约。不会给卖家扣分。'; }
    this.setData({ saving: true });
    wx.showModal({ title, content, confirmText: action === 'completed' ? '确认完成' : action === 'cancelled' ? '取消预约' : '本人爽约', confirmColor: action === 'no_show' ? '#aa563e' : '#2c624c', success: result => {
      if (!result.confirm || this._disposed) return;
      if (this.data.school.id !== schoolId || getApp().globalData.schoolId !== schoolId) { wx.showToast({ title: '学校已切换，请重新查看预约', icon: 'none' }); return; }
      try { const updated = experience().transitionOrder(order.id, schoolId, action, attempt); this.refreshDashboard(); wx.showToast({ title: updated.status === 'no_show' ? '已按规则记录本人爽约' : updated.status === 'completed' ? '已记录模拟完成' : '预约已取消', icon: 'none' }); }
      catch (error) { this.refreshDashboard(); wx.showToast({ title: error.message || '操作未保存，请重试', icon: 'none' }); }
    }, complete: () => { if (!this._disposed) { this.setData({ saving: false }); this.scheduleAuctionRefresh(); } } });
  },
  clearHistory() {
    if (this.isBusy() || !this.data.trails.length) return;
    const schoolId = this.data.school.id;
    this.setData({ saving: true });
    wx.showModal({ title: '清空本校浏览足迹', content: '仅清除这台设备中' + this.data.school.name + '的浏览记录，其他学校、收藏与订单不受影响。', confirmText: '清空足迹', success: result => {
      if (!result.confirm || this._disposed) return;
      if (this.data.school.id !== schoolId || getApp().globalData.schoolId !== schoolId) { wx.showToast({ title: '学校已切换，请重新确认清理范围', icon: 'none' }); return; }
      try { experience().clearTrails(schoolId); this.refreshDashboard(); wx.showToast({ title: '本校足迹已清空', icon: 'none' }); }
      catch (error) { wx.showToast({ title: error.message || '清空失败，请重试', icon: 'none' }); }
    }, complete: () => { if (!this._disposed) this.setData({ saving: false }); } });
  },
  changeSimulation(event) { const index = Number(event.detail.value); if (Number.isInteger(index) && ruleRows[index]) { this.setData({ simulationIndex: index }); this.updateSimulation(); } },
  updateSimulation() { if (!this.data.credit) return; const score = Math.max(0, Math.min(120, this.data.credit.score + ruleRows[this.data.simulationIndex].delta)); this.setData({ projectedScore: score, projectedLimit: score >= 80 ? 3 : score >= 60 ? 1 : 0 }); },
  calendar(event) {
    if (this.isBusy()) return;
    const shown = this.data.orders.find(row => row.id === event.currentTarget.dataset.id);
    if (!shown || shown.status !== 'reserved') return;
    const schoolId = this.data.school.id;
    let order;
    try { order = experience().getOrders(schoolId).find(row => row.id === shown.id); }
    catch (error) { this.refreshDashboard(); wx.showToast({ title: error.message || '预约读取失败，请重试', icon: 'none' }); return; }
    if (!order || order.status !== 'reserved' || order.attempt !== shown.attempt) { this.refreshDashboard(); wx.showToast({ title: '预约已更新，请重新查看', icon: 'none' }); return; }
    if (typeof wx.shareFileMessage !== 'function') {
      this.setData({ calendarBusy: true });
      wx.showModal({ title: '会面日历信息', content: '当前微信版本不支持分享日历文件，可复制预约信息手动添加。', confirmText: '复制信息', success: result => { if (result.confirm && !this._disposed && this.data.school.id === schoolId) this.copyOrder(order, true); }, complete: () => { if (!this._disposed) this.setData({ calendarBusy: false }); } }); return;
    }
    const filePath = wx.env.USER_DATA_PATH + '/txj-calendar-' + String(order.id).replace(/[^a-zA-Z0-9_-]/g, '') + '-' + order.attempt + '.ics';
    const clean = () => { try { wx.getFileSystemManager().unlink({ filePath, fail() {} }); } catch (error) { /* Best effort cleanup of this generated file only. */ } };
    const finish = () => { clean(); if (!this._disposed) { this.setData({ calendarBusy: false }); this.scheduleAuctionRefresh(); } };
    this.setData({ calendarBusy: true });
    try {
      wx.getFileSystemManager().writeFile({ filePath, data: makeCalendar(order), encoding: 'utf8', success: () => {
        if (this._disposed) { clean(); return; }
        try {
          const current = this.data.school.id === schoolId && getApp().globalData.schoolId === schoolId && experience().getOrders(schoolId).find(row => row.id === order.id);
          if (!current || current.status !== 'reserved' || current.attempt !== order.attempt || current.meeting_at !== order.meeting_at || current.place !== order.place) { finish(); wx.showToast({ title: '预约已更新，日历文件未分享', icon: 'none' }); return; }
          wx.shareFileMessage({ filePath, fileName: '同校集见面预约.ics', success: () => { if (!this._disposed) wx.showToast({ title: '日历文件已分享，请自行导入', icon: 'none' }); }, fail: result => { if (!this._disposed && !/cancel/i.test(result.errMsg || '')) wx.showToast({ title: '分享失败，可复制预约信息', icon: 'none' }); }, complete: finish });
        } catch (error) { finish(); if (!this._disposed) wx.showToast({ title: error.message || '分享日历文件失败', icon: 'none' }); }
      }, fail: () => { finish(); if (!this._disposed) wx.showToast({ title: '日历文件未保存，可复制预约信息', icon: 'none' }); } });
    } catch (error) { finish(); if (!this._disposed) wx.showToast({ title: '无法生成日历文件', icon: 'none' }); }
  },
  copyOrder(order, onlyActive) {
    if (this._disposed || !order || order.school_id !== this.data.school.id) return;
    try {
      const current = experience().getOrders(this.data.school.id).find(row => row.id === order.id);
      if (!current || onlyActive && (current.status !== 'reserved' || current.attempt !== order.attempt)) { this.refreshDashboard(); wx.showToast({ title: '预约已更新，请重新查看', icon: 'none' }); return; }
      wx.setClipboardData({ data: '同校集模拟预约：' + current.title + '\n状态：' + statusLabels[current.status] + '\n时间：' + dateText(current.meeting_at) + '\n地点：' + current.place + '\n约定价格：¥' + money(current.price_cents) + '\n仅课堂演示，不涉及付款；请以小程序内最新预约为准。', fail: () => { if (!this._disposed) wx.showToast({ title: '未能复制预约，请重试', icon: 'none' }); } });
    } catch (error) { this.refreshDashboard(); wx.showToast({ title: error.message || '预约信息读取失败，未复制', icon: 'none' }); }
  },
  copyAppointment(event) { const order = this.data.orders.find(row => row.id === event.currentTarget.dataset.id); if (order) this.copyOrder(order); },
  hasUnsavedChanges() { const saved = this.data.profileInfo; return this._loaded && (this.data.nickname.trim() !== saved.nickname || majors[this.data.majorIndex] !== saved.major || this.data.draftAvatar !== saved.avatar || this.data.demoVerified !== saved.demo_verified); },
  leavePage(navigate) { mainNav.leaveWithConfirmation(this, { changed: this.hasUnsavedChanges(), blocked: () => this.isBusy(), content: '资料修改还没有保存，离开后将保留上次保存的资料。', navigate }); },
  publishMore() { this.leavePage(fail => mainNav.navigateMain('publish', { fail })); },
  browseMarket() { this.leavePage(fail => mainNav.navigateMain('market', { fail })); },
  browseAuctions() { this.leavePage(fail => wx.reLaunch({ url: '/pages/browse/browse?section=market&marketTab=auctions', fail })); },
  onMainNav(event) { const tab = event.detail.tab; if (tab === 'mine' || !mainNav.routes[tab]) return; this.leavePage(fail => mainNav.navigateMain(tab, { fail })); },
  onSchoolChanged() { this.onShow(); },
  toggleEditor() { if (this.isBusy()) return; this.setData({ editing: !this.data.editing }); },
  about() { wx.showModal({ title: '关于同校集课堂体验', content: '本版是微信原生本机演示。账号资料、发布、收藏、足迹、刷题、聊天与模拟预约仅保存在这台设备，与网页及其他设备分别保存。认证不核验真实身份，聊天为演示自动回复；交易不收款、不锁定真实库存。预置商品照片为同类实物参考图，照片许可见项目 assets/photos/SOURCE-LICENSES.md。', showCancel: false, confirmText: '了解了' }); },
  returnHome() { this.leavePage(fail => wx.reLaunch({ url: '/pages/index/index', fail })); }
});
