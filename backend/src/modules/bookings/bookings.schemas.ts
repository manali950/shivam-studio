import { z } from 'zod';
import { dateOnly, email, listQuery, longText, phone, qbool, reqText, uuid } from '../../lib/validation.js';
 
export const BOOKING_STATUSES = ['enquiry', 'pending', 'confirmed', 'completed', 'rejected', 'cancelled'] as const;
const PAYMENT = ['unpaid', 'partial', 'paid', 'refunded'] as const;
const SOURCES = ['website', 'whatsapp', 'referral', 'manual'] as const;
const nullableId = z.union([uuid, z.literal(''), z.null()]).transform((v) => v || null);
 
const customer = z.object({ name: reqText(100, 'Enter your name'), email, phone });
 
export const createBookingSchema = z.object({
  serviceId: uuid, packageId: nullableId.optional(), eventDate: dateOnly, location: reqText(200, 'Enter the event location'),
  guestCount: z.number().int().min(0).max(100_000).nullable().optional(), requirements: longText(2000).optional(), customer,
  // Only studio staff may set these when creating a booking by hand; they are ignored for public enquiries.
  source: z.enum(SOURCES).optional(), amount: z.number().min(0).max(1_000_000_000).optional(), status: z.enum(BOOKING_STATUSES).optional(),
});
 
export const updateBookingSchema = z.object({
  serviceId: uuid, packageId: nullableId, eventDate: dateOnly, location: reqText(200), guestCount: z.number().int().min(0).max(100_000).nullable(), requirements: longText(2000),
  amount: z.number().min(0).max(1_000_000_000), paidAmount: z.number().min(0).max(1_000_000_000), paymentStatus: z.enum(PAYMENT), source: z.enum(SOURCES),
  customer: customer.partial(),
}).partial();
 
export const statusSchema = z.object({ status: z.enum(BOOKING_STATUSES), note: z.string().trim().max(1000).optional() });
export const assignSchema = z.object({ photographerIds: z.array(uuid).max(20).refine((a) => new Set(a).size === a.length, 'Duplicate photographers') });
export const noteSchema = z.object({ text: z.string().trim().min(1, 'Note cannot be empty.').max(2000) });
 
export const bookingQuery = listQuery.extend({
  status: z.enum(BOOKING_STATUSES).optional(), clientId: uuid.optional(), photographerId: uuid.optional(), paymentStatus: z.enum(PAYMENT).optional(),
  from: dateOnly.optional(), to: dateOnly.optional(), unpaid: qbool.optional(),
});