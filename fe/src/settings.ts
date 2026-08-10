interface Settings {
    BE_URL: string;
    USERNAME: string;
    PASSWORD: string;
}

export const settings: Settings = {
    BE_URL: import.meta.env.VITE_BE_URL,
    USERNAME: import.meta.env.USERNAME,
    PASSWORD: import.meta.env.PASSWORD,
};