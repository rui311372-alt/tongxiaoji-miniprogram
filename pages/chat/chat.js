const community = require('../../utils/community');
const photoMap = require('../../utils/photo-map');
const removal = require('../../utils/chat-removal');
function timeLabel(value) { const date = new Date(value); const pad = n => String(n).padStart(2, '0'); return Number.isFinite(date.getTime()) ? pad(date.getHours()) + ':' + pad(date.getMinutes()) : ''; }
Page({
  data: { thread: null, messages: [], draft: '', error: '', actionError: '', busy: false, sending: false, canSend: false, anchor: '', photo: '', productPrice: '', isMine: false, viewportHeight: 0, keyboardHeight: 0, keyboardOpen: false, inputFocused: false, questions: [{label:'聊聊价格',text:'价格可以再便宜一点吗？'},{label:'问瑕疵与验货',text:'有哪些瑕疵和配件，现场怎么验货？'},{label:'约个见面地点',text:'你好，还在吗？可以约在哪里见面？'}] },
  onLoad(options) {
    this.threadId = options.id || ''; this._disposed = false; this._active = true;
    try { const size = typeof wx.getWindowInfo === 'function' ? wx.getWindowInfo() : typeof wx.getSystemInfoSync === 'function' ? wx.getSystemInfoSync() : null; if (size && Number.isFinite(size.windowHeight) && size.windowHeight > 0) this.setData({viewportHeight:size.windowHeight}); } catch(error) { /* CSS height remains available if metrics cannot be read. */ }
    this.refresh();
  },
  onShow() { this._active = true; removal.cancelPending(this); if (this.threadId) this.refresh(); },
  onHide() { this._active = false; removal.cancelPending(this); },
  onUnload() { this._disposed = true; removal.cancelPending(this); },
  applyThread(thread, followLatest) {
    const messages = thread.messages.map(row => Object.assign({}, row, { time: timeLabel(row.created_at) }));
    const isMine = Boolean(thread.product.isLocal);
    this.setData({ thread, messages, error: '', photo: photoMap[thread.product.image] || thread.product.image || '', isMine, productPrice: (Number(thread.product.price_cents || 0) / 100).toFixed(2).replace(/\.00$/, ''), canSend: !isMine && Boolean(this.data.draft.trim()), anchor: followLatest !== false && messages.length ? 'message-' + messages[messages.length - 1].id : '' });
  },
  refresh() {
    try { const thread = community.getThread(this.threadId); if (thread.school_id !== getApp().globalData.schoolId) throw new Error('会话属于其他学校，请返回消息列表。'); this.applyThread(thread); wx.setNavigationBarTitle({ title: '模拟会话' }); }
    catch (error) { this.setData({ thread: null, messages: [], error: error.message || '会话读取失败。', canSend: false }); }
  },
  input(event) { const draft = event.detail.value; this.setData({ draft, canSend: !this.data.isMine && Boolean(draft.trim()) }); },
  quickQuestion(event) { if (this.data.busy || this.data.sending || this.data.isMine) return; const text = event.currentTarget.dataset.question; if (!this.data.questions.some(row => row.text === text)) return; this.setData({ draft: text, canSend: true, inputFocused: true }); },
  focusInput(event) { this.setData({inputFocused:true}); if(event.detail && Number.isFinite(event.detail.height) && event.detail.height > 0) this.onKeyboardHeightChange(event); },
  blurInput() { if (!this.data.keyboardHeight) this.setData({inputFocused:false}); },
  onKeyboardHeightChange(event) { const height = Number(event.detail && event.detail.height); if (this._disposed || !Number.isFinite(height)) return; const maximum = this.data.viewportHeight ? Math.max(0, this.data.viewportHeight - 160) : 600; const keyboardHeight = Math.max(0, Math.min(height,maximum)); this.setData({keyboardHeight,keyboardOpen:keyboardHeight>0,inputFocused:keyboardHeight>0}); },
  openProduct() { if(!this.data.busy && this.data.thread) wx.navigateTo({url:'/pages/detail/detail?section=market&school='+encodeURIComponent(this.data.thread.school_id)+'&id='+encodeURIComponent(this.data.thread.product_id)}); },
  photoError() { this.setData({photo:''}); },
  clearRecords() {
    const thread = this.data.thread;
    if (!thread || !this.data.messages.length) return;
    removal.confirmRemoval(this, {
      title: '清空聊天记录？', content: '将删除当前会话的全部 ' + this.data.messages.length + ' 条本机消息，无法恢复。会话保留，可以继续聊天。',
      schoolId: thread.school_id, confirmText: '清空', successText: '聊天记录已清空',
      valid: () => this.threadId === thread.id && Boolean(this.data.thread),
      commit: () => community.clearThreadMessages(thread.id, thread.school_id), onSuccess: value => this.applyThread(value, false)
    });
  },
  deleteMessage(event) {
    const thread = this.data.thread;
    const message = this.data.messages.find(row => row.id === event.currentTarget.dataset.id);
    if (!thread || !message) return;
    removal.confirmRemoval(this, {
      title: '删除这条消息？', content: '“' + message.text.slice(0, 60) + (message.text.length > 60 ? '…' : '') + '”\n仅从本机删除这条消息，无法恢复。',
      schoolId: thread.school_id,
      valid: () => this.threadId === thread.id && Boolean(this.data.thread) && this.data.messages.some(row => row.id === message.id),
      commit: () => community.deleteMessage(thread.id, message.id, thread.school_id), onSuccess: value => this.applyThread(value, false)
    });
  },
  send() {
    if (this._disposed || this._active === false || this.data.busy || this.data.sending || !this.data.thread || this.data.isMine) return;
    if(!this.data.draft.trim()) return;
    this.setData({ sending: true, error: '', actionError: '' });
    try { const thread = community.sendMessage(this.threadId, this.data.draft); this.setData({draft:'',canSend:false}); this.applyThread(thread); }
    catch (error) { this.setData({ error: error.message || '发送失败，请重试。' }); }
    this.setData({ sending: false });
  },
  goBack() { wx.navigateBack(); }
});
