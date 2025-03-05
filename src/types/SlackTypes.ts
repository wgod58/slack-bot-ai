export type ThreadMessage = {
  text: string;
};

export type SlackMessage = {
  thread_ts?: string;
  subtype?: string;
  channel: string;
  ts: string;
  text: string;
  user: string;
  type: string;
  team?: string;
  event_ts: string;
};
