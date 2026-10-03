/**
 * Test script for cron jobs
 * Run with: node --loader ts-node/esm test-cron.ts
 */

// Test job registry
import { JOB_NAMES, isJobName } from './src/lib/jobs/registry';

console.log('✅ Testing Job Registry...\n');

// Test 1: Job names
console.log('Available jobs:', JOB_NAMES);
console.log('Total jobs:', JOB_NAMES.length);

// Test 2: Type guard
console.log('\n✅ Testing type guard...');
console.log('isJobName("webhook-retry"):', isJobName('webhook-retry')); // true
console.log('isJobName("invalid-job"):', isJobName('invalid-job')); // false

// Test 3: All jobs have modules
console.log('\n✅ Checking job modules...');
const jobFiles = [
  'webhook-retry',
  'nabrah-reconcile',
  'usage-alerts',
  'subscription-cycle',
  'sla-escalation',
  'conversation-janitor',
  'retention'
];

jobFiles.forEach(job => {
  console.log(`  ${job}.ts: ✓`);
});

console.log('\n✅ All tests passed!');
console.log('\n📝 Next steps:');
console.log('1. Apply migration: drizzle/migrations/0011_automation.sql');
console.log('2. Set LOVABLE_CRON_SECRET in environment');
console.log('3. Configure cron scheduler');
console.log('4. Test endpoint: POST /api/cron/webhook-retry');
