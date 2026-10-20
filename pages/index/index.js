const { schools } = require('../../utils/catalog');
const guides = require('../../utils/guides');
Page({
  data: { greeting: '', schools, schoolIndex: 0, school: schools[0], schoolHint: '' },
  onLoad(options) { if(options && schools.some(s=>s.id===options.school)) getApp().globalData.schoolId=options.school; },
  onShow() {
    const index = schools.findIndex(s => s.id === getApp().globalData.schoolId);
    this.selectSchool(index < 0 ? 0 : index);
  },
  selectSchool(index) {
    const school = schools[index];
    if (!school) return;
    getApp().globalData.schoolId = school.id;
    this.setData({ schoolIndex: index, school, schoolHint: '' });
    try { wx.setStorageSync('txj.school.v1', school.id); } catch (error) { this.setData({ schoolHint: '本次选校已生效，偏好暂未保存。' }); }
  },
  onSchoolChange(event) { this.selectSchool(Number(event.detail.value)); },
  greet() {
    const lines = ['你好呀，我是小集。','今天想找点什么？','先选学校，再一起逛逛吧。'];
    this._greetingIndex = (this._greetingIndex || 0);
    this.setData({ greeting: lines[this._greetingIndex++ % lines.length] });
    if (this._greetingTimer) clearTimeout(this._greetingTimer);
    this._greetingTimer = setTimeout(() => this.setData({ greeting: '' }), 2800);
  },
  onUnload() { if (this._greetingTimer) clearTimeout(this._greetingTimer); },
  showGuides() {
    wx.showActionSheet({ itemList: guides.map(g => g.title), success: result => {
      const guide = guides[result.tapIndex];
      if (guide) wx.showModal({ title: guide.title, content: guide.steps.map((step, index) => (index + 1) + '. ' + step.title + '\n' + step.body).join('\n\n'), showCancel: false });
    }});
  },
  openSection(event) {
    const section = event.currentTarget.dataset.section === 'market' ? 'market' : 'resources';
    wx.navigateTo({ url: '/pages/browse/browse?section=' + section });
  }
});
