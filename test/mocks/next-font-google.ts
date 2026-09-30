type NextFont = {
  className: string;
  variable: string;
  style: { fontFamily: string };
};

const stubFont = (): NextFont => ({
  className: 'next-font',
  variable: 'next-font-variable',
  style: { fontFamily: 'next-font' },
});

export const IBM_Plex_Sans = stubFont;
