export interface Env {
  DEPLOY_HOOK_URL: string;
}

export default {
  async scheduled(_event: ScheduledEvent, env: Env): Promise<void> {
    const response = await fetch(env.DEPLOY_HOOK_URL, { method: 'POST' });
    if (!response.ok) {
      console.error(`Deploy hook call failed with HTTP ${response.status}`);
    }
  }
};
