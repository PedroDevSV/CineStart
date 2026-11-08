/** minúsculas y sin tildes, para buscar sin que importen los acentos */
export const normalize = (s) =>
  String(s ?? '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .trim();

export const cx = (...parts) => parts.filter(Boolean).join(' ');
