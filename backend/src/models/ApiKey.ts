import mongoose, { Document, Schema } from 'mongoose';
import { IUpstreamApi } from './UpstreamApi';

export type KeyStatus = 'active' | 'suspended' | 'deleted';

export interface IRateLimitConfig {
  perMinute: number;
  daily: number;
  monthly: number;
}

export interface IApiKey extends Document {
  keyHash: string;
  keyPrefix: string;
  name: string;
  upstreamApi: mongoose.Types.ObjectId | IUpstreamApi;
  status: KeyStatus;
  rateLimit: IRateLimitConfig;
  ipWhitelist: string[];
  ipBlacklist: string[];
  usageCount: number;
  lastUsedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

const RateLimitConfigSchema = new Schema<IRateLimitConfig>(
  {
    perMinute: { type: Number, default: 60, min: 0 },
    daily: { type: Number, default: 1000, min: 0 },
    monthly: { type: Number, default: 10000, min: 0 },
  },
  { _id: false }
);

const ApiKeySchema = new Schema<IApiKey>(
  {
    keyHash: { type: String, required: true },
    keyPrefix: { type: String, required: true, length: 8 },
    name: { type: String, required: true, trim: true },
    upstreamApi: { type: Schema.Types.ObjectId, ref: 'UpstreamApi', required: true },
    status: { type: String, enum: ['active', 'suspended', 'deleted'], default: 'active' },
    rateLimit: { type: RateLimitConfigSchema, required: true, default: () => ({ perMinute: 60, daily: 1000, monthly: 10000 }) },
    ipWhitelist: [{ type: String }],
    ipBlacklist: [{ type: String }],
    usageCount: { type: Number, default: 0 },
    lastUsedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

ApiKeySchema.index({ keyPrefix: 1 });
ApiKeySchema.index({ upstreamApi: 1 });
ApiKeySchema.index({ status: 1 });
ApiKeySchema.index({ createdAt: -1 });

export const ApiKey = mongoose.model<IApiKey>('ApiKey', ApiKeySchema);