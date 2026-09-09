export type MatchTeam = {
  slug: string;
  label: string;
};

export type Match = {
  id: string;
  title: string;
  subtitle: string;
  channelType: 'messaging';
  channelId: string;
  teamA?: MatchTeam;
  teamB?: MatchTeam;
};
