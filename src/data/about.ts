/** Informacje o twórcy – jedno miejsce, używane w stopce, ustawieniach i metadanych. */
export const AUTHOR = 'Marcin Wyrzykowski';
export const COPYRIGHT_YEAR = 2026;
export const APP_VERSION = '1.0.0';
export const copyrightLine = () => {
  const y = new Date().getFullYear();
  return `© ${y > COPYRIGHT_YEAR ? `${COPYRIGHT_YEAR}–${y}` : COPYRIGHT_YEAR} ${AUTHOR}`;
};
