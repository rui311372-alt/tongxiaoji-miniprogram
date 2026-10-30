// New resource records can target several majors; older records keep one major.
function getResourceMajors(item) {
  if (!item || typeof item !== 'object') return [];
  const values = Array.isArray(item.majors) && item.majors.length ? item.majors : [item.major];
  return values.filter((value, index) => typeof value === 'string' && value.trim() && values.indexOf(value) === index);
}
module.exports = { getResourceMajors };
