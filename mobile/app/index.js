import { useEffect } from "react";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";
import { router } from "expo-router";
import { onAuthStateChanged } from "firebase/auth";
import BrandMark from "../components/BrandMark";
import { auth } from "../lib/firebase";

export default function Index() {
  useEffect(() => {
    return onAuthStateChanged(auth, (user) => {
      router.replace(user ? "/home" : "/login");
    });
  }, []);

  return (
    <View style={styles.container}>
      <BrandMark />
      <ActivityIndicator size="large" style={{ marginTop: 28 }} />
      <Text style={styles.text}>Connecting…</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1, alignItems: "center", justifyContent: "center",
    padding: 24, backgroundColor: "#f8fbfb"
  },
  text: { marginTop: 12, color: "#607074" }
});
