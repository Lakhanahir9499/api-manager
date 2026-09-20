import { UpstreamApi, IUpstreamApi } from '@/models/UpstreamApi';
import { env } from '@/config/env';
import mongoose from 'mongoose';

interface LeanUpstreamApi extends Omit<IUpstreamApi, '_id'> {
  _id: mongoose.Types.ObjectId;
}

export interface ProxyRequest {
  method: string;
  path: string;
  query: Record<string, string>;
  headers: Record<string, string>;
  body: unknown;
}

export interface ProxyResponse {
  status: number;
  headers: Record<string, string>;
  data: unknown;
}

function replacePlaceholders(template: string, params: Record<string, string>): string {
  return template.replace(/\{(\w+)\}/g, (match, key) => params[key] || match);
}

function mergeQueryParams(base: Record<string, string>, override: Record<string, string>): Record<string, string> {
  return { ...base, ...override };
}

function mergeHeaders(base: Record<string, string>, override: Record<string, string>): Record<string, string> {
  const merged = { ...base };
  for (const [key, value] of Object.entries(override)) {
    const lowerKey = key.toLowerCase();
    if (lowerKey === 'host' || lowerKey === 'content-length' || lowerKey === 'connection') continue;
    merged[key] = value;
  }
  return merged;
}

export async function proxyToUpstream(
  upstream: IUpstreamApi,
  request: ProxyRequest
): Promise<ProxyResponse> {
  const placeholders: Record<string, string> = {};
  for (const ph of upstream.placeholders) {
    if (request.query[ph]) {
      placeholders[ph] = request.query[ph];
    } else if (typeof request.body === 'object' && request.body !== null && ph in request.body) {
      placeholders[ph] = String((request.body as Record<string, unknown>)[ph]);
    }
  }

  const finalPath = replacePlaceholders(upstream.pathPattern, placeholders);
  const finalQuery = mergeQueryParams(upstream.queryParams, request.query);
  const finalHeaders = mergeHeaders(upstream.headers, request.headers);

  const queryString = new URLSearchParams(finalQuery).toString();
  const url = `${upstream.baseUrl.replace(/\/$/, '')}${finalPath}${queryString ? `?${queryString}` : ''}`;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), upstream.timeout || env.UPSTREAM_TIMEOUT_MS);

  try {
    const response = await fetch(url, {
      method: request.method,
      headers: finalHeaders,
      body: ['GET', 'HEAD'].includes(request.method) ? undefined : JSON.stringify(request.body),
      signal: controller.signal,
      redirect: 'follow',
    });

    clearTimeout(timeoutId);

    const responseHeaders: Record<string, string> = {};
    response.headers.forEach((value, key) => {
      if (!['content-encoding', 'transfer-encoding', 'connection'].includes(key.toLowerCase())) {
        responseHeaders[key] = value;
      }
    });

    const contentType = response.headers.get('content-type') || '';
    let data: unknown;
    if (contentType.includes('application/json')) {
      data = await response.json();
    } else {
      data = await response.text();
    }

    return {
      status: response.status,
      headers: responseHeaders,
      data,
    };
  } catch (error) {
    clearTimeout(timeoutId);
    if (error instanceof Error && error.name === 'AbortError') {
      throw new Error('Upstream request timeout');
    }
    throw error;
  }
}

export async function getUpstreamById(id: string): Promise<LeanUpstreamApi | null> {
  return UpstreamApi.findById(id).lean<LeanUpstreamApi>();
}

export async function getActiveUpstreams(): Promise<LeanUpstreamApi[]> {
  return UpstreamApi.find({ active: true }).lean<LeanUpstreamApi[]>();
}