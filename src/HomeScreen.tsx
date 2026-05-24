import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { User } from "firebase/auth";
import { signOut } from "firebase/auth";
import { auth } from "./firebase";
import { colors, spacing } from "./theme";

type Props = {
  user: User;
};

export function HomeScreen({ user }: Props) {
  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        <Text style={styles.eyebrow}>READY</Text>
        <Text style={styles.title}>You’re signed in.</Text>
        <Text style={styles.subtitle}>
          {user.email || user.uid}
        </Text>
        <Text style={styles.caption}>
          Auth sync and onboarding are connected to the backend. You can replace this screen with the rest of your app flow.
        </Text>

        <Pressable style={styles.button} onPress={() => signOut(auth)}>
          <Text style={styles.buttonText}>Sign out</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.bone
  },
  container: {
    flex: 1,
    paddingHorizontal: spacing.screenX,
    paddingVertical: spacing.screenY,
    justifyContent: "center"
  },
  eyebrow: {
    color: colors.inkMute,
    fontSize: 12,
    letterSpacing: 2,
    marginBottom: 12
  },
  title: {
    fontSize: 36,
    color: colors.ink,
    lineHeight: 42
  },
  subtitle: {
    marginTop: 12,
    color: colors.terracotta,
    fontSize: 16
  },
  caption: {
    marginTop: 18,
    color: colors.inkMute,
    fontSize: 14,
    lineHeight: 22
  },
  button: {
    marginTop: 28,
    backgroundColor: colors.ink,
    borderRadius: 999,
    paddingVertical: 16,
    alignItems: "center"
  },
  buttonText: {
    color: colors.bone,
    fontSize: 16,
    fontWeight: "600"
  }
});
