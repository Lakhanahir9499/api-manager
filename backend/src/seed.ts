import 'dotenv/config';
import { connectMongo, disconnectMongo } from '@/db/mongo';
import { UpstreamApi } from '@/models/UpstreamApi';

async function seed() {
  await connectMongo();

  console.log('🌱 Seeding initial upstreams...');

  const upstreams = [
    {
      name: 'TG ID API',
      baseUrl: 'https://tele-to-phone.felixrdx.xyz',
      pathPattern: '/api/developer/Cyb3rB4nn3r/fast',
      queryParams: {
        key: '9852cb5d7955459bbceb48553f1a45b9',
        userid: '8335023642',
      },
      headers: {},
      placeholders: ['tg_id'],
      timeout: 10000,
      active: true,
    },
    {
      name: 'Family API',
      baseUrl: 'https://family.mafiaosint.com',
      pathPattern: '/',
      queryParams: {},
      headers: {},
      placeholders: ['aadhar'],
      timeout: 10000,
      active: true,
    },
  ];

  for (const upstream of upstreams) {
    const existing = await UpstreamApi.findOne({ name: upstream.name });
    if (existing) {
      console.log(`  ⏭️  ${upstream.name} already exists, skipping`);
      continue;
    }
    await UpstreamApi.create(upstream);
    console.log(`  ✅ Created ${upstream.name}`);
  }

  console.log('🌱 Seeding complete!');
  await disconnectMongo();
}

seed().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});