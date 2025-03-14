export const containsKeyword = (str: string | number | undefined, keyword: string): boolean => {
  if (typeof str === 'undefined') return false; // 如果 str 是 undefined，返回 false
  return str?.toString()?.toLowerCase()?.includes(keyword.toLowerCase()); // 检查 str 是否包含关键字
};