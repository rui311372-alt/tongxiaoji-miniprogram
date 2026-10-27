const routes = {
  library: '/pages/browse/browse?section=resources',
  market: '/pages/browse/browse?section=market',
  publish: '/pages/publish/publish',
  messages: '/pages/messages/messages',
  mine: '/pages/profile/profile'
};
function navigateMain(tab, handlers) {
  const url = routes[tab];
  if (!url) return false;
  wx.reLaunch(Object.assign({}, handlers || {}, { url }));
  return true;
}
// Keep a draft in memory until the user explicitly chooses to leave.
// Navigation failures release the latch so the same draft can be retried.
function leaveWithConfirmation(page, options) {
  const blocked = () => page._disposed || page._leaving || (options.blocked && options.blocked());
  if (blocked() || page._leavePrompt) return;
  const go = () => {
    if (blocked()) return;
    page._leaving = true;
    const fail = () => {
      page._leaving = false;
      if (!page._disposed) wx.showToast({ title: '页面未能打开，内容仍保留', icon: 'none' });
    };
    try { options.navigate(fail); } catch (error) { fail(); }
  };
  if (!options.changed) { go(); return; }
  page._leavePrompt = true;
  try {
    wx.showModal({
      title: '有内容尚未保存', content: options.content || '离开后，当前未保存的内容将丢失。',
      confirmText: '离开', cancelText: '继续编辑',
      success: result => { if (result.confirm) go(); },
      complete: () => { page._leavePrompt = false; }
    });
  } catch (error) { page._leavePrompt = false; }
}
module.exports = { navigateMain, routes, leaveWithConfirmation };
