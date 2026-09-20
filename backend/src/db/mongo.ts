import mongoose from 'mongoose';
import { env } from '@/config/env';

let isConnected = false;

export async function connectMongo(): Promise<void> {
  if (isConnected) return;

  try {
    mongoose.set('strictQuery', true);
    await mongoose.connect(env.MONGODB_URI, {
      maxPoolSize: 10,
      serverSelectionTimeoutMS: 5000,
      socketTimeoutMS: 45000,
    });
    isConnected = true;
    console.log('✅ MongoDB connected');
  } catch (error) {
    console.error('❌ MongoDB connection failed:', error);
    process.exit(1);
  }
}

export async function disconnectMongo(): Promise<void> {
  if (!isConnected) return;
  await mongoose.disconnect();
  isConnected = false;
  console.log('🔌 MongoDB disconnected');
}

process.on('SIGINT', async () => {
  await disconnectMongo();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  await disconnectMongo();
  process.exit(0);
});