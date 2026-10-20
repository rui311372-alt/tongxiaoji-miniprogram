// 原网页版 seedMarketPlus 的拍卖选品规则：每校最后一件，天津最后三件。
// 仅课堂案例，日期在 experience 初次初始化时落盘，不随刷新延长。
const catalog = require('./catalog');
const marketExpansion = require('./market-expansion');
const seeds = [];
catalog.schools.forEach(function (school) {
  const products = catalog.products.filter(function (p) { return p.school_id === school.id; });
  const chosen = products.slice(school.id === 'tianjin' ? -3 : -1);
  chosen.forEach(function (product, index) {
    const ended = school.id === 'tianjin' && index === 2;
    seeds.push({
      product_id: product.id,
      school_id: school.id,
      start_price_cents: product.price_cents,
      increment_cents: Math.max(100, Math.min(1000, Math.ceil(product.price_cents / 200) * 100)),
      hours: ended ? -1 : 3 + index,
      ended_example: ended
    });
  });
});
// 保留原23场的标识；新增场次仅在experience首次遇到它们时设置截止时间。
module.exports = seeds.concat(marketExpansion.auctionSeeds);
