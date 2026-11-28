-- AlterTable: Multi-role support on team_member and team_invite
ALTER TABLE "team_member" ADD COLUMN IF NOT EXISTS "roles" "MemberRole"[] NOT NULL DEFAULT ARRAY['PLAYER']::"MemberRole"[];
ALTER TABLE "team_invite" ADD COLUMN IF NOT EXISTS "roles" "MemberRole"[] NOT NULL DEFAULT ARRAY[]::"MemberRole"[];

-- Backfill team_member.roles from existing primary role
UPDATE "team_member"
SET "roles" = ARRAY["role"]::"MemberRole"[];

-- Include CLUB_ADMIN in roles wherever isClubAdmin flag is set
UPDATE "team_member"
SET "roles" = array_append("roles", 'CLUB_ADMIN'::"MemberRole")
WHERE "isClubAdmin" = true
  AND NOT ('CLUB_ADMIN'::"MemberRole" = ANY("roles"));

-- Promote legacy teamRoles entry 'Kassenwart' to first-class TREASURER role
UPDATE "team_member"
SET "roles" = array_append("roles", 'TREASURER'::"MemberRole")
WHERE EXISTS (
  SELECT 1 FROM unnest("teamRoles") AS tr WHERE lower(btrim(tr)) = 'kassenwart'
)
  AND NOT ('TREASURER'::"MemberRole" = ANY("roles"));

-- Clean up legacy 'Kassenwart' from teamRoles now that it is a first-class MemberRole
UPDATE "team_member"
SET "teamRoles" = COALESCE(
  (SELECT array_agg(tr) FROM unnest("teamRoles") AS tr WHERE lower(btrim(tr)) <> 'kassenwart'),
  ARRAY[]::TEXT[]
)
WHERE EXISTS (
  SELECT 1 FROM unnest("teamRoles") AS tr WHERE lower(btrim(tr)) = 'kassenwart'
);

-- Backfill team_invite.roles from existing role
UPDATE "team_invite"
SET "roles" = ARRAY["role"]::"MemberRole"[]
WHERE cardinality("roles") = 0;
