import type { Metadata, ResolvingMetadata } from "next";
import { BRANDING } from "@/config/branding";
import { formatMemberRoles } from "@/domain/schemas/handball";
import { formatTeamClubLabel } from "@/domain/services/invite-service";
import { services } from "@/infrastructure/services/container";

interface InviteLayoutProps {
  children: React.ReactNode;
  params: Promise<{ token: string }>;
}

export async function generateMetadata(
  { params }: { params: Promise<{ token: string }> },
  parent: ResolvingMetadata
): Promise<Metadata> {
  const { token } = await params;
  const resolvedParent = await parent;
  const previousImages = resolvedParent.openGraph?.images ?? [];
  const previousTwitterImages = resolvedParent.twitter?.images ?? [];

  try {
    const preview = await services.invite.previewInvite(token);
    if (!preview.isValid) {
      return {
        title: "Team-Einladung",
        description:
          preview.invalidReason ??
          `Diese Einladung bei ${BRANDING.appName} ist nicht mehr gültig.`,
        robots: { index: false, follow: false },
      };
    }
    const teamClub = formatTeamClubLabel(preview.teamName, preview.clubName);
    const roleLabel = formatMemberRoles(
      preview.roles?.length ? preview.roles : [preview.role],
      " / "
    );
    const title = teamClub ? `Einladung: ${teamClub}` : "Team-Einladung";
    // DSGVO: Keine personenbezogenen Daten (wie targetMemberFirstName) in
    // öffentlichen Open-Graph-Vorschauen von Messengern ausgeben.
    const description = teamClub
      ? `Tritt ${teamClub} als ${roleLabel} bei ${BRANDING.appName} bei (Saison ${preview.seasonName}).`
      : `Tritt deinem Team als ${roleLabel} bei ${BRANDING.appName} bei.`;

    return {
      title,
      description,
      robots: { index: false, follow: false },
      openGraph: {
        type: "website",
        locale: "de_DE",
        siteName: BRANDING.appName,
        title: `${title} | ${BRANDING.appName}`,
        description,
        images: previousImages,
      },
      twitter: {
        card: "summary_large_image",
        title: `${title} | ${BRANDING.appName}`,
        description,
        images: previousTwitterImages,
      },
    };
  } catch {
    return {
      title: "Team-Einladung",
      description: `Tritt deinem Handball-Team bei ${BRANDING.appName} bei.`,
      robots: { index: false, follow: false },
    };
  }
}

export default function InviteTokenLayout({ children }: InviteLayoutProps) {
  return children;
}
