import { ApiKey, IApiKey, IRateLimitConfig } from '@/models/ApiKey';
import { UpstreamApi } from '@/models/UpstreamApi';
import { resetRateLimit } from './rateLimitService';
import mongoose from 'mongoose';

interface LeanApiKey extends Omit<IApiKey, 'upstreamApi'> {
  upstreamApi: mongoose.Types.ObjectId | LeanUpstreamApi;
}

interface LeanUpstreamApi {
  _id: mongoose.Types.ObjectId;
  name: string;
  baseUrl: string;
  pathPattern: string;
  queryParams: Record<string, string>;
  headers: Record<string, string>;
  placeholders: string[];
  timeout: number;
  active: boolean;
  createdAt: Date;
  updatedAt: Date;
}

function generateKey(): { key: string; prefix: string } {
  const prefix = 'ak_live_';
  const randomPart = Array.from(crypto.getRandomValues(new Uint8Array(16)))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
  const key = prefix + randomPart;

  return { key, prefix };
}

async function hashKey(key: string): Promise<string> {
  const bcrypt = await import('bcryptjs');
  return bcrypt.hash(key, 12);
}

export interface CreateKeyInput {
  name: string;
  upstreamApi: string;
  rateLimit?: Partial<IRateLimitConfig>;
  ipWhitelist?: string[];
  ipBlacklist?: string[];
}

export interface UpdateKeyInput {
  name?: string;
  upstreamApi?: string;
  rateLimit?: Partial<IRateLimitConfig>;
  ipWhitelist?: string[];
  ipBlacklist?: string[];
  status?: IApiKey['status'];
}

export async function createKey(input: CreateKeyInput): Promise<{ key: string; apiKey: IApiKey }> {
  const upstream = await UpstreamApi.findById(input.upstreamApi);
  if (!upstream) throw new Error('Upstream API not found');

  const { key, prefix } = generateKey();
  const hash = await hashKey(key);

  const apiKey = await ApiKey.create({
    keyHash: hash,
    keyPrefix: prefix,
    name: input.name,
    upstreamApi: upstream._id,
    rateLimit: {
      perMinute: input.rateLimit?.perMinute ?? 60,
      daily: input.rateLimit?.daily ?? 1000,
      monthly: input.rateLimit?.monthly ?? 10000,
    },
    ipWhitelist: input.ipWhitelist || [],
    ipBlacklist: input.ipBlacklist || [],
    status: 'active',
  });

  return { key, apiKey };
}

export async function getKeys(filters: { status?: IApiKey['status']; upstreamApi?: string } = {}): Promise<LeanApiKey[]> {
  const query: Record<string, unknown> = { status: { $ne: 'deleted' } };
  if (filters.status) query.status = filters.status;
  if (filters.upstreamApi) query.upstreamApi = filters.upstreamApi;

  return ApiKey.find(query)
    .populate('upstreamApi')
    .sort({ createdAt: -1 })
    .lean<LeanApiKey[]>();
}

export async function getKeyById(id: string): Promise<LeanApiKey | null> {
  if (!mongoose.Types.ObjectId.isValid(id)) return null;
  return ApiKey.findById(id).populate('upstreamApi').lean<LeanApiKey>();
}

export async function updateKey(id: string, input: UpdateKeyInput): Promise<LeanApiKey | null> {
  if (!mongoose.Types.ObjectId.isValid(id)) return null;

  const update: Record<string, unknown> = {};
  if (input.name !== undefined) update.name = input.name;
  if (input.upstreamApi !== undefined) update.upstreamApi = input.upstreamApi;
  if (input.rateLimit !== undefined) update.rateLimit = input.rateLimit;
  if (input.ipWhitelist !== undefined) update.ipWhitelist = input.ipWhitelist;
  if (input.ipBlacklist !== undefined) update.ipBlacklist = input.ipBlacklist;
  if (input.status !== undefined) update.status = input.status;

  return ApiKey.findByIdAndUpdate(id, update, { new: true }).populate('upstreamApi').lean<LeanApiKey>();
}

export async function suspendKey(id: string): Promise<LeanApiKey | null> {
  return updateKey(id, { status: 'suspended' });
}

export async function unsuspendKey(id: string): Promise<LeanApiKey | null> {
  return updateKey(id, { status: 'active' });
}

export async function deleteKey(id: string): Promise<boolean> {
  if (!mongoose.Types.ObjectId.isValid(id)) return false;
  const result = await ApiKey.findByIdAndUpdate(id, { status: 'deleted' });
  if (result) {
    await resetRateLimit(id);
  }
  return !!result;
}

export async function getKeyStats(keyId: string): Promise<{ usageCount: number; lastUsedAt: Date | null } | null> {
  const key = await ApiKey.findById(keyId).select('usageCount lastUsedAt').lean();
  return key ? { usageCount: key.usageCount, lastUsedAt: key.lastUsedAt } : null;
}

export async function incrementUsage(keyId: string): Promise<void> {
  await ApiKey.findByIdAndUpdate(keyId, {
    $inc: { usageCount: 1 },
    $set: { lastUsedAt: new Date() },
  });
}