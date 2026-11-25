import {
  RegisterPushTokenSchema,
  UnregisterPushTokenSchema,
} from "@throwoff/shared";
import { requireViewerContext } from "@/infrastructure/auth/session";
import { prisma } from "@/infrastructure/db/prisma";
import {
  handleApiError,
  jsonCreated,
  jsonOk,
  parseJsonBody,
} from "@/infrastructure/http/api-handler";

export async function POST(request: Request) {
  try {
    const viewer = await requireViewerContext(request.headers);
    const body = await parseJsonBody(request);
    const input = RegisterPushTokenSchema.parse(body);

    const device = await prisma.pushDevice.upsert({
      where: { expoPushToken: input.expoPushToken },
      create: {
        userId: viewer.userId,
        expoPushToken: input.expoPushToken,
        platform: input.platform,
        deviceName: input.deviceName ?? null,
        appVersion: input.appVersion ?? null,
        enabled: true,
        lastSeenAt: new Date(),
      },
      update: {
        userId: viewer.userId,
        platform: input.platform,
        deviceName: input.deviceName ?? null,
        appVersion: input.appVersion ?? null,
        enabled: true,
        lastSeenAt: new Date(),
      },
      select: {
        id: true,
        platform: true,
        enabled: true,
        lastSeenAt: true,
      },
    });

    return jsonCreated({ device });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function DELETE(request: Request) {
  try {
    const viewer = await requireViewerContext(request.headers);
    const body = await parseJsonBody(request);
    const input = UnregisterPushTokenSchema.parse(body);

    const result = await prisma.pushDevice.updateMany({
      where: {
        userId: viewer.userId,
        expoPushToken: input.expoPushToken,
      },
      data: {
        enabled: false,
      },
    });

    return jsonOk({ unregistered: result.count > 0 });
  } catch (error) {
    return handleApiError(error);
  }
}
