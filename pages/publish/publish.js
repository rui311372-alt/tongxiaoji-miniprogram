const { schools } = require('../../utils/catalog');
const { majors } = require('../../utils/majors');
const community = require('../../utils/community');
const files = require('../../utils/files');
const mainNav = require('../../utils/main-nav');
const tabs = [{ id: 'resource', label: '分享资料' }, { id: 'product', label: '发布闲置' }, { id: 'request', label: '求资料' }, { id: 'wanted', label: '求闲置' }];
function pad(n) { return String(n).padStart(2, '0'); }
function dateValue(date) { return date.getFullYear() + '-' + pad(date.getMonth() + 1) + '-' + pad(date.getDate()); }
function timeValue(date) { return pad(date.getHours()) + ':' + pad(date.getMinutes()); }
function defaults() { const now = new Date(), tomorrow = new Date(Date.now() + 86400000); return { dateMin: dateValue(now), dateMax: dateValue(new Date(Date.now() + 15 * 86400000)), endDate: dateValue(tomorrow), endTime: timeValue(tomorrow) }; }
function sizeLabel(size) { return size >= 1024 * 1024 ? (size / 1024 / 1024).toFixed(1) + ' MB' : (size / 1024).toFixed(1) + ' KB'; }
function majorOptions(selected, keyword) { return majors.filter(name => !keyword || name.toLowerCase().includes(keyword.toLowerCase().trim())).map(name => ({ name, checked: selected.includes(name) })); }
function majorSelection() { const selectedMajors = [majors[0]]; return { selectedMajors, majorOptions: majorOptions(selectedMajors, ''), majorPickerOpen: false, majorKeyword: '', majorSummary: selectedMajors.join('、') }; }
function draftSnapshot(data) {
  const draft = {};
  Object.keys(data.draft).sort().forEach(key => { const value = String(data.draft[key] || '').trim(); if (value) draft[key] = value; });
  return JSON.stringify({ draft, majorIndex: data.majorIndex, selectedMajors: data.kind === 'resource' ? data.selectedMajors.slice().sort() : [], categoryIndex: data.categoryIndex, conditionIndex: data.conditionIndex, saleModeIndex: data.saleModeIndex, photos: data.photos.map(row => row.tempPath), attachment: data.attachment && data.attachment.tempPath, endDate: data.endDate, endTime: data.endTime });
}
Page({
  data: { school: schools[0], tabs, kind: 'resource', majors, majorIndex: 0, ...majorSelection(), categories: community.resourceCategories, categoryIndex: 0, conditions: community.conditions, conditionIndex: 0, saleModes: ['固定价格', '校园竞价'], saleModeIndex: 0, draft: { increment: '5' }, photos: [], attachment: null, confirmed: false, busy: false, checking: false, error: '', dateMin: '', dateMax: '', endDate: '', endTime: '' },
  onLoad(options) {
    this._disposed = false; this._generation = 0; this._pendingPaths = []; this.setData(defaults());
    if (tabs.some(row => row.id === options.kind)) this.chooseKind(options.kind);
    if (options.kind === 'auction') { this.chooseKind('product'); this.setData({ saleModeIndex: 1 }); }
    if (typeof options.course === 'string' && options.course.length <= 60) this.setData({ 'draft.course': options.course });
    this._draftBaseline = draftSnapshot(this.data);
  },
  onShow() {
    this._leaving = false;
    const school = schools.find(row => row.id === getApp().globalData.schoolId) || schools[0];
    if (this.data.school.id !== school.id) this.setData({ confirmed: false });
    this.setData({ school, dateMin: dateValue(new Date()), dateMax: dateValue(new Date(Date.now() + 15 * 86400000)) });
  },
  onUnload() { this._disposed = true; this._generation++; this.cleanPending(); },
  async cleanPending() {
    const paths = (this._pendingPaths || []).slice();
    for (const path of paths) if (await files.remove(path)) this._pendingPaths = this._pendingPaths.filter(item => item !== path);
  },
  chooseKind(kind) {
    this._generation++;
    this.setData(Object.assign({ kind, draft: { increment: '5' }, majorIndex: 0, categoryIndex: 0, conditionIndex: 0, saleModeIndex: 0, photos: [], attachment: null, confirmed: false, error: '', categories: kind === 'product' || kind === 'wanted' ? community.productCategories : community.resourceCategories }, majorSelection(), defaults()));
    this._draftBaseline = draftSnapshot(this.data);
  },
  changeKind(event) {
    if (this.data.busy || this.data.checking || event.currentTarget.dataset.kind === this.data.kind) return;
    const kind = event.currentTarget.dataset.kind;
    const changed = this.hasUnsavedChanges();
    if (!changed) { this.chooseKind(kind); return; }
    wx.showModal({ title: '切换发布类型', content: '当前未发布内容将清空，是否继续？', success: result => { if (result.confirm && !this._disposed) this.chooseKind(kind); } });
  },
  input(event) { if (!this.data.busy && !this.data.checking) this.setData({ ['draft.' + event.currentTarget.dataset.field]: event.detail.value, confirmed: false }); },
  select(event) {
    const key = event.currentTarget.dataset.field;
    if (this.data.busy || this.data.checking || ['majorIndex', 'categoryIndex', 'conditionIndex', 'saleModeIndex'].indexOf(key) < 0) return;
    this.setData({ [key]: Number(event.detail.value), confirmed: false });
  },
  toggleMajorPicker() { if (!this.data.busy && !this.data.checking) this.setData({ majorPickerOpen: !this.data.majorPickerOpen }); },
  searchMajors(event) { if (!this.data.busy && !this.data.checking) { const majorKeyword = String(event.detail.value || '').slice(0, 40); this.setData({ majorKeyword, majorOptions: majorOptions(this.data.selectedMajors, majorKeyword) }); } },
  changeMajors(event) {
    if (this.data.busy || this.data.checking || !Array.isArray(event.detail.value)) return;
    const visible = this.data.majorOptions.map(option => option.name);
    const checked = event.detail.value.filter(name => visible.includes(name));
    const selectedMajors = majors.filter(name => checked.includes(name) || this.data.selectedMajors.includes(name) && !visible.includes(name));
    this.setData({ selectedMajors, majorOptions: majorOptions(selectedMajors, this.data.majorKeyword), majorSummary: selectedMajors.join('、'), confirmed: false });
  },
  changeDate(event) { if (!this.data.busy) this.setData({ endDate: event.detail.value, confirmed: false }); },
  changeTime(event) { if (!this.data.busy) this.setData({ endTime: event.detail.value, confirmed: false }); },
  changeConfirmed(event) { if (!this.data.busy && !this.data.checking) this.setData({ confirmed: Array.isArray(event.detail.value) && event.detail.value.indexOf('confirmed') >= 0 }); },
  async choosePhoto() {
    if (this.data.busy || this.data.checking || this.data.photos.length >= 3) return;
    const generation = ++this._generation; this.setData({ checking: true, error: '' });
    try {
      const photo = await files.choosePhoto();
      if (!this._disposed && generation === this._generation && photo) this.setData({ photos: this.data.photos.concat(Object.assign({}, photo, { sizeLabel: sizeLabel(photo.size) })), confirmed: false });
    } catch (error) { if (!this._disposed && generation === this._generation) this.setData({ error: error.message || '照片选择失败，请重试。' }); }
    finally { if (!this._disposed && generation === this._generation) this.setData({ checking: false }); }
  },
  removePhoto(event) { if (!this.data.busy && !this.data.checking) { const index = Number(event.currentTarget.dataset.index); if (Number.isInteger(index)) this.setData({ photos: this.data.photos.filter((_, i) => i !== index), confirmed: false }); } },
  previewPhoto(event) { const urls = this.data.photos.map(row => row.tempPath); wx.previewImage({ current: event.currentTarget.dataset.path, urls }); },
  async chooseAttachment() {
    if (this.data.busy || this.data.checking) return;
    const generation = ++this._generation; this.setData({ checking: true, error: '' });
    try {
      const attachment = await files.chooseAttachment();
      if (!this._disposed && generation === this._generation && attachment) this.setData({ attachment: Object.assign({}, attachment, { sizeLabel: sizeLabel(attachment.size) }), confirmed: false });
    } catch (error) { if (!this._disposed && generation === this._generation) this.setData({ error: error.message || '资料选择失败，请重试。' }); }
    finally { if (!this._disposed && generation === this._generation) this.setData({ checking: false }); }
  },
  removeAttachment() { if (!this.data.busy && !this.data.checking) this.setData({ attachment: null, confirmed: false }); },
  async submit() {
    if (this.data.busy || this.data.checking) return;
    if (!this.data.confirmed) { this.setData({ error: '请先确认学校和内容无误，并勾选发布确认。' }); return; }
    this.setData({ busy: true, error: '' });
    let committed = false;
    try {
      await this.cleanPending();
      if (this._pendingPaths.length) throw new Error('上次发布的缓存尚未清理，请退出页面后重试。');
      if (this._disposed) throw new Error('页面已关闭，发布未保存。');
      const { kind, draft, school, majors, majorIndex, categories, categoryIndex, conditions, conditionIndex, saleModeIndex, endDate, endTime } = this.data;
      const data = Object.assign({}, draft, { school_id: school.id, major: majors[majorIndex], category: categories[categoryIndex], condition: conditions[conditionIndex] });
      if (kind === 'resource') {
        if (!this.data.selectedMajors.length || this.data.selectedMajors.some(name => !majors.includes(name))) throw new Error('请选择至少一个适用专业。');
        data.majors = this.data.selectedMajors.slice(); data.major = data.majors[0];
      }
      if (kind === 'resource' && !draft.body && !this.data.attachment) throw new Error('请填写资料正文，或选择一份资料文件。');
      if (kind === 'wanted') {
        if (!draft.budget || !/^\d+(\.\d{1,2})?$/.test(draft.budget) || Number(draft.budget) <= 0 || Number(draft.budget) > 99999) throw new Error('最高预算请输入 0.01—99999 元，最多两位小数。');
        if (!draft.place || !draft.place.trim()) throw new Error('请填写公共交接地点。');
      }
      if (kind === 'product') {
        data.sale_mode = saleModeIndex === 1 ? 'auction' : 'fixed';
        if (data.sale_mode === 'auction') {
          data.auction_end_at = new Date(endDate + 'T' + endTime + ':00').getTime();
          if (!Number.isFinite(data.auction_end_at) || data.auction_end_at <= Date.now() || data.auction_end_at > Date.now() + 15 * 86400000) throw new Error('竞价截止时间须在未来 15 天内。');
        }
        data.photos = [];
        for (const candidate of this.data.photos) {
          const saved = await files.keep(candidate); this._pendingPaths.push(saved.path);
          if (this._disposed) throw new Error('页面已关闭，发布未保存。');
          data.photos.push(saved.path);
        }
      }
      if (kind === 'resource' && this.data.attachment) {
        data.attachment = await files.keep(this.data.attachment); this._pendingPaths.push(data.attachment.path);
        if (this._disposed) throw new Error('页面已关闭，发布未保存。');
      }
      if (this._disposed) throw new Error('页面已关闭，发布未保存。');
      community.publish(kind, data); committed = true; this._pendingPaths = [];
      this.setData(Object.assign({ draft: { increment: '5' }, photos: [], attachment: null, confirmed: false, busy: false }, majorSelection()));
      this._draftBaseline = draftSnapshot(this.data);
      wx.showToast({ title: '已发布到本机', icon: 'success' });
      const section = kind === 'resource' || kind === 'request' ? 'resources' : 'market';
      const suffix = kind === 'request' ? '&libraryTab=requests' : kind === 'wanted' ? '&marketTab=wanted' : kind === 'product' && data.sale_mode === 'auction' ? '&marketTab=auctions' : '';
      wx.reLaunch({ url: '/pages/browse/browse?section=' + section + suffix });
    } catch (error) {
      if (!committed) await this.cleanPending();
      if (!this._disposed) this.setData({ busy: false, error: (error.message || '发布失败，请重试。') + (this._pendingPaths.length ? ' 部分本机缓存尚未清理，退出页面后会再次尝试。' : '') });
    }
  },
  onSchoolChanged() { this.onShow(); this.setData({ confirmed: false }); },
  hasUnsavedChanges() { return draftSnapshot(this.data) !== this._draftBaseline; },
  leavePage(navigate) { mainNav.leaveWithConfirmation(this, { changed: this.hasUnsavedChanges(), blocked: () => this.data.busy || this.data.checking, content: '当前发布内容还没有保存，离开后需要重新填写。', navigate }); },
  returnHome() { this.leavePage(fail => wx.reLaunch({ url: '/pages/index/index', fail })); },
  onMainNav(event) { const tab = event.detail.tab; if (tab === 'publish' || !mainNav.routes[tab]) return; this.leavePage(fail => mainNav.navigateMain(tab, { fail })); }
});
