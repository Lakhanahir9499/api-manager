export interface UpstreamApi {
  _id: string;
  name: string;
  baseUrl: string;
  pathPattern: string;
  queryParams: Record<string, string>;
  headers: Record<string, string>;
  placeholders: string[];
  timeout: number;
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface RateLimitConfig {
  perMinute: number;
  daily: number;
  monthly: number;
}

export type KeyStatus = 'active' | 'suspended' | 'deleted';

export interface ApiKey {
  _id: string;
  keyPrefix: string;
  name: string;
  upstreamApi: string | UpstreamApi;
  status: KeyStatus;
  rateLimit: RateLimitConfig;
  ipWhitelist: string[];
  ipBlacklist: string[];
  usageCount: number;
  lastUsedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateKeyInput {
  name: string;
  upstreamApi: string;
  rateLimit?: Partial<RateLimitConfig>;
  ipWhitelist?: string[];
  ipBlacklist?: string[];
}

export interface UpdateKeyInput extends Partial<CreateKeyInput> {
  status?: KeyStatus;
}

export interface Stats {
  totalKeys: number;
  activeKeys: number;
  suspendedKeys: number;
  totalUpstreams: number;
  todayRequests: number;
  topKeys: Array<{ _id: string; name: string; usageCount: number; lastUsedAt: string | null; keyPrefix: string }>;
}

export interface KeyStats {
  usageCount: number;
  lastUsedAt: string | null;
}