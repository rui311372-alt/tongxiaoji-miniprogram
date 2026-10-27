const { schools } = require('../../utils/catalog');
const guides = require('../../utils/guides');
Page({
  data: { greeting: '', waving: false, schools, schoolIndex: 0, school: schools[0], schoolHint: '', navigating: false },
  onLoad(options) { if(options && schools.some(s=>s.id===options.school)) getApp().globalData.schoolId=options.school; },
  onShow() {
    this._disposed = false;
    this.setData({ navigating: false });
    const index = schools.findIndex(s => s.id === getApp().globalData.schoolId);
    this.selectSchool(index < 0 ? 0 : index);
    this.startWave();
  },
  selectSchool(index) {
    const school = schools[index];
    if (!school) return;
    getApp().globalData.schoolId = school.id;
    this.setData({ schoolIndex: index, school, schoolHint: '' });
    try { wx.setStorageSync('txj.school.v1', school.id); } catch (error) { this.setData({ schoolHint: '本次选校已生效，偏好暂未保存。' }); }
  },
  onSchoolChange(event) { this.selectSchool(Number(event.detail.value)); },
  startWave() {
    if (this._disposed || this.data.waving) return;
    this.setData({ waving: true });
    this._waveTimer = setTimeout(() => {
      this._waveTimer = null;
      if (!this._disposed) this.setData({ waving: false });
    }, 1200);
  },
  greet() {
    this.startWave();
    const lines = ['你好呀，我是小集。','今天想找点什么？','先选学校，再一起逛逛吧。'];
    this._greetingIndex = (this._greetingIndex || 0);
    this.setData({ greeting: lines[this._greetingIndex++ % lines.length] });
    if (this._greetingTimer) clearTimeout(this._greetingTimer);
    this._greetingTimer = setTimeout(() => this.setData({ greeting: '' }), 2800);
  },
  onHide() {
    if (this._greetingTimer) clearTimeout(this._greetingTimer);
    if (this._waveTimer) clearTimeout(this._waveTimer);
    this._waveTimer = null;
    this.setData({ greeting: '', waving: false });
  },
  onUnload() {
    this._disposed = true;
    if (this._greetingTimer) clearTimeout(this._greetingTimer);
    if (this._waveTimer) clearTimeout(this._waveTimer);
  },
  navigate(url) {
    if (this.data.navigating || this._disposed) return;
    this.setData({ navigating: true });
    wx.navigateTo({ url, fail: () => { if (!this._disposed) { this.setData({ navigating: false }); wx.showToast({ title: '页面未能打开，请重试', icon: 'none' }); } } });
  },
  showGuides() {
    wx.showActionSheet({ itemList: guides.map(g => g.title), success: result => {
      const guide = guides[result.tapIndex];
      if (guide) wx.showModal({ title: guide.title, content: guide.steps.map((step, index) => (index + 1) + '. ' + step.title + '\n' + step.body).join('\n\n'), showCancel: false });
    }});
  },
  openSection(event) {
    const section = event.currentTarget.dataset.section === 'market' ? 'market' : 'resources';
    this.navigate('/pages/browse/browse?section=' + section);
  }
});
