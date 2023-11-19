export const containsKeyword = (str: string | number | undefined, keyword: string): boolean => {
  if (typeof str === 'undefined') return false;
  return str?.toString()?.toLowerCase()?.includes(keyword.toLowerCase());
};
