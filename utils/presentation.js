const community = require('./community');
const photoMap = require('./photo-map');
const experience = require('./experience');
const store = require('./store');
const discovery = require('./discovery-data');
const money = cents => (Number(cents || 0) / 100).toFixed(2).replace(/\.00$/, '');
function getProducts() {
  const overlays = experience.getAuctionProducts();
  const map = new Map(overlays.map(x => [x.id || x.product_id, x]));
  return community.getProducts().map(x => Object.assign({}, x, map.get(x.id) || {}));
}
function photo(item) { return photoMap[item.image] || item.image || ''; }
function rating(item, summary) {
  const real=summary && summary.count>0 && summary.average>=1 && summary.average<=5;
  const value=real?summary.average:Number(item.demoScore || 0);
  return { hasScore: value>0, scoreValue: value, scorePercent:Math.max(0,Math.min(100,value*20)), scoreLabel: value>0?value.toFixed(1):'待评分', scoreSource:real?'同学评分':value>0?'综合评分':'暂无评价', isDemoScore:!real&&value>0, ratingCount:real?summary.count:0 };
}
function author(item) {
  if(item.isLocal) { const p=store.getProfile(), c=experience.getCredit(item.school_id); return {name:p.nickname,credit:c.score,creditLabel:c.level,isDemo:false}; }
  const p=discovery.authors[item.id];
  return {name:p?p.nickname:(item.author_name || '同校同学'),credit:100,creditLabel:'初始信用 · 示例',isDemo:true};
}
module.exports={getProducts,photo,money,rating,author};
