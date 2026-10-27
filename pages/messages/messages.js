const { schools } = require('../../utils/catalog');
const community = require('../../utils/community');
const photoMap = require('../../utils/photo-map');
const removal = require('../../utils/chat-removal');
Page({
  data: { school: schools[0], threads: [], error: '', actionError: '', busy: false, managing: false },
  onShow() {
    this._active = true; this._disposed = false;
    removal.cancelPending(this);
    this.setData({ school: schools.find(row => row.id === getApp().globalData.schoolId) || schools[0], actionError: '', managing: false });
    this.refresh();
  },
  onHide() { this._active = false; removal.cancelPending(this); },
  onUnload() { this._disposed = true; removal.cancelPending(this); },
  refresh() {
    try {
      const threads = community.getThreads(this.data.school.id).map(row => {
        const date = new Date(row.updated_at);
        const pad = n => String(n).padStart(2, '0');
        return { id: row.id, title: row.product.title, photo: photoMap[row.product.image] || row.product.image || '', schoolName: this.data.school.name, last: row.messages.length ? row.messages[row.messages.length - 1].text : '暂无消息，可继续咨询', time: !row.messages.length ? '' : Number.isFinite(date.getTime()) && date.getTime() > 0 ? pad(date.getMonth() + 1) + '-' + pad(date.getDate()) + ' ' + pad(date.getHours()) + ':' + pad(date.getMinutes()) : '历史会话' };
      });
      this.setData({ threads, error: '', managing: threads.length > 0 && this.data.managing });
    } catch (error) { this.setData({ threads: [], managing: false, error: error.message || '消息读取失败，请重试。' }); }
  },
  toggleManage() { if (!this.data.busy && !this.data.error && this.data.threads.length) this.setData({ managing: !this.data.managing, actionError: '' }); },
  deleteThread(event) {
    const row = this.data.threads.find(item => item.id === event.currentTarget.dataset.id);
    if (!row || this.data.error) return;
    const schoolId = this.data.school.id;
    removal.confirmRemoval(this, {
      title: '删除这段会话？', content: '将删除“' + row.title + '”的会话及全部本机聊天记录，删除后无法恢复。', schoolId,
      valid: () => this.data.school.id === schoolId && this.data.threads.some(item => item.id === row.id),
      commit: () => community.deleteThread(row.id, schoolId), onSuccess: () => this.refresh()
    });
  },
  clearThreads() {
    if (!this.data.threads.length || this.data.error) return;
    const schoolId = this.data.school.id;
    removal.confirmRemoval(this, {
      title: '清空本校会话？', content: '将删除' + this.data.school.name + '的全部 ' + this.data.threads.length + ' 个会话及聊天记录，无法恢复。其他学校的会话和发布、收藏不受影响。',
      schoolId, confirmText: '清空', successText: '本校会话已清空', valid: () => this.data.school.id === schoolId,
      commit: () => community.clearThreads(schoolId), onSuccess: () => this.refresh()
    });
  },
  open(event) { if (!this.data.busy && !this.data.managing) wx.navigateTo({ url: '/pages/chat/chat?id=' + encodeURIComponent(event.currentTarget.dataset.id) }); },
  photoError(event) { const id = event.currentTarget.dataset.id; this.setData({threads:this.data.threads.map(row=>row.id===id?Object.assign({},row,{photo:''}):row)}); },
  goMarket() { require('../../utils/main-nav').navigateMain('market'); },
  onSchoolChanged() { this.onShow(); },
  onMainNav(event) { if (!this.data.busy && event.detail.tab !== 'messages') require('../../utils/main-nav').navigateMain(event.detail.tab); }
});
