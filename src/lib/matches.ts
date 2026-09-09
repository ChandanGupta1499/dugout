export type MatchTeam = {
  slug: string;
  label: string;
};

export type Match = {
  id: string;
  title: string;
  subtitle: string;
  channelType: 'messaging';
  /** Stream messaging channel id; null when chat is not set up yet. */
  channelId: string | null;
  teamA?: MatchTeam;
  teamB?: MatchTeam;
};
