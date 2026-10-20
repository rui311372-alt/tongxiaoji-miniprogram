const routes = {
  library: '/pages/browse/browse?section=resources',
  market: '/pages/browse/browse?section=market',
  publish: '/pages/publish/publish',
  messages: '/pages/messages/messages',
  mine: '/pages/profile/profile'
};
function navigateMain(tab) {
  const url = routes[tab];
  if (!url) return false;
  wx.reLaunch({ url });
  return true;
}
module.exports = { navigateMain, routes };
