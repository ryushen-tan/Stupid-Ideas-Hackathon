import { Stack } from "expo-router";
import App from "../../App";

export default function Vault() {
  return (
    <>
      <Stack.Screen
        options={{
          headerShown: true,
          title: "Vault & scanners",
          headerBackTitle: "Drip",
          headerTintColor: "#A8C7FA",
          headerStyle: { backgroundColor: "#131314" },
        }}
      />
      <App />
    </>
  );
}
