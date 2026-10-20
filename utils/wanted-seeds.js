// 复用网站已有求闲置课堂案例，非真实求购，也不计入本机“我的发布”。
const { schools } = require('./catalog');
const tianjin = [
  ['想收一台考试用科学计算器', '数码设备', '工程数学考试需要无编程功能的计算器，按键正常、屏幕清楚即可。', 4500],
  ['求一本高等数学下册', '书籍教材', '想收同济版高数下册，少量笔记可以接受，方便在北洋园交接。', 1800],
  ['求一个宿舍桌面小书架', '宿舍好物', '桌面空间比较小，宽度 50 厘米以内，能拆卸优先。', 3000],
  ['求二手羽毛球拍一起运动', '出行运动', '初学者练习使用，希望球拍没有裂纹，可以约体育馆门口验货。', 8000],
  ['想收轻便的通勤自行车', '出行运动', '北洋园校内代步，希望刹车正常，可现场试骑，不需要邮寄。', 20000],
  ['求一个 USB-C 扩展坞', '数码设备', '主要用来连接投影和 U 盘，需要 HDMI 接口，当面测试。', 5500]
];
const common = [['求一本课程教材或复习用书', '书籍教材', '想收本学期课程相关教材，书页完整即可，可在校内当面交接。', 2500]];
module.exports = schools.reduce((rows, school) => rows.concat((school.id === 'tianjin' ? tianjin : common).map((item, index) => ({ id: 'wanted-sample-' + school.id + '-' + index, school_id: school.id, title: item[0], category: item[1], description: item[2], budget_cents: item[3], place: school.id === 'tianjin' ? '北洋园图书馆门口' : '学校图书馆门口', status: 'open', isLocal: false, author_name: '课堂示例' }))), []);
