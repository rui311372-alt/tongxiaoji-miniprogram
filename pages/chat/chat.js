const community = require('../../utils/community');
const photoMap = require('../../utils/photo-map');
function timeLabel(value) { const date = new Date(value); const pad = n => String(n).padStart(2, '0'); return Number.isFinite(date.getTime()) ? pad(date.getHours()) + ':' + pad(date.getMinutes()) : ''; }
Page({
  data: { thread: null, messages: [], draft: '', error: '', sending: false, canSend: false, anchor: '', photo: '', productPrice: '', isMine: false, viewportHeight: 0, keyboardHeight: 0, keyboardOpen: false, inputFocused: false, questions: [{label:'聊聊价格',text:'价格可以再便宜一点吗？'},{label:'问瑕疵与验货',text:'有哪些瑕疵和配件，现场怎么验货？'},{label:'约个见面地点',text:'你好，还在吗？可以约在哪里见面？'}] },
  onLoad(options) {
    this.threadId = options.id || ''; this._disposed = false;
    try { const size = typeof wx.getWindowInfo === 'function' ? wx.getWindowInfo() : typeof wx.getSystemInfoSync === 'function' ? wx.getSystemInfoSync() : null; if (size && Number.isFinite(size.windowHeight) && size.windowHeight > 0) this.setData({viewportHeight:size.windowHeight}); } catch(error) { /* CSS height remains available if metrics cannot be read. */ }
    this.refresh();
  },
  onShow() { if (this.threadId) this.refresh(); },
  onUnload() { this._disposed = true; },
  applyThread(thread) {
    const messages = thread.messages.map(row => Object.assign({}, row, { time: timeLabel(row.created_at) }));
    const isMine = Boolean(thread.product.isLocal);
    this.setData({ thread, messages, error: '', photo: photoMap[thread.product.image] || thread.product.image || '', isMine, productPrice: (Number(thread.product.price_cents || 0) / 100).toFixed(2).replace(/\.00$/, ''), canSend: !isMine && Boolean(this.data.draft.trim()), anchor: messages.length ? 'message-' + messages[messages.length - 1].id : '' });
  },
  refresh() {
    try { const thread = community.getThread(this.threadId); if (thread.school_id !== getApp().globalData.schoolId) throw new Error('会话属于其他学校，请返回消息列表。'); this.applyThread(thread); wx.setNavigationBarTitle({ title: '模拟会话' }); }
    catch (error) { this.setData({ thread: null, messages: [], error: error.message || '会话读取失败。', canSend: false }); }
  },
  input(event) { const draft = event.detail.value; this.setData({ draft, canSend: !this.data.isMine && Boolean(draft.trim()) }); },
  quickQuestion(event) { if (this.data.sending || this.data.isMine) return; const text = event.currentTarget.dataset.question; if (!this.data.questions.some(row => row.text === text)) return; this.setData({ draft: text, canSend: true, inputFocused: true }); },
  focusInput(event) { this.setData({inputFocused:true}); if(event.detail && Number.isFinite(event.detail.height) && event.detail.height > 0) this.onKeyboardHeightChange(event); },
  blurInput() { if (!this.data.keyboardHeight) this.setData({inputFocused:false}); },
  onKeyboardHeightChange(event) { const height = Number(event.detail && event.detail.height); if (this._disposed || !Number.isFinite(height)) return; const maximum = this.data.viewportHeight ? Math.max(0, this.data.viewportHeight - 160) : 600; const keyboardHeight = Math.max(0, Math.min(height,maximum)); this.setData({keyboardHeight,keyboardOpen:keyboardHeight>0,inputFocused:keyboardHeight>0}); },
  openProduct() { if(this.data.thread) wx.navigateTo({url:'/pages/detail/detail?section=market&school='+encodeURIComponent(this.data.thread.school_id)+'&id='+encodeURIComponent(this.data.thread.product_id)}); },
  photoError() { this.setData({photo:''}); },
  send() {
    if (this.data.sending || !this.data.thread || this.data.isMine) return;
    if(!this.data.draft.trim()) return;
    this.setData({ sending: true, error: '' });
    try { const thread = community.sendMessage(this.threadId, this.data.draft); this.setData({draft:'',canSend:false}); this.applyThread(thread); }
    catch (error) { this.setData({ error: error.message || '发送失败，请重试。' }); }
    this.setData({ sending: false });
  },
  goBack() { wx.navigateBack(); }
});
