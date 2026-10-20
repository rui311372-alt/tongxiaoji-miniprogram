const { schools } = require('../../utils/catalog');
const community = require('../../utils/community');
const photoMap = require('../../utils/photo-map');
Page({
  data: { school: schools[0], threads: [], error: '' },
  onShow() { this.setData({ school: schools.find(row => row.id === getApp().globalData.schoolId) || schools[0] }); this.refresh(); },
  refresh() {
    try {
      const threads = community.getThreads(this.data.school.id).map(row => {
        const date = new Date(row.updated_at);
        const pad = n => String(n).padStart(2, '0');
        return { id: row.id, title: row.product.title, photo: photoMap[row.product.image] || row.product.image || '', schoolName: this.data.school.name, last: row.messages.length ? row.messages[row.messages.length - 1].text : '点击查看咨询记录', time: Number.isFinite(date.getTime()) && date.getTime() > 0 ? pad(date.getMonth() + 1) + '-' + pad(date.getDate()) + ' ' + pad(date.getHours()) + ':' + pad(date.getMinutes()) : '历史会话' };
      });
      this.setData({ threads, error: '' });
    } catch (error) { this.setData({ error: error.message || '消息读取失败，请重试。' }); }
  },
  open(event) { wx.navigateTo({ url: '/pages/chat/chat?id=' + encodeURIComponent(event.currentTarget.dataset.id) }); },
  photoError(event) { const id = event.currentTarget.dataset.id; this.setData({threads:this.data.threads.map(row=>row.id===id?Object.assign({},row,{photo:''}):row)}); },
  goMarket() { require('../../utils/main-nav').navigateMain('market'); },
  onSchoolChanged() { this.onShow(); },
  onMainNav(event) { require('../../utils/main-nav').navigateMain(event.detail.tab); }
});
