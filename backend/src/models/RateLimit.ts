import mongoose, { Document, Schema } from 'mongoose';
import { IApiKey } from './ApiKey';

export type RateLimitWindow = 'minute' | 'hour' | 'day' | 'month';

export interface IRateLimitCounter extends Document {
  keyId: mongoose.Types.ObjectId | IApiKey;
  window: RateLimitWindow;
  windowStart: Date;
  count: number;
  createdAt: Date;
  updatedAt: Date;
}

const RateLimitCounterSchema = new Schema<IRateLimitCounter>(
  {
    keyId: { type: Schema.Types.ObjectId, ref: 'ApiKey', required: true },
    window: { type: String, enum: ['minute', 'hour', 'day', 'month'], required: true },
    windowStart: { type: Date, required: true },
    count: { type: Number, default: 0, min: 0 },
  },
  { timestamps: true }
);

RateLimitCounterSchema.index({ keyId: 1, window: 1, windowStart: 1 }, { unique: true });
RateLimitCounterSchema.index({ windowStart: 1 }, { expireAfterSeconds: 2592000 }); // 30 days TTL

export const RateLimitCounter = mongoose.model<IRateLimitCounter>('RateLimitCounter', RateLimitCounterSchema);