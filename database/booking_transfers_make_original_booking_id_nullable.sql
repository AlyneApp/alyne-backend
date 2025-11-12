-- Make original_booking_id nullable to support manual bookings
ALTER TABLE booking_transfers 
ALTER COLUMN original_booking_id DROP NOT NULL;

