import { Droplets, ShieldAlert, ShieldCheck, HelpCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  RESIN_POLICY_LABELS,
  type ResinPolicy,
} from "@/domain/schemas/event";

export function ResinBadge({ policy }: { policy: ResinPolicy }) {
  if (policy === "RESIN_ALLOWED") {
    return (
      <Badge variant="fit" className="gap-1">
        <ShieldCheck className="h-3 w-3" />
        {RESIN_POLICY_LABELS[policy]}
      </Badge>
    );
  }
  if (policy === "RESIN_FORBIDDEN") {
    return (
      <Badge variant="injured" className="gap-1">
        <ShieldAlert className="h-3 w-3" />
        {RESIN_POLICY_LABELS[policy]}
      </Badge>
    );
  }
  if (policy === "WATER_SOLUBLE_ONLY") {
    return (
      <Badge variant="unavailable" className="gap-1">
        <Droplets className="h-3 w-3" />
        {RESIN_POLICY_LABELS[policy]}
      </Badge>
    );
  }
  return (
    <Badge variant="secondary" className="gap-1">
      <HelpCircle className="h-3 w-3" />
      {RESIN_POLICY_LABELS[policy]}
    </Badge>
  );
}
