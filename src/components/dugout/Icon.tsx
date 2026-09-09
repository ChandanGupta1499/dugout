import { CheckCircle2, ChevronLeft, Gamepad2, Plus, Send, XCircle } from 'lucide-react-native';

const ICONS = {
  'chevron-left': ChevronLeft,
  plus: Plus,
  send: Send,
  'circle-check': CheckCircle2,
  'circle-x': XCircle,
  gamepad: Gamepad2,
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
