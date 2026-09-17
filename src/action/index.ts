import { runAction } from './runner.js';

runAction().catch((err) => {
  console.error('Fatal unhandled error in AgentRuleMap Action:', err);
  process.exitCode = 1;
});
