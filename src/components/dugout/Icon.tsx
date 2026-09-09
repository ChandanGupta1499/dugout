import { ChevronLeft, Send } from 'lucide-react-native';

const ICONS = {
  'chevron-left': ChevronLeft,
  send: Send,
} as const;

type Props = {
  name: keyof typeof ICONS;
  size?: number;
  color?: string;
};

export function Icon({ name, size = 20, color }: Props) {
  const Cmp = ICONS[name];
  return <Cmp size={size} color={color} />;
}
