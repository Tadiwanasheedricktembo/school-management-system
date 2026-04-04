const { seedDefaultAdmin } = require('./seedAdmin');

seedDefaultAdmin()
  .then((result) => {
    console.log('[SEED_ADMIN_CLI] Result:', result);
  })
  .catch((err) => {
    console.error('[SEED_ADMIN_CLI] Failed:', err.message);
    process.exitCode = 1;
  });
