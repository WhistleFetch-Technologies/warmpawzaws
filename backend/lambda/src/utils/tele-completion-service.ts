/**
 * Centralized tele consultation completion: attendance, overlap, qualification, earnings.
 * All tele completion paths (end-call, vendor complete) must go through this module.
 */
import { query, select, update } from '../database/rds-connection';
import { BookingStatus } from '../endpoints/constants';
import { vidlog } from '../aws/aws-Chime-service';
import { ensureVendorEarningsForCompletedBooking } from './vendor-earnings-on-completion';

/** Minimum simultaneous presence required to qualify (3 minutes). */
export const MIN_OVERLAP_SECONDS = 180;

export type TeleCompletionStatus =
  | 'waiting_for_vendor'
  | 'vendor_no_show'
  | 'customer_no_show'
  | 'incomplete_call'
  | 'qualified'
  | 'disputed';

export type TeleCompletionSource = 'end_call' | 'vendor_complete' | 'system';

export interface TeleQualificationEvaluation {
  qualified: boolean;
  teleCompletionStatus: TeleCompletionStatus;
  overlapSeconds: number;
}

export interface CompleteTeleConsultationResult {
  qualified: boolean;
  teleCompletionStatus: TeleCompletionStatus;
  overlapSeconds: number;
  bookingCompleted: boolean;
  earningsCreated: boolean;
  alreadyCompleted: boolean;
  message: string;
}

export interface VideoCallSessionRow {
  id: string;
  booking_id: string;
  status?: string;
  customer_joined_at?: string | Date | null;
  vendor_joined_at?: string | Date | null;
  customer_left_at?: string | Date | null;
  vendor_left_at?: string | Date | null;
  overlap_duration_seconds?: number;
  completion_qualified?: boolean;
  consultation_started_at?: string | Date | null;
  call_timer_remaining_seconds?: number | null;
  call_timer_running_since?: string | Date | null;
  overlap_segment_started_at?: string | Date | null;
  vendor_id?: string;
}

export interface CallTimerState {
  serviceDurationMinutes: number;
  serviceDurationSeconds: number;
  consultationStartedAt: string | null;
  callRemainingSeconds: number;
  consultationActive: boolean;
  /** True when countdown is frozen (one party left or waiting for both). */
  timerPaused: boolean;
  /** Wall-clock anchor while both are present and timer is ticking. */
  timerRunningSince: string | null;
  /** Seconds remaining when the current run segment started (DB frozen base, not live remaining). */
  timerBaseSeconds: number | null;
}

export function isParticipantPresent(
  session: Pick<
    VideoCallSessionRow,
    'customer_joined_at' | 'vendor_joined_at' | 'customer_left_at' | 'vendor_left_at'
  >,
  participantType: 'customer' | 'vendor'
): boolean {
  if (participantType === 'customer') {
    return !!parseTs(session.customer_joined_at) && !parseTs(session.customer_left_at);
  }
  return !!parseTs(session.vendor_joined_at) && !parseTs(session.vendor_left_at);
}

export function areBothParticipantsPresent(
  session: Pick<
    VideoCallSessionRow,
    'customer_joined_at' | 'vendor_joined_at' | 'customer_left_at' | 'vendor_left_at'
  >
): boolean {
  return isParticipantPresent(session, 'customer') && isParticipantPresent(session, 'vendor');
}

/**
 * Pausable slot timer: ticks only while both parties are present.
 * Frozen remaining is stored on leave / refresh.
 */
export function computePausableCallRemaining(
  session: VideoCallSessionRow | null,
  serviceDurationSeconds: number,
  now: Date = new Date()
): number {
  const slot = Math.max(0, Math.round(serviceDurationSeconds) || 0);
  if (!session) return slot;

  const frozen =
    session.call_timer_remaining_seconds != null
      ? Math.max(0, Number(session.call_timer_remaining_seconds))
      : null;
  const runningSince = parseTs(session.call_timer_running_since);
  const bothPresent = areBothParticipantsPresent(session);

  if (bothPresent && runningSince) {
    const base = frozen ?? slot;
    const elapsed = Math.floor((now.getTime() - runningSince.getTime()) / 1000);
    return Math.max(0, base - elapsed);
  }
  if (frozen != null) {
    return frozen;
  }
  return slot;
}

