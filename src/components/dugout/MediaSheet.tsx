import { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Animated,
  FlatList,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  useWindowDimensions,
  View,
} from "react-native";
import { Image } from "expo-image";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { searchGiphy, type GiphyItem, type GiphyKind } from "@/lib/api";
import { fonts, radius, semantic, spacing, typography } from "@/theme/tokens";

type Tab = "gif" | "sticker";

type Props = {
  visible: boolean;
  onClose: () => void;
  onPickMedia: (item: GiphyItem, kind: GiphyKind) => void;
};

const TABS: { id: Tab; label: string }[] = [
  { id: "gif", label: "GIF" },
  { id: "sticker", label: "Stickers" },
];

const SHEET_HEIGHT_COLLAPSED = 0.55;
const SHEET_HEIGHT_EXPANDED = 0.8;

export function MediaSheet({ visible, onClose, onPickMedia }: Props) {
  const insets = useSafeAreaInsets();
  const { height: screenHeight } = useWindowDimensions();
  const [tab, setTab] = useState<Tab>("gif");
  const [query, setQuery] = useState("");
  const [items, setItems] = useState<GiphyItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchFocused, setSearchFocused] = useState(false);
  const heightAnim = useRef(
    new Animated.Value(screenHeight * SHEET_HEIGHT_COLLAPSED),
  ).current;

  const loadMedia = useCallback(async (kind: Tab, q: string) => {
    setLoading(true);
    setError(null);
    try {
      const next = await searchGiphy(q, kind);
      setItems(next);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Failed to load media";
      setError(message);
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!visible) return;

    const handle = setTimeout(
      () => {
        void loadMedia(tab, query);
      },
      query.trim() ? 300 : 0,
    );

    return () => clearTimeout(handle);
  }, [visible, tab, query, loadMedia]);

  useEffect(() => {
    if (!visible) {
      setTab("gif");
      setQuery("");
      setItems([]);
      setError(null);
      setSearchFocused(false);
      heightAnim.setValue(screenHeight * SHEET_HEIGHT_COLLAPSED);
    }
  }, [visible, heightAnim, screenHeight]);

  useEffect(() => {
    if (!visible) return;

    Animated.timing(heightAnim, {
      toValue:
        screenHeight *
        (searchFocused ? SHEET_HEIGHT_EXPANDED : SHEET_HEIGHT_COLLAPSED),
      duration: 220,
      useNativeDriver: false,
    }).start();
  }, [searchFocused, screenHeight, heightAnim, visible]);

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      onRequestClose={onClose}
    >
      <View style={styles.modalRoot}>
        <Pressable style={styles.backdrop} onPress={onClose} />
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : undefined}
          style={styles.keyboardWrap}
        >
          <Animated.View
            style={[
              styles.sheet,
              {
                height: heightAnim,
                paddingBottom: Math.max(insets.bottom, spacing.s5),
              },
            ]}
          >
            <View style={styles.handle} />
            <View style={styles.tabs}>
              {TABS.map((item) => {
                const active = item.id === tab;
                return (
                  <Pressable
                    key={item.id}
                    onPress={() => {
                      setTab(item.id);
                      setQuery("");
                    }}
                    style={[styles.tab, active && styles.tabActive]}
                  >
                    <Text
                      style={[styles.tabLabel, active && styles.tabLabelActive]}
                    >
                      {item.label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>

            <TextInput
              value={query}
              onChangeText={setQuery}
              placeholder={tab === "gif" ? "Search GIFs" : "Search stickers"}
              placeholderTextColor={semantic.textPlaceholder}
              style={styles.search}
              autoCorrect={false}
              autoCapitalize="none"
              clearButtonMode="while-editing"
              onFocus={() => setSearchFocused(true)}
              onBlur={() => setSearchFocused(false)}
            />

            {loading ? (
              <View style={styles.mediaState}>
                <ActivityIndicator color={semantic.textBrand} />
              </View>
            ) : error ? (
              <View style={styles.mediaState}>
                <Text style={styles.errorText}>{error}</Text>
              </View>
            ) : (
              <FlatList
                data={items}
                keyExtractor={(item) => item.id}
                numColumns={2}
                style={styles.list}
                columnWrapperStyle={styles.mediaRow}
                contentContainerStyle={styles.mediaList}
                keyboardShouldPersistTaps="handled"
                keyboardDismissMode="on-drag"
                ListEmptyComponent={
                  <Text style={styles.emptyText}>No results</Text>
                }
                renderItem={({ item }) => (
                  <Pressable
                    style={styles.mediaCard}
                    onPress={() => onPickMedia(item, tab)}
                  >
                    <Image
                      source={{ uri: item.previewUrl }}
                      style={styles.mediaThumb}
                      contentFit="cover"
                      cachePolicy="memory-disk"
                      transition={120}
                      recyclingKey={item.id}
                    />
                  </Pressable>
                )}
              />
            )}
          </Animated.View>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalRoot: {
    flex: 1,
    justifyContent: "flex-end",
  },
  backdrop: {
    ...StyleSheet.absoluteFill,
    backgroundColor: "rgba(16, 16, 19, 0.4)",
  },
  keyboardWrap: {
    width: "100%",
  },
  sheet: {
    backgroundColor: semantic.surfacePage,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    paddingTop: spacing.s4,
  },
  handle: {
    alignSelf: "center",
    width: 40,
    height: 4,
    borderRadius: radius.pill,
    backgroundColor: semantic.lineStrong,
    marginBottom: spacing.s5,
  },
  tabs: {
    flexDirection: "row",
    gap: spacing.s3,
    paddingHorizontal: spacing.gutterScreen,
    marginBottom: spacing.s4,
  },
  tab: {
    paddingHorizontal: spacing.s5,
    paddingVertical: spacing.s3,
    borderRadius: radius.pill,
    backgroundColor: semantic.surfaceTint,
  },
  tabActive: {
    backgroundColor: semantic.surfaceBrand,
  },
  tabLabel: {
    ...typography.label,
    color: semantic.textMuted,
    textTransform: "uppercase",
  },
  tabLabelActive: {
    color: semantic.textOnBrand,
  },
  search: {
    height: spacing.controlHSm,
    marginHorizontal: spacing.gutterScreen,
    borderRadius: radius.control,
    borderWidth: 1,
    borderColor: semantic.lineHairline,
    paddingHorizontal: spacing.s5,
    marginBottom: spacing.s4,
    fontFamily: fonts.body,
    fontSize: 15,
    color: semantic.textBody,
    backgroundColor: semantic.surfaceTint,
  },
  list: {
    flex: 1,
  },
  mediaList: {
    paddingHorizontal: spacing.gutterScreen,
    paddingBottom: spacing.s6,
    gap: spacing.s4,
  },
  mediaRow: {
    gap: spacing.s4,
  },
  mediaCard: {
    flex: 1,
    aspectRatio: 1.2,
    borderRadius: radius.md,
    overflow: "hidden",
    backgroundColor: semantic.surfaceTint,
  },
  mediaThumb: {
    width: "100%",
    height: "100%",
  },
  mediaState: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: spacing.s8,
  },
  errorText: {
    ...typography.bodySm,
    color: semantic.textBrand,
    textAlign: "center",
  },
  emptyText: {
    ...typography.bodySm,
    color: semantic.textMuted,
    textAlign: "center",
    marginTop: spacing.s8,
  },
});
