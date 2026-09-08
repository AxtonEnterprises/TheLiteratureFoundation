import { useState } from "react";
import {
  Alert, KeyboardAvoidingView, Platform, Pressable, ScrollView,
  StyleSheet, Text, TextInput, View
} from "react-native";
import { router } from "expo-router";
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword
} from "firebase/auth";
import BrandMark from "../components/BrandMark";
import { auth } from "../lib/firebase";

export default function LoginScreen() {
  const [mode, setMode] = useState("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit() {
    if (!email.trim() || !password) {
      Alert.alert("Missing information", "Enter your email and password.");
      return;
    }
    try {
      setBusy(true);
      if (mode === "signup") {
        await createUserWithEmailAndPassword(auth, email.trim(), password);
      } else {
        await signInWithEmailAndPassword(auth, email.trim(), password);
      }
      router.replace("/home");
    } catch (error) {
      Alert.alert("Authentication error", error?.message || "Please try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
        <BrandMark />
        <View style={styles.card}>
          <Text style={styles.heading}>
            {mode === "signup" ? "Create your account" : "Welcome back"}
          </Text>
          <TextInput
            style={styles.input}
            value={email}
            onChangeText={setEmail}
            placeholder="Email"
            autoCapitalize="none"
            keyboardType="email-address"
          />
          <TextInput
            style={styles.input}
            value={password}
            onChangeText={setPassword}
            placeholder="Password"
            secureTextEntry
          />
          <Pressable style={styles.primaryButton} onPress={submit} disabled={busy}>
            <Text style={styles.primaryButtonText}>
              {busy ? "Please wait…" : mode === "signup" ? "Create account" : "Sign in"}
            </Text>
          </Pressable>
          <Pressable
            style={styles.switchButton}
            onPress={() => setMode(mode === "login" ? "signup" : "login")}
          >
            <Text style={styles.switchText}>
              {mode === "signup"
                ? "Already have an account? Sign in"
                : "New to Lit Chain? Create an account"}
            </Text>
          </Pressable>
          <Text style={styles.note}>
            Native Google sign-in will be added after Android/iOS OAuth registration.
          </Text>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: "#f8fbfb" },
  container: { flexGrow: 1, justifyContent: "center", padding: 24, gap: 32 },
  card: {
    width: "100%", maxWidth: 480, alignSelf: "center", backgroundColor: "#fff",
    borderRadius: 22, padding: 22, borderWidth: 1, borderColor: "#e3ecec"
  },
  heading: { fontSize: 24, fontWeight: "800", color: "#162224", marginBottom: 20 },
  input: {
    height: 52, borderWidth: 1, borderColor: "#cbd8d9", borderRadius: 14,
    paddingHorizontal: 16, marginBottom: 12, backgroundColor: "#fff", fontSize: 16
  },
  primaryButton: {
    minHeight: 52, borderRadius: 14, backgroundColor: "#3bb6b1",
    alignItems: "center", justifyContent: "center", marginTop: 4
  },
  primaryButtonText: { color: "#fff", fontSize: 16, fontWeight: "800" },
  switchButton: { paddingVertical: 16, alignItems: "center" },
  switchText: { color: "#287c79", fontWeight: "700" },
  note: { textAlign: "center", fontSize: 12, lineHeight: 17, color: "#7b8c90" }
});
