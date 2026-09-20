import mongoose, { Document, Schema } from 'mongoose';

export interface IUpstreamApi extends Document {
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

const UpstreamApiSchema = new Schema<IUpstreamApi>(
  {
    name: { type: String, required: true, unique: true, trim: true },
    baseUrl: { type: String, required: true, trim: true },
    pathPattern: { type: String, required: true, trim: true },
    queryParams: { type: Schema.Types.Mixed, default: {} },
    headers: { type: Schema.Types.Mixed, default: {} },
    placeholders: [{ type: String }],
    timeout: { type: Number, default: 10000 },
    active: { type: Boolean, default: true },
  },
  { timestamps: true }
);

UpstreamApiSchema.index({ name: 1 }, { unique: true });

export const UpstreamApi = mongoose.model<IUpstreamApi>('UpstreamApi', UpstreamApiSchema);