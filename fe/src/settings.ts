interface Settings {
    BE_URL: string;
}

export const settings: Settings = {
    BE_URL: import.meta.env.VITE_BE_URL,
};