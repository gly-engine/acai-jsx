import { GlyStd, GlyStdWithHttpResponse } from "@gamely/gly-types";

export type AcaiHttpMethod = 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';

export type AcaiHttpOptions = {
    headers?: Record<string, string>;
    body?: string | object;
}

export type AcaiHttpResponse = {
    ok: boolean;
    status: number;
    text: () => string;
    json: <T = unknown>() => T;
};

export type AcaiHttpRequest = (this: void, url: string, options?: AcaiHttpOptions) => Promise<AcaiHttpResponse>;

export type AcaiHttpGetConfigs = () => LuaMultiReturn<[string | undefined, Record<string, string>, GlyStd | undefined]>

export type AcaiHttpSetConfigs = (configs: {
    base_url?: string;
    headers?: Record<string, string>;
    std?: GlyStd;
}) => void;

export type AcaiHttp = {
    get: AcaiHttpRequest;
    post: AcaiHttpRequest
    put: AcaiHttpRequest;
    patch: AcaiHttpRequest;
    delete: AcaiHttpRequest;
}

export type AcaiHttpWithSetConfigs = LuaMultiReturn<[AcaiHttp, AcaiHttpSetConfigs]>

declare namespace string {
    function gsub(
        s: string,
        pattern: string,
        repl: string | Record<string, string> | ((...matches: string[]) => string),
        n?: number
    ): LuaMultiReturn<[string, number]>;
}

function createRequest(std: GlyStd, url: string, method: string) {
    switch (method) {
        case 'POST': return std.http.post(url);
        case 'PUT': return std.http.put(url);
        case 'DELETE': return std.http.delete(url);
        case 'PATCH': return std.http.patch(url);
        default: return std.http.get(url);
    }
}

function factoryRequest(getConfig: AcaiHttpGetConfigs, method: AcaiHttpMethod) {
    return function (this: void, url: string, opts?: AcaiHttpOptions) {
        const [base_url, base_headers, std] = getConfig();

        if (!std) {
            throw new Error("Missing std in Acai Request!")
        }

        return new Promise<AcaiHttpResponse>((resolve, reject) => {
            const base = base_url ? string.gsub(base_url, '\/$', '')[0] : '';
            const path = string.gsub(url, '^\/', '')[0];
            const fullUrl = base.length > 0? `${base}/${path}` : url;

            const http = createRequest(std, fullUrl, method);

            const headers = opts?.headers ? { ...base_headers, ...opts.headers } : base_headers;
            for (const [k, v] of Object.entries(headers)) http.header(k, v);

            if (typeof opts?.body === 'string') http.body(opts.body);
            if (typeof opts?.body === 'object') http.body(opts.body);

            const toResponse = (s: GlyStdWithHttpResponse, ok: boolean) => {
                /**
                 *  @todo std.json.decode in @gamely/gly-types
                 */
                // @ts-ignore
                const json_decode = std.json?.decode || JSON?.parse || (() => { throw new Error("json not required!") });
                const status = s.http.status ?? 0;
                const raw = s.http.body as string;

                return {
                    ok, status,
                    text: () => raw,
                    json: <T>() => json_decode(raw) as T,
                };
            };

            http
                .success((s) => resolve(toResponse(s, true)))
                .failed((s) => resolve(toResponse(s, false)))
                .error((s) => reject(new Error(`Request error: ${method} ${fullUrl}\n${s.http.error}`)))
                .run();
        });
    }
}

export function request(std: GlyStd): AcaiHttp;
export function request(std?: undefined): AcaiHttpWithSetConfigs;
 
export function request(std?: GlyStd | undefined) {
    let _base_url: undefined | string;
    let _headers: Record<string, string> = {};
    let _std = std;

    const getConfig: AcaiHttpGetConfigs = () => [_base_url, _headers, _std] as ReturnType<AcaiHttpGetConfigs>;

    const setConfig: AcaiHttpSetConfigs = ({ std, base_url, headers }) => {
        if (std !== undefined) _std = std;
        if (base_url !== undefined) _base_url = base_url;
        if (headers !== undefined) {
            _headers = { ..._headers, ...headers };
        }
    }

    const http = {
        get: factoryRequest(getConfig, 'GET'),
        put: factoryRequest(getConfig, 'PUT'),
        post: factoryRequest(getConfig, 'POST'),
        patch: factoryRequest(getConfig, 'PATCH'),
        delete: factoryRequest(getConfig, 'DELETE'),
    }
    
    if (std) {
        return http;
    }

    return $multi(http, setConfig);
}
