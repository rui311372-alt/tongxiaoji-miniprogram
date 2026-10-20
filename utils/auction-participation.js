// Pure view model: read supplied auction snapshots and orders, never write participation or credit.
const SELF = 'current-local-student';
const orderLabels = { reserved: '中拍 · 已预约', completed: '中拍 · 已完成', cancelled: '中拍 · 预约已取消', no_show: '中拍 · 已爽约' };
function timestamp(value) { const time = typeof value === 'number' ? value : Date.parse(value); return Number.isFinite(time) ? time : 0; }
function positiveCents(value) { return Number.isInteger(value) && value > 0; }
function deriveParticipation(products, orders, schoolId, now) {
  if (!Array.isArray(products) || !Array.isArray(orders) || typeof schoolId !== 'string') throw new Error('拍卖参与记录暂时无法读取。');
  const currentTime = Number.isFinite(now) ? now : Date.now(), seen = new Set(), rows = [];
  products.forEach(product => {
    if (!product || product.school_id !== schoolId || product.isLocal || typeof product.id !== 'string') return;
    const auction = product.auction;
    if (!auction || auction.school_id !== schoolId || auction.product_id !== product.id || auction.isOwner || seen.has(product.id)) return;
    const bids = (Array.isArray(auction.bids) ? auction.bids : []).filter(bid => bid && bid.isMine === true && bid.demo !== true && (!bid.bidder_id || bid.bidder_id === SELF) && bid.school_id === schoolId && bid.product_id === product.id && (!bid.auction_id || bid.auction_id === auction.id) && positiveCents(bid.amount_cents));
    // Summaries are computed from all persisted own bids by experience, including bids outside the latest-30 preview.
    const summarized = Number.isInteger(auction.myBidCount) && auction.myBidCount > 0 && positiveCents(auction.myHighestBidCents);
    if (!summarized && !bids.length) return;
    const mineCents = summarized ? auction.myHighestBidCents : Math.max(...bids.map(bid => bid.amount_cents));
    const bidCount = summarized ? auction.myBidCount : bids.length;
    const lastBidAt = summarized && timestamp(auction.myLastBidAt) ? timestamp(auction.myLastBidAt) : Math.max(0, ...bids.map(bid => timestamp(bid.created_at)));
    const endAt = timestamp(auction.end_at);
    if (!endAt || !positiveCents(auction.current_cents)) return;
    const ended = endAt <= currentTime, won = ended && (auction.isWinner === true || auction.winner === SELF), leading = !ended && (auction.winner === SELF || (!auction.winner && mineCents === auction.current_cents));
    const order = orders.filter(row => row && row.school_id === schoolId && row.product_id === product.id && orderLabels[row.status]).sort((a, b) => Number(b.attempt || 0) - Number(a.attempt || 0) || timestamp(b.updated_at) - timestamp(a.updated_at))[0] || null;
    let status = ended ? won ? 'won_pending' : 'lost' : leading ? 'leading' : 'outbid';
    let statusLabel = ended ? won ? '已中拍 · 待预约' : '已结束 · 未中拍' : leading ? '竞拍中 · 我领先' : '竞拍中 · 已被超价';
    let action = won ? 'reserve' : 'auction', actionLabel = won ? '去预约见面' : '查看拍卖', note = ended ? won ? '中拍尚未生成预约，约好时间后才会出现在见面预约中。' : '没有生成见面预约，不计入待见面数量。' : '出价参与记录，不是预约订单；拍卖结束后确认结果。';
    if (won && order) {
      status = order.status; statusLabel = orderLabels[order.status]; action = order.status === 'cancelled' ? 'reserve' : 'order'; actionLabel = order.status === 'cancelled' ? '重新预约' : '查看预约记录';
      note = order.status === 'cancelled' ? '上一轮预约已取消，可在拍卖详情重新预约。' : order.status === 'reserved' ? '已关联一条待见面预约，下方可查看原预约，不会重复生成订单。' : order.status === 'completed' ? '已关联完成记录，本次拍卖不再重复预约。' : '已关联本人爽约记录，本次预约不能重约。';
    }
    seen.add(product.id);
    rows.push({ id: product.id, auction_id: auction.id, school_id: schoolId, title: product.title, image: product.image || '', current_cents: auction.current_cents, mine_cents: mineCents, my_bid_count: bidCount, last_bid_at: lastBidAt, end_at: endAt, ended, won, leading, status, statusLabel, action, actionLabel, note, order_id: won && order ? order.id : '', order_status: won && order ? order.status : '' });
  });
  return rows.sort((a, b) => b.last_bid_at - a.last_bid_at || a.end_at - b.end_at || a.id.localeCompare(b.id));
}
module.exports = { deriveParticipation };
