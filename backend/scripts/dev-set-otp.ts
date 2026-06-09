/**
 * FlowOS - scripts/dev-set-otp.ts (DEV ONLY)
 * Sets a KNOWN email-verification OTP for a user, so you can verify locally
 * without a working email provider. Never use against production data.
 *
 *   npx tsx scripts/dev-set-otp.ts <email> [code]
 */
import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';

async function main(): Promise<void> {
  const email = (process.argv[2] ?? '').toLowerCase();
  const code = process.argv[3] ?? '123456';
  const uri = process.env.MONGODB_URI ?? 'mongodb://127.0.0.1:27017/flowos';

  if (!email) {
    console.error('usage: tsx scripts/dev-set-otp.ts <email> [code]');
    process.exit(1);
  }

  await mongoose.connect(uri);
  const db = mongoose.connection.db;
  if (!db) throw new Error('no db connection');

  const hash = await bcrypt.hash(code, 10);
  const res = await db.collection('users').updateOne(
    { email },
    {
      $set: {
        verifyOtpHash: hash,
        verifyOtpExpires: new Date(Date.now() + 60 * 60 * 1000),
        verifyOtpAttempts: 0,
      },
    },
  );

  console.log(
    JSON.stringify({ email, code, matched: res.matchedCount, modified: res.modifiedCount }),
  );
  await mongoose.disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
