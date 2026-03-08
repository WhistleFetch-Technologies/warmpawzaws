import { CreateMeetingCommand } from "@aws-sdk/client-chime-sdk-meetings";
import { getMediaRegion, vidcorId } from "../endpoints/teleCommunication/constants/helpers";
import { CreateAttendeeCommand } from "@aws-sdk/client-chime-sdk-meetings";

export async function withChimeRetry<T>(
    fn: () => Promise<T>,
    opts: { maxRetries?: number; correlationId?: string } = {}
): Promise<T> {
    const { maxRetries = 3, correlationId } = opts;
    let lastErr: unknown;
    for (let i = 0; i < maxRetries; i++) {
        try {
            return await fn();
        } catch (err: any) {
            lastErr = err;
            vidlog('chime', 'retry', {
                attempt: i + 1,
                maxRetries,
                error: err?.message || String(err),
            }, correlationId);
            if (i < maxRetries - 1) {
                await new Promise((r) => setTimeout(r, 300 * Math.pow(2, i)));
            }
        }
    }
    throw lastErr;
}

export const createMettingID = async (chimeClient: any, bookingId: string, cid: string) => {
    const meetingResponse: any = await withChimeRetry(
        () =>
            chimeClient.send(
                new CreateMeetingCommand({
                    ClientRequestToken: `booking-${bookingId}-${Date.now()}`,
                    MediaRegion: getMediaRegion(),
                    ExternalMeetingId: bookingId,
                })
            ),
        { correlationId: cid }
    );

    return meetingResponse;
}


export /** Structured log helper */
    function vidlog(scope: string, event: string, data: Record<string, unknown>, correlationId?: string): void {
    const payload = JSON.stringify({
        scope: `video-call:${scope}`,
        event,
        vidcor: correlationId || vidcorId(),
        ...data,
        ts: new Date().toISOString(),
    });
    console.log(`[VIDEO CALL] ${payload}`);
}


export const createTokens = async (chimeClient: any, meetingId: any, customerId: any, vendorId: any, cid: string) => {
    const [customerAttendee, vendorAttendee]: any[] = await Promise.all([
        withChimeRetry(
            () =>
                chimeClient.send(
                    new CreateAttendeeCommand({
                        MeetingId: meetingId,
                        ExternalUserId: `customer-${customerId}`,
                    })
                ),
            { correlationId: cid }
        ),
        withChimeRetry(
            () =>
                chimeClient.send(
                    new CreateAttendeeCommand({
                        MeetingId: meetingId,
                        ExternalUserId: `vendor-${vendorId}`,
                    })
                ),
            { correlationId: cid }
        ),
    ]);
    return { customerAttendee, vendorAttendee };
}

export const createSingleToken = async (chimeClient: any, newMeetingId: any, userType: any, userId: any, cid: string) => {
    const attendeeResponse = await withChimeRetry(
        () =>
            chimeClient.send(
                new CreateAttendeeCommand({
                    MeetingId: newMeetingId,
                    ExternalUserId: `${userType}-${userId}`,
                })
            ),
        { correlationId: cid }
    );
    return attendeeResponse;
}