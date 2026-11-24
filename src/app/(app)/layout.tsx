import { AppShell } from "@/components/layout/app-shell";
import { AppProvider } from "@/components/providers/app-context";

export default function AuthenticatedAppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <AppProvider>
      <AppShell>{children}</AppShell>
    </AppProvider>
  );
}
