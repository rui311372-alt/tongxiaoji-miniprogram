const store=require('./store');
const sizes=[26,28,30,32,36],key='txj.reader-prefs.v1';
function getFont(){const value=store.read(key,{font:30});return value&&sizes.includes(value.font)?value.font:30;}
function setFont(font){if(!sizes.includes(font))throw new Error('请选择有效字号。');store.write(key,{font});return font;}
module.exports={sizes,getFont,setFont};
