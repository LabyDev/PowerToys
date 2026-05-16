export const formatBytes = (bytes: number, locale = navigator.language) => {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB", "TB", "PB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return (
    new Intl.NumberFormat(locale, { maximumFractionDigits: 2 }).format(
      bytes / Math.pow(k, i),
    ) + ` ${sizes[i]}`
  );
};
