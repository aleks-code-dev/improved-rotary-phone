import type { RequestSpec, RequestBodyRaw, RequestBodyUrlencoded, RequestBodyFormData } from '../../state/useRequest';

export function specToCollectionItem(spec: RequestSpec, name?: string): any {
  return {
    name: name || 'Untitled Request',
    request: {
      method: spec.method,
      url: spec.url || '',
      header: (spec.headers || []).map((h: any) => ({ key: h.key, value: h.value })),
      body: spec.body?.mode !== 'none' ? {
        mode: spec.body?.mode,
        raw: spec.body?.mode === 'raw' ? (spec.body as RequestBodyRaw).text : undefined,
        urlencoded: spec.body?.mode === 'urlencoded' ? (spec.body as RequestBodyUrlencoded).fields : undefined,
        formdata: spec.body?.mode === 'form-data' ? (spec.body as RequestBodyFormData).fields : undefined,
      } : undefined,
      auth: spec.auth?.type !== 'none' ? spec.auth : undefined,
    },
    response: [],
    event: [],
    ...(spec.queryParams?.length > 0 ? { _queryParams: spec.queryParams } : {}),
  };
}