/** @deprecated Use computePausableCallRemaining — kept for unit tests of wall-clock helper. */
export function computeCallRemainingSeconds(
  serviceDurationSeconds: number,
  consultationStartedAt: Date | null,
  now: Date = new Date()
): number {
  const slot = Math.max(0, Math.round(serviceDurationSeconds) || 0);
  if (!consultationStartedAt || slot <= 0) {
    return slot;
  }
  const elapsed = Math.floor((now.getTime() - consultationStartedAt.getTime()) / 1000);
  return Math.max(0, slot - elapsed);
}

/** Total qualified overlap including completed segments and the active segment. */
export function getTotalOverlapSeconds(
  session: VideoCallSessionRow,
  now: Date = new Date()
): number {
  const accumulated = Math.max(0, Number(session.overlap_duration_seconds ?? 0) || 0);
  const customerJoinedAt = parseTs(session.customer_joined_at);
  const vendorJoinedAt = parseTs(session.vendor_joined_at);
  if (!customerJoinedAt || !vendorJoinedAt) {
    return accumulated;
  }

  if (areBothParticipantsPresent(session)) {
    const segmentStart =
      parseTs(session.overlap_segment_started_at) ??
      new Date(Math.max(customerJoinedAt.getTime(), vendorJoinedAt.getTime()));
    const segmentSecs = Math.floor((now.getTime() - segmentStart.getTime()) / 1000);
    return accumulated + Math.max(0, segmentSecs);
  }

  const closedOverlap = calculateOverlapSeconds(
    customerJoinedAt,
    parseTs(session.customer_left_at),
    vendorJoinedAt,
    parseTs(session.vendor_left_at),
    now
  );
  return Math.max(accumulated, closedOverlap);
}

/** Server-backed call timer for scheduled/instant tele (survives refresh; pauses on leave). */
export async function resolveCallTimerStateForBooking(
  bookingId: string,
  session: VideoCallSessionRow | null,
  now: Date = new Date()
): Promise<CallTimerState> {
  const { resolvePlannedServiceDurationMinutesFromBookingId } = await import(
    '../lib/booking-service-duration'
  );
  const serviceDurationMinutes = await resolvePlannedServiceDurationMinutesFromBookingId(bookingId);
  const serviceDurationSeconds = serviceDurationMinutes * 60;
  const bothPresent = session ? areBothParticipantsPresent(session) : false;
  const runningSince = session ? parseTs(session.call_timer_running_since) : null;
  const bothJoinedAt =
    session && bothPresent
      ? (() => {
          const c = parseTs(session.customer_joined_at);
          const v = parseTs(session.vendor_joined_at);
          if (!c || !v) return null;
          return new Date(Math.max(c.getTime(), v.getTime()));
        })()
      : null;
  const effectiveRunningSince = runningSince ?? bothJoinedAt;
  const timerBaseSeconds =
    session?.call_timer_remaining_seconds != null
      ? Math.max(0, Number(session.call_timer_remaining_seconds))
      : null;
  const consultationStartedAt =
    parseTs(session?.consultation_started_at) ?? bothJoinedAt ?? effectiveRunningSince;

  return {
    serviceDurationMinutes,
    serviceDurationSeconds,
    consultationStartedAt: consultationStartedAt?.toISOString() ?? null,
    callRemainingSeconds: computePausableCallRemaining(session, serviceDurationSeconds, now),
    consultationActive: bothPresent,
    timerPaused: !bothPresent,
    timerRunningSince:
      bothPresent && effectiveRunningSince ? effectiveRunningSince.toISOString() : null,
    timerBaseSeconds:
      timerBaseSeconds ??
      (bothPresent && effectiveRunningSince
        ? computePausableCallRemaining(session, serviceDurationSeconds, now)
        : null),
  };
}

