-- Create instructor_details table
CREATE TABLE IF NOT EXISTS public.instructor_details (
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL,
    specialty_descriptor text NOT NULL,
    studios text NOT NULL,
    bio text,
    certifications text,
    contact_info text,
    instagram text,
    tiktok text,
    youtube text,
    website text,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    CONSTRAINT instructor_details_pkey PRIMARY KEY (id),
    CONSTRAINT instructor_details_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE,
    CONSTRAINT instructor_details_user_id_unique UNIQUE (user_id)
);

-- Create index on user_id for faster lookups
CREATE INDEX IF NOT EXISTS idx_instructor_details_user_id ON public.instructor_details USING btree (user_id);

-- Add RLS (Row Level Security) policies if needed
-- ALTER TABLE public.instructor_details ENABLE ROW LEVEL SECURITY;

-- Policy to allow users to read their own instructor details
-- CREATE POLICY "Users can view their own instructor details"
--     ON public.instructor_details
--     FOR SELECT
--     USING (auth.uid() = user_id);

-- Policy to allow users to update their own instructor details
-- CREATE POLICY "Users can update their own instructor details"
--     ON public.instructor_details
--     FOR UPDATE
--     USING (auth.uid() = user_id);

-- Policy to allow users to insert their own instructor details
-- CREATE POLICY "Users can insert their own instructor details"
--     ON public.instructor_details
--     FOR INSERT
--     WITH CHECK (auth.uid() = user_id);

