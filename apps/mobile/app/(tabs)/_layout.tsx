import { Tabs } from "expo-router";
import React from "react";
import { Text, type ColorValue } from "react-native";
import { colors } from "../../src/theme";

function TabIcon({ glyph, color }: { glyph: string; color: ColorValue }) {
  return <Text style={{ color, fontSize: 18 }}>{glyph}</Text>;
}

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerStyle: { backgroundColor: colors.surface },
        headerTintColor: colors.text,
        tabBarStyle: {
          backgroundColor: colors.surface,
          borderTopColor: colors.border,
        },
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textMuted,
        sceneStyle: { backgroundColor: colors.background },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "Start",
          tabBarIcon: ({ color }) => <TabIcon glyph="⌂" color={color} />,
        }}
      />
      <Tabs.Screen
        name="termine"
        options={{
          title: "Termine",
          tabBarIcon: ({ color }) => <TabIcon glyph="▦" color={color} />,
        }}
      />
      <Tabs.Screen
        name="team"
        options={{
          title: "Team",
          tabBarIcon: ({ color }) => <TabIcon glyph="☰" color={color} />,
        }}
      />
      <Tabs.Screen
        name="taktik"
        options={{
          title: "Playbook",
          tabBarIcon: ({ color }) => <TabIcon glyph="◎" color={color} />,
        }}
      />
      <Tabs.Screen
        name="dienste"
        options={{
          title: "Dienste",
          tabBarIcon: ({ color }) => <TabIcon glyph="✓" color={color} />,
        }}
      />
    </Tabs>
  );
}