function parseTs(value: string | Date | null | undefined): Date | null {
  if (value == null || value === '') return null;
  const d = value instanceof Date ? value : new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

/**
 * Overlap starts when both joined; ends when either leaves (or `now` if still present).
 */
export function calculateOverlapSeconds(
  customerJoinedAt: Date | null,
  customerLeftAt: Date | null,
  vendorJoinedAt: Date | null,
  vendorLeftAt: Date | null,
  now: Date = new Date()
): number {
  if (!customerJoinedAt || !vendorJoinedAt) {
    return 0;
  }

  const overlapStartMs = Math.max(customerJoinedAt.getTime(), vendorJoinedAt.getTime());
  const customerEndMs = (customerLeftAt ?? now).getTime();
  const vendorEndMs = (vendorLeftAt ?? now).getTime();
  const overlapEndMs = Math.min(customerEndMs, vendorEndMs);

  if (overlapEndMs <= overlapStartMs) {
    return 0;
  }

  return Math.floor((overlapEndMs - overlapStartMs) / 1000);
}

export function evaluateTeleQualification(
  session: Pick<
    VideoCallSessionRow,
    | 'customer_joined_at'
    | 'vendor_joined_at'
    | 'customer_left_at'
    | 'vendor_left_at'
    | 'overlap_duration_seconds'
    | 'overlap_segment_started_at'
  >,
  now: Date = new Date()
): TeleQualificationEvaluation {
  const customerJoinedAt = parseTs(session.customer_joined_at);
  const vendorJoinedAt = parseTs(session.vendor_joined_at);

  const overlapSeconds = getTotalOverlapSeconds(session as VideoCallSessionRow, now);

  const customerJoined = !!customerJoinedAt;
  const vendorJoined = !!vendorJoinedAt;

  if (customerJoined && !vendorJoined) {
    return { qualified: false, teleCompletionStatus: 'vendor_no_show', overlapSeconds };
  }
  if (vendorJoined && !customerJoined) {
    return { qualified: false, teleCompletionStatus: 'customer_no_show', overlapSeconds };
  }
  if (customerJoined && vendorJoined && overlapSeconds >= MIN_OVERLAP_SECONDS) {
    return { qualified: true, teleCompletionStatus: 'qualified', overlapSeconds };
  }
  if (customerJoined && vendorJoined && overlapSeconds < MIN_OVERLAP_SECONDS) {
    return { qualified: false, teleCompletionStatus: 'incomplete_call', overlapSeconds };
  }

  return { qualified: false, teleCompletionStatus: 'incomplete_call', overlapSeconds: 0 };
}

function teleLog(
  event: string,
  data: Record<string, unknown>,
  correlationId?: string
): void {
  vidlog('tele-completion', event, data, correlationId);
}

export function isTeleBooking(booking: Record<string, unknown>): boolean {
  const st = String(booking.service_type ?? booking.service_style ?? '').toLowerCase();
  return (
    st === 'tele' ||
    st === 'video_consultation' ||
    st === 'teleconsultation' ||
    st === 'video' ||
    st === 'online'
  );
}

async function loadSessionRow(sessionId: string): Promise<VideoCallSessionRow | null> {
  const rows = await select('video_call_sessions', { id: sessionId });
  return (rows[0] as VideoCallSessionRow) ?? null;
}

/** Flush active overlap segment and freeze pausable timer (before marking leave). */
async function pauseCallTimerAndFlushOverlap(
  session: VideoCallSessionRow,
  bookingId: string,
  serviceDurationSeconds: number,
  now: Date = new Date()
): Promise<void> {
  const remaining = computePausableCallRemaining(session, serviceDurationSeconds, now);
  let accumulated = Math.max(0, Number(session.overlap_duration_seconds ?? 0) || 0);

  if (areBothParticipantsPresent(session)) {
    const segmentStart =
      parseTs(session.overlap_segment_started_at) ??
      (() => {
        const c = parseTs(session.customer_joined_at);
        const v = parseTs(session.vendor_joined_at);
        if (!c || !v) return null;
        return new Date(Math.max(c.getTime(), v.getTime()));
      })();
    if (segmentStart) {
      accumulated += Math.max(0, Math.floor((now.getTime() - segmentStart.getTime()) / 1000));
    }
  }

  await query(
    `UPDATE video_call_sessions
     SET call_timer_remaining_seconds = $2,
         call_timer_running_since = NULL,
         overlap_segment_started_at = NULL,
         overlap_duration_seconds = $3,
         updated_at = NOW()
     WHERE id = $1::uuid`,
    [session.id, remaining, accumulated]
  );

  teleLog('timer-paused', { bookingId, sessionId: session.id, remaining, accumulated }, undefined);
}

/** Persist final overlap tally before qualification (handles in-call end without prior leave). */
export async function flushFinalOverlapForSession(
  sessionId: string,
  now: Date = new Date()
): Promise<number> {
  const session = await loadSessionRow(sessionId);
  if (!session) return 0;
  const overlapSeconds = getTotalOverlapSeconds(session, now);
  await query(
    `UPDATE video_call_sessions
     SET overlap_duration_seconds = GREATEST(COALESCE(overlap_duration_seconds, 0), $2),
         overlap_segment_started_at = NULL,
         call_timer_running_since = NULL,
         updated_at = NOW()
     WHERE id = $1::uuid`,
    [sessionId, overlapSeconds]
  );
  return overlapSeconds;
}

/** Resume slot countdown when both parties are present again. */
async function resumeCallTimerIfBothPresent(
  sessionId: string,
  bookingId: string,
  serviceDurationSeconds: number
): Promise<void> {
  const slot = Math.max(0, Math.round(serviceDurationSeconds) || 0);
  await query(
    `UPDATE video_call_sessions
     SET call_timer_remaining_seconds = COALESCE(call_timer_remaining_seconds, $2),
         call_timer_running_since = CASE
           WHEN customer_joined_at IS NOT NULL AND vendor_joined_at IS NOT NULL
                AND customer_left_at IS NULL AND vendor_left_at IS NULL
           THEN COALESCE(call_timer_running_since, NOW())
           ELSE call_timer_running_since
         END,
         overlap_segment_started_at = CASE
           WHEN customer_joined_at IS NOT NULL AND vendor_joined_at IS NOT NULL
                AND customer_left_at IS NULL AND vendor_left_at IS NULL
           THEN COALESCE(overlap_segment_started_at, NOW())
           ELSE overlap_segment_started_at
         END,
         consultation_started_at = COALESCE(
           consultation_started_at,
           GREATEST(customer_joined_at, vendor_joined_at)
         ),
         updated_at = NOW()
     WHERE id = $1::uuid`,
    [sessionId, slot]
  );

  teleLog('timer-resumed-if-both', { bookingId, sessionId }, undefined);
}

/** Record join / rejoin (clears leave timestamp so accidental leave can return). */
export async function recordParticipantJoined(
  sessionId: string,
  participantType: 'customer' | 'vendor',
  bookingId: string,
  correlationId?: string
): Promise<void> {
  const joinedCol =
    participantType === 'customer' ? 'customer_joined_at' : 'vendor_joined_at';
  const leftCol =
    participantType === 'customer' ? 'customer_left_at' : 'vendor_left_at';

  await query(
    `UPDATE video_call_sessions
     SET ${joinedCol} = COALESCE(${joinedCol}, NOW()),
         ${leftCol} = NULL,
         updated_at = NOW()
     WHERE id = $1::uuid`,
    [sessionId]
  );

  const { resolvePlannedServiceDurationMinutesFromBookingId } = await import(
    '../lib/booking-service-duration'
  );
  const serviceDurationSeconds =
    (await resolvePlannedServiceDurationMinutesFromBookingId(bookingId)) * 60;
  await resumeCallTimerIfBothPresent(sessionId, bookingId, serviceDurationSeconds);

  teleLog(
    'participant-joined',
    { bookingId, sessionId, participantType },
    correlationId
  );
}

/** Leave without ending session — pauses timer; slot time preserved for rejoin. */
export async function recordParticipantLeft(
  sessionId: string,
  participantType: 'customer' | 'vendor',
  bookingId: string,
  correlationId?: string
): Promise<void> {
  const session = await loadSessionRow(sessionId);
  if (!session) return;

  const { resolvePlannedServiceDurationMinutesFromBookingId } = await import(
    '../lib/booking-service-duration'
  );
  const serviceDurationSeconds =
    (await resolvePlannedServiceDurationMinutesFromBookingId(bookingId)) * 60;
  const now = new Date();

  await pauseCallTimerAndFlushOverlap(session, bookingId, serviceDurationSeconds, now);

  const leftCol =
    participantType === 'customer' ? 'customer_left_at' : 'vendor_left_at';

  await query(
    `UPDATE video_call_sessions
     SET ${leftCol} = NOW(),
         updated_at = NOW()
     WHERE id = $1::uuid`,
    [sessionId]
  );

  teleLog(
    'participant-left',
    { bookingId, sessionId, participantType },
    correlationId
  );
}

export async function loadLatestSessionForBooking(
  bookingId: string
): Promise<VideoCallSessionRow | null> {
  const rows = await select('video_call_sessions', { booking_id: bookingId });
  if (!rows.length) return null;
  const sorted = [...rows].sort((a: any, b: any) => {
    const ta = new Date(a.updated_at ?? a.created_at ?? 0).getTime();
    const tb = new Date(b.updated_at ?? b.created_at ?? 0).getTime();
    return tb - ta;
  });
  return sorted[0] as VideoCallSessionRow;
}

export function getTeleCompletionUserMessage(status: TeleCompletionStatus): string {
  switch (status) {
    case 'vendor_no_show':
      return 'Vendor did not join the consultation.';
    case 'customer_no_show':
      return 'Customer did not join the consultation.';
    case 'incomplete_call':
      return 'Consultation ended before the minimum duration was met.';
    case 'qualified':
      return 'Consultation completed successfully.';
    case 'waiting_for_vendor':
      return 'Waiting for the vendor to join.';
    case 'disputed':
      return 'Consultation outcome is under review.';
    default:
      return 'Consultation ended.';
  }
}

/**
 * Idempotent tele completion orchestrator.
 * TODO(refund): trigger refund orchestration when teleCompletionStatus is vendor_no_show
 *   and payment_status = paid (see processRefund / instant-tele refund helpers).
 */
export async function completeTeleConsultation(params: {
  bookingId: string;
  sessionId: string;
  source: TeleCompletionSource;
  participantTypeEnding?: 'customer' | 'vendor';
  correlationId?: string;
  endSession?: boolean;
}): Promise<CompleteTeleConsultationResult> {
  const {
    bookingId,
    sessionId,
    source,
    participantTypeEnding,
    correlationId,
    endSession = true,
  } = params;

  const now = new Date();

  if (participantTypeEnding) {
    const sessionBeforeLeave = await loadSessionRow(sessionId);
    const alreadyLeft =
      participantTypeEnding === 'customer'
        ? !!parseTs(sessionBeforeLeave?.customer_left_at)
        : !!parseTs(sessionBeforeLeave?.vendor_left_at);
    if (!alreadyLeft) {
      await recordParticipantLeft(sessionId, participantTypeEnding, bookingId, correlationId);
    }
  }

  await flushFinalOverlapForSession(sessionId, now);

  const sessionRows = await select('video_call_sessions', { id: sessionId });
  const session = sessionRows[0] as VideoCallSessionRow | undefined;
  if (!session) {
    teleLog('session-not-found', { bookingId, sessionId }, correlationId);
    return {
      qualified: false,
      teleCompletionStatus: 'incomplete_call',
      overlapSeconds: 0,
      bookingCompleted: false,
      earningsCreated: false,
      alreadyCompleted: false,
      message: 'Video session not found',
    };
  }

  const evaluation = evaluateTeleQualification(session, now);

  teleLog(
    'overlap-calculated',
    {
      bookingId,
      sessionId,
      overlapSeconds: evaluation.overlapSeconds,
      teleCompletionStatus: evaluation.teleCompletionStatus,
      qualified: evaluation.qualified,
    },
    correlationId
  );

  const bookings = await select('bookings', { id: bookingId });
  const booking = bookings[0] as Record<string, unknown> | undefined;
  if (!booking) {
    return {
      qualified: false,
      teleCompletionStatus: evaluation.teleCompletionStatus,
      overlapSeconds: evaluation.overlapSeconds,
      bookingCompleted: false,
      earningsCreated: false,
      alreadyCompleted: false,
      message: 'Booking not found',
    };
  }

  const alreadyCompleted = String(booking.status ?? '').toLowerCase() === 'completed';

  if (alreadyCompleted && String(booking.tele_completion_status ?? '') === 'qualified') {
    teleLog('already-completed-qualified', { bookingId, sessionId }, correlationId);
    return {
      qualified: true,
      teleCompletionStatus: 'qualified',
      overlapSeconds: Number(session.overlap_duration_seconds ?? 0),
      bookingCompleted: true,
      earningsCreated: false,
      alreadyCompleted: true,
      message: getTeleCompletionUserMessage('qualified'),
    };
  }

  const sessionUpdate: Record<string, unknown> = {
    overlap_duration_seconds: evaluation.overlapSeconds,
    completion_qualified: evaluation.qualified,
    completion_source: source,
    consultation_completed_at: now,
    updated_at: now,
  };

  if (endSession) {
    sessionUpdate.status = 'completed';
    sessionUpdate.ended_at = now;
  }

  await update('video_call_sessions', { id: sessionId }, sessionUpdate);

  const bookingUpdate: Record<string, unknown> = {
    tele_completion_status: evaluation.teleCompletionStatus,
    updated_at: now,
  };

  if (evaluation.qualified) {
    bookingUpdate.video_call_duration = evaluation.overlapSeconds;
    bookingUpdate.video_call_ended_at = now.toISOString();
  }

  let bookingCompleted = alreadyCompleted;
  let earningsCreated = false;

  if (evaluation.qualified && !alreadyCompleted) {
    bookingUpdate.status = BookingStatus.COMPLETED;
    bookingUpdate.completed_at = now.toISOString();
    bookingCompleted = true;
  }

  await update('bookings', { id: bookingId }, bookingUpdate);

  if (bookingCompleted || alreadyCompleted) {
    await finalizeVideoCallSessionsForBooking(bookingId);
  }

  teleLog(
    'completion-decision',
    {
      bookingId,
      source,
      qualified: evaluation.qualified,
      teleCompletionStatus: evaluation.teleCompletionStatus,
      bookingCompleted,
      alreadyCompleted,
    },
    correlationId
  );

  if (evaluation.qualified) {
    const refreshed = await select('bookings', { id: bookingId });
    const refreshedBooking = refreshed[0] as Record<string, unknown>;
    earningsCreated = await ensureVendorEarningsForCompletedBooking(
      refreshedBooking,
      bookingId,
      '[TELE-EARNINGS]',
      { realizedAt: now.toISOString() }
    );
    teleLog(
      earningsCreated ? 'earnings-created' : 'earnings-skipped-or-exists',
      { bookingId, earningsCreated },
      correlationId
    );
  } else {
    teleLog(
      'earnings-skipped-not-qualified',
      { bookingId, teleCompletionStatus: evaluation.teleCompletionStatus },
      correlationId
    );
    // TODO(refund): vendor_no_show / incomplete_call with paid booking → enqueue refund review
  }

  // Restore vendor instant-tele availability when session ends (any outcome)
  const vendorId = session.vendor_id ?? booking.vendor_id;
  if (endSession && vendorId) {
    await update('vendors', { id: vendorId as string }, { available_for_instant_tele: true }).catch(
      () => undefined
    );
  }

  return {
    qualified: evaluation.qualified,
    teleCompletionStatus: evaluation.teleCompletionStatus,
    overlapSeconds: evaluation.overlapSeconds,
    bookingCompleted,
    earningsCreated,
    alreadyCompleted,
    message: getTeleCompletionUserMessage(evaluation.teleCompletionStatus),
  };
}

/** Close any lingering active/waiting sessions once a booking is finalized. */
export async function finalizeVideoCallSessionsForBooking(bookingId: string): Promise<number> {
  const result = await query(
    `UPDATE video_call_sessions
     SET status = 'completed',
         ended_at = COALESCE(ended_at, NOW()),
         updated_at = NOW()
     WHERE booking_id = $1
       AND status IN ('active', 'waiting')`,
    [bookingId]
  );
  return Number((result as any).rowCount ?? 0);
}

/** Vendor manual complete: must meet qualification thresholds. */
export async function validateTeleVendorCompleteEligibility(
  bookingId: string
): Promise<{ eligible: boolean; error?: string; evaluation?: TeleQualificationEvaluation }> {
  const session = await loadLatestSessionForBooking(bookingId);
  if (!session) {
    return {
      eligible: false,
      error: 'Cannot complete consultation because no video session was found.',
    };
  }

  const evaluation = evaluateTeleQualification(session, new Date());

  if (!session.customer_joined_at) {
    return {
      eligible: false,
      error: 'Cannot complete consultation because the customer did not join the call.',
      evaluation,
    };
  }
  if (!session.vendor_joined_at) {
    return {
      eligible: false,
      error: 'Cannot complete consultation because you did not join the call.',
      evaluation,
    };
  }
  if (evaluation.overlapSeconds < MIN_OVERLAP_SECONDS) {
    return {
      eligible: false,
      error: 'Cannot complete consultation because minimum consultation duration was not met.',
      evaluation,
    };
  }

  return { eligible: true, evaluation };
}
