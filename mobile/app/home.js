import { Pressable, StyleSheet, Text, View } from "react-native";
import { router } from "expo-router";
import { signOut } from "firebase/auth";
import BrandMark from "../components/BrandMark";
import { auth } from "../lib/firebase";

export default function HomeScreen() {
  async function logout() {
    await signOut(auth);
    router.replace("/login");
  }

  return (
    <View style={styles.container}>
      <BrandMark />
      <View style={styles.card}>
        <Text style={styles.heading}>Mobile foundation connected</Text>
        <Text style={styles.body}>
          Firebase email/password authentication is working. The Chain feed and reader come next.
        </Text>
        <Text style={styles.email}>{auth.currentUser?.email}</Text>
        <Pressable style={styles.button} onPress={logout}>
          <Text style={styles.buttonText}>Sign out</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f8fbfb", padding: 24, justifyContent: "center" },
  card: {
    width: "100%", maxWidth: 480, alignSelf: "center", marginTop: 32,
    borderWidth: 1, borderColor: "#e3ecec", borderRadius: 22, padding: 22, backgroundColor: "#fff"
  },
  heading: { color: "#162224", fontSize: 22, fontWeight: "800" },
  body: { color: "#607074", marginTop: 10, lineHeight: 21 },
  email: { marginTop: 18, color: "#162224", fontWeight: "700" },
  button: {
    minHeight: 50, backgroundColor: "#FFC00E", borderRadius: 14,
    alignItems: "center", justifyContent: "center", marginTop: 22
  },
  buttonText: { color: "#162224", fontWeight: "800", fontSize: 16 }
});
