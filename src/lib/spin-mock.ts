export type SpinPrizeIcon = 'coins' | 'car' | 'smartphone' | 'bike' | 'gift' | 'award';
export type SpinPrize = { id: string; label: string; icon: SpinPrizeIcon };

export const INITIAL_SPINS_LEFT = 2;

export const MOCK_SPIN_PRIZES: SpinPrize[] = [
  { id: 'coins', label: '500 Coins', icon: 'coins' },
  { id: 'car', label: 'Toy Car', icon: 'car' },
  { id: 'phone', label: 'Smartphone', icon: 'smartphone' },
  { id: 'bike', label: 'Bike', icon: 'bike' },
  { id: 'goldbar', label: 'Gold Bar', icon: 'award' },
  { id: 'gift', label: 'Mystery Gift', icon: 'gift' },
];
