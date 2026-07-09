import { Redirect } from "expo-router";
import { ActivityIndicator, View } from "react-native";
import { useAuth } from "../src/context/auth-context";
import { colors } from "../src/theme/colors";

export default function Index() {
  const { player, isLoading } = useAuth();

  if (isLoading) {
    return (
      <View
        style={{
          flex: 1,
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: colors.background,
        }}
      >
        <ActivityIndicator color={colors.pinkPrimary} />
      </View>
    );
  }

  return <Redirect href={player ? "/lobby" : "/auth/login"} />;
}