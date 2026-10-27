function backToLibrary() {
  const pages = typeof getCurrentPages === 'function' ? getCurrentPages() : [];
  for (let index = pages.length - 2; index >= 0; index -= 1) {
    const page = pages[index];
    if (page.route === 'pages/browse/browse' && page.data.section === 'resources' && !page.data.topic) {
      wx.navigateBack({ delta: pages.length - 1 - index });
      return;
    }
  }
  wx.redirectTo({ url: '/pages/browse/browse?section=resources' });
}
module.exports = { backToLibrary };
