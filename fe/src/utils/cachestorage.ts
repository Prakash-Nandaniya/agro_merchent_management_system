import { apiFetch } from "./apifetch";
import { settings } from "@/settings";

async function fetchJson(url: string, method: string, body: object | null, notFoundMessage: string) {
    try {
        // 2. Set up the basic options
        const options: RequestInit = {
            method: method,
        };

        if (method !== 'GET' && body) {
            options.headers = { 'Content-Type': 'application/json' };
            options.body = JSON.stringify(body);
        }

        const res = await apiFetch(url, options);

        if (res.status === 404) throw new Error(notFoundMessage);
        if (!res.ok) {
            const errBody = await res.json().catch(() => ({}));
            throw new Error(errBody.detail || `Request failed with status ${res.status}`);
        }
        return await res.json();
    } catch (err) {
        throw new Error(err instanceof Error ? err.message : 'Could not reach the server.');
    }
}

// 4. Pass 'null' for the GET request body
export const FetchInvoices = () => fetchJson(`${settings.BE_URL}/get-mill-bill`, 'POST', {}, 'No Invoices Found');
export const FetchTrades = () => fetchJson(`${settings.BE_URL}/tradebook`, 'POST', {}, 'No Trades Found');
export const FetchProfile = () => fetchJson(`${settings.BE_URL}/profile-configuration`, 'GET', null, 'No Profile Found');