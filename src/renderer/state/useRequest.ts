import { create } from 'zustand';
import { useTabs } from './useTabs';

// Local types matching main-process RequestSpec shape
export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE' | 'HEAD' | 'OPTIONS';
export type BodyMode = 'none' | 'raw' | 'urlencoded' | 'form-data' | 'binary';
export type RawContentType = 'application/json' | 'application/xml' | 'text/plain' | 'application/graphql';
export type AuthType = 'none' | 'bearer' | 'basic' | 'api-key';

export interface RequestHeader {
  key: string;
  value: string;
  enabled: boolean;
}

export interface QueryParam {
  key: string;
  value: string;
  enabled: boolean;
}

export interface PathParam {
  key: string;
  value: string;
}

export interface RequestBodyNone { mode: 'none'; }
export interface RequestBodyRaw {
  mode: 'raw';
  contentType: RawContentType;
  text: string;
}
export interface RequestBodyUrlencoded {
  mode: 'urlencoded';
  fields: Array<{ key: string; value: string }>;
}
export interface RequestBodyFormData {
  mode: 'form-data';
  fields: Array<{ key: string; value: string; type: 'text' | 'file'; filePath?: string }>;
}
export interface RequestBodyBinary {
  mode: 'binary';
  filePath: string;
  contentType: string;
}

export type RequestBody = RequestBodyNone | RequestBodyRaw | RequestBodyUrlencoded | RequestBodyFormData | RequestBodyBinary;

export interface RequestAuthNone { type: 'none'; }
export interface RequestAuthBearer { type: 'bearer'; token: string; }
export interface RequestAuthBasic { type: 'basic'; username: string; password: string; }
export interface RequestAuthApiKey { type: 'api-key'; key: string; value: string; in: 'header' | 'query'; }

export type RequestAuth = RequestAuthNone | RequestAuthBearer | RequestAuthBasic | RequestAuthApiKey;

export interface RequestSettings {
  timeoutMs: number;
  followRedirects: boolean;
  maxRedirects: number;
  sslVerify: boolean;
  saveCookiesToJar: boolean;
}

export interface RequestSpec {
  requestId: string;
  method: HttpMethod;
  url: string;
  headers: RequestHeader[];
  queryParams: QueryParam[];
  pathParams: PathParam[];
  body: RequestBody;
  auth: RequestAuth;
  settings: RequestSettings;
  proxy?: string;
}

function createDefaultSpec(): RequestSpec {
  return {
    requestId: crypto.randomUUID(),
    method: 'GET',
    url: '',
    headers: [],
    queryParams: [],
    pathParams: [],
    body: { mode: 'none' },
    auth: { type: 'none' },
    settings: {
      timeoutMs: 30000,
      followRedirects: true,
      maxRedirects: 10,
      sslVerify: true,
      saveCookiesToJar: false,
    },
  };
}

interface RequestStore {
  specs: Record<string, RequestSpec>;
  ensureSpec: (tabId: string) => RequestSpec;
  getSpec: (tabId: string) => RequestSpec;
  setSpec: (tabId: string, spec: RequestSpec) => void;
  setMethod: (tabId: string, method: HttpMethod) => void;
  setUrl: (tabId: string, url: string) => void;
  addHeader: (tabId: string, header?: { key: string; value: string }) => void;
  updateHeader: (tabId: string, index: number, partial: Partial<RequestHeader>) => void;
  removeHeader: (tabId: string, index: number) => void;
  addQueryParam: (tabId: string) => void;
  updateQueryParam: (tabId: string, index: number, partial: Partial<QueryParam>) => void;
  removeQueryParam: (tabId: string, index: number) => void;
  addPathParam: (tabId: string) => void;
  updatePathParam: (tabId: string, index: number, partial: Partial<PathParam>) => void;
  removePathParam: (tabId: string, index: number) => void;
  setBody: (tabId: string, body: RequestBody) => void;
  setAuth: (tabId: string, auth: RequestAuth) => void;
  setSettings: (tabId: string, partial: Partial<RequestSettings>) => void;
}

export const useRequest = create<RequestStore>((set, get) => ({
  specs: {},

  ensureSpec(tabId) {
    const existing = get().specs[tabId];
    if (existing) return existing;
    const spec = createDefaultSpec();
    set((s) => ({ specs: { ...s.specs, [tabId]: spec } }));
    return spec;
  },

  getSpec(tabId) {
    return get().specs[tabId] ?? get().ensureSpec(tabId);
  },

  setSpec(tabId, spec) {
    set((s) => ({ specs: { ...s.specs, [tabId]: { ...spec, requestId: spec.requestId || crypto.randomUUID() } } }));
  },

  setMethod(tabId, method) {
    set((s) => {
      useTabs.getState().markDirty(tabId);
      const spec = s.specs[tabId] ?? createDefaultSpec();
      return { specs: { ...s.specs, [tabId]: { ...spec, method } } };
    });
  },

  setUrl(tabId, url) {
    set((s) => {
      useTabs.getState().markDirty(tabId);
      const spec = s.specs[tabId] ?? createDefaultSpec();
      return { specs: { ...s.specs, [tabId]: { ...spec, url } } };
    });
  },

  addHeader(tabId, header) {
    set((s) => {
      useTabs.getState().markDirty(tabId);
      const spec = s.specs[tabId] ?? createDefaultSpec();
      return {
        specs: {
          ...s.specs,
          [tabId]: { ...spec, headers: [...spec.headers, { key: header?.key ?? '', value: header?.value ?? '', enabled: true }] },
        },
      };
    });
  },

  updateHeader(tabId, index, partial) {
    set((s) => {
      useTabs.getState().markDirty(tabId);
      const spec = s.specs[tabId] ?? createDefaultSpec();
      const headers = [...spec.headers];
      headers[index] = { ...headers[index], ...partial };
      return { specs: { ...s.specs, [tabId]: { ...spec, headers } } };
    });
  },

  removeHeader(tabId, index) {
    set((s) => {
      useTabs.getState().markDirty(tabId);
      const spec = s.specs[tabId];
      if (!spec) return s;
      const headers = spec.headers.filter((_, i) => i !== index);
      return { specs: { ...s.specs, [tabId]: { ...spec, headers } } };
    });
  },

  addQueryParam(tabId) {
    set((s) => {
      useTabs.getState().markDirty(tabId);
      const spec = s.specs[tabId] ?? createDefaultSpec();
      return {
        specs: {
          ...s.specs,
          [tabId]: { ...spec, queryParams: [...spec.queryParams, { key: '', value: '', enabled: true }] },
        },
      };
    });
  },

  updateQueryParam(tabId, index, partial) {
    set((s) => {
      useTabs.getState().markDirty(tabId);
      const spec = s.specs[tabId] ?? createDefaultSpec();
      const params = [...spec.queryParams];
      params[index] = { ...params[index], ...partial };
      return { specs: { ...s.specs, [tabId]: { ...spec, queryParams: params } } };
    });
  },

  removeQueryParam(tabId, index) {
    set((s) => {
      useTabs.getState().markDirty(tabId);
      const spec = s.specs[tabId];
      if (!spec) return s;
      const params = spec.queryParams.filter((_, i) => i !== index);
      return { specs: { ...s.specs, [tabId]: { ...spec, queryParams: params } } };
    });
  },

  addPathParam(tabId) {
    set((s) => {
      useTabs.getState().markDirty(tabId);
      const spec = s.specs[tabId] ?? createDefaultSpec();
      return {
        specs: {
          ...s.specs,
          [tabId]: { ...spec, pathParams: [...spec.pathParams, { key: '', value: '' }] },
        },
      };
    });
  },

  updatePathParam(tabId, index, partial) {
    set((s) => {
      useTabs.getState().markDirty(tabId);
      const spec = s.specs[tabId] ?? createDefaultSpec();
      const params = [...spec.pathParams];
      params[index] = { ...params[index], ...partial };
      return { specs: { ...s.specs, [tabId]: { ...spec, pathParams: params } } };
    });
  },

  removePathParam(tabId, index) {
    set((s) => {
      useTabs.getState().markDirty(tabId);
      const spec = s.specs[tabId];
      if (!spec) return s;
      const params = spec.pathParams.filter((_, i) => i !== index);
      return { specs: { ...s.specs, [tabId]: { ...spec, pathParams: params } } };
    });
  },

  setBody(tabId, body) {
    set((s) => {
      useTabs.getState().markDirty(tabId);
      const spec = s.specs[tabId] ?? createDefaultSpec();
      return { specs: { ...s.specs, [tabId]: { ...spec, body } } };
    });
  },

  setAuth(tabId, auth) {
    set((s) => {
      useTabs.getState().markDirty(tabId);
      const spec = s.specs[tabId] ?? createDefaultSpec();
      return { specs: { ...s.specs, [tabId]: { ...spec, auth } } };
    });
  },

  setSettings(tabId, partial) {
    set((s) => {
      useTabs.getState().markDirty(tabId);
      const spec = s.specs[tabId] ?? createDefaultSpec();
      return { specs: { ...s.specs, [tabId]: { ...spec, settings: { ...spec.settings, ...partial } } } };
    });
  },
}));
