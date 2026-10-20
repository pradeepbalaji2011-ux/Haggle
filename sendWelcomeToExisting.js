/**
 * sendWelcomeToExisting.js — One-time script to send welcome emails to existing users
 *
 * Usage:
 *   node sendWelcomeToExisting.js              # sends emails (2-second delay between each)
 *   node sendWelcomeToExisting.js --dry-run    # only lists who would receive it (no emails sent)
 *
 * Safe to re-run: only sends to users with welcomeEmailSent !== true.
 */

import 'dotenv/config';
import { getAllUsers, markWelcomeEmailSent } from './server/users.js';
import { sendMail, getWelcomeEmailHtml } from './server/mailer.js';

const isDryRun = process.argv.includes('--dry-run');
const SITE_URL = process.env.SITE_URL || 'https://haggle-2mki.onrender.com';
const DELAY_MS = 2000;

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function main() {
  console.log('\n🛒 Haggle — Welcome Email Script');
  console.log('─'.repeat(44));

  if (isDryRun) {
    console.log('📋 DRY RUN MODE — no emails will be sent\n');
  } else {
    console.log('🚀 LIVE MODE — emails will be sent with 2s delay\n');
  }

  const isDummyEmail = (email) => {
    return email.endsWith('@example.com') || email.endsWith('@haggle.dev') || email.includes('test_');
  };

  const allUsers = getAllUsers();
  // Filter for real users who haven't received the email yet
  const pending = allUsers.filter(u => !u.welcomeEmailSent && !isDummyEmail(u.email));
  const dummyCount = allUsers.filter(u => isDummyEmail(u.email)).length;

  if (pending.length === 0) {
    console.log('✅ All users have already received the welcome email. Nothing to do.\n');
    process.exit(0);
  }

  console.log(`Found ${pending.length} user(s) awaiting welcome email:\n`);

  if (isDryRun) {
    pending.forEach((u, i) => {
      console.log(`  ${i + 1}. ${u.email} (${u.name || 'No name'}) — joined ${u.createdAt ? new Date(u.createdAt).toLocaleDateString() : 'unknown'}`);
    });
    console.log(`\nDry run complete. Run without --dry-run to send ${pending.length} email(s).\n`);
    process.exit(0);
  }

  let sent = 0;
  let failed = 0;
  const failedList = [];

  for (let i = 0; i < pending.length; i++) {
    const user = pending[i];
    const userName = user.name || user.email.split('@')[0];
    process.stdout.write(`  [${i + 1}/${pending.length}] Sending to ${user.email}... `);

    try {
      const success = await sendMail(
        user.email,
        `Welcome to Haggle, ${userName}!`,
        getWelcomeEmailHtml(userName, SITE_URL)
      );

      if (success) {
        markWelcomeEmailSent(user.email);
        console.log('✓ sent');
        sent++;
      } else {
        console.log('✗ failed (check EMAIL_PASS in .env)');
        failed++;
        failedList.push(user.email);
      }
    } catch (err) {
      console.log(`✗ error: ${err.message}`);
      failed++;
      failedList.push(user.email);
    }

    // 2-second delay to avoid Gmail rate limits (except after last email)
    if (i < pending.length - 1) {
      await sleep(DELAY_MS);
    }
  }

  console.log('\n' + '─'.repeat(44));
  console.log('📊 Summary:');
  console.log(`   ✓ Sent:    ${sent}`);
  console.log(`   ✗ Failed:  ${failed}`);
  console.log(`   ⏭ Skipped: ${allUsers.length - pending.length} (${dummyCount} test accounts + already sent)`);

  if (failedList.length > 0) {
    console.log('\nFailed recipients:');
    failedList.forEach(e => console.log(`  - ${e}`));
    console.log('\nTip: Check that EMAIL_PASS is set in .env and is a valid Gmail App Password.');
  }

  console.log('');
  process.exit(failed > 0 ? 1 : 0);
}

main().catch(err => {
  console.error('Script failed:', err);
  process.exit(1);
});
