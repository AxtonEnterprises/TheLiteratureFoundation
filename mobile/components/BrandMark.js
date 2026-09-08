import { StyleSheet, Text, View } from "react-native";

export default function BrandMark() {
  return (
    <View style={styles.wrap}>
      <View style={styles.icon}><Text style={styles.iconText}>LC</Text></View>
      <Text style={styles.title}>Lit Chain</Text>
      <Text style={styles.tagline}>Read. Connect. Continue the chain.</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: "center" },
  icon: {
    width: 78, height: 78, borderRadius: 20, backgroundColor: "#3bb6b1",
    alignItems: "center", justifyContent: "center", marginBottom: 14
  },
  iconText: { color: "#fff", fontSize: 28, fontWeight: "800" },
  title: { fontSize: 30, fontWeight: "800", color: "#162224" },
  tagline: { marginTop: 4, color: "#607074", fontSize: 14 }
});
