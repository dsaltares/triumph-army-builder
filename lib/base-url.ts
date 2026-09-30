export const devBaseUrl = 'http://localhost:3013';

export const serverBaseUrl = () => process.env.BETTER_AUTH_URL ?? devBaseUrl;
