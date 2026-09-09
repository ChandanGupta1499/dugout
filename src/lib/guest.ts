import AsyncStorage from '@react-native-async-storage/async-storage';

const GUEST_KEY = 'dugout.guest';

export type GuestUser = {
  userId: string;
  name: string;
};

function createGuest(): GuestUser {
  const suffix = Math.random().toString(36).slice(2, 8);
  return {
    userId: `guest-${suffix}`,
    name: `Guest ${suffix.toUpperCase()}`,
  };
}

export async function loadOrCreateGuest(): Promise<GuestUser> {
  const raw = await AsyncStorage.getItem(GUEST_KEY);
  if (raw) {
    try {
      const parsed = JSON.parse(raw) as GuestUser;
      if (parsed?.userId && parsed?.name) {
        return parsed;
      }
    } catch {
      // fall through and recreate
    }
  }

  const guest = createGuest();
  await AsyncStorage.setItem(GUEST_KEY, JSON.stringify(guest));
  return guest;
}
