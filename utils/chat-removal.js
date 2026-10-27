// Destructive actions only run for the page/school that opened the confirmation.
function cancelPending(page) {
  page._chatRemoval = null;
  if (!page._disposed) page.setData({ busy: false });
}
function confirmRemoval(page, options) {
  if (page._disposed || page._active === false || page.data.busy || page.data.sending) return;
  const token = { used: false };
  page._chatRemoval = token;
  page.setData({ busy: true, actionError: '' });
  const active = () => !page._disposed && page._active !== false && page._chatRemoval === token;
  const finish = () => { if (active()) cancelPending(page); };
  try {
    wx.showModal({
      title: options.title, content: options.content,
      confirmText: options.confirmText || '删除', cancelText: '取消', confirmColor: '#b54c40',
      success: result => {
        if (!active() || token.used || !result.confirm) return;
        token.used = true;
        if (getApp().globalData.schoolId !== options.schoolId || (options.valid && !options.valid())) return;
        try {
          const value = options.commit();
          options.onSuccess(value);
          wx.showToast({ title: options.successText || '已删除', icon: 'success' });
        } catch (error) { page.setData({ actionError: error.message || '删除失败，记录仍保留，请重试。' }); }
      },
      fail: () => { if (active()) page.setData({ actionError: '未能打开确认窗口，请重试。' }); },
      complete: finish
    });
  } catch (error) {
    if (active()) page.setData({ actionError: '未能打开确认窗口，请重试。' });
    finish();
  }
}
module.exports = { confirmRemoval, cancelPending };
