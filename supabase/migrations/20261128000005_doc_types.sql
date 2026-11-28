-- Step E (docs/20 §5): standalone document types that need no enrolment.
-- Kept in its own migration: a new enum value can only be used after this commits.
alter type public.doc_type add value if not exists 'participation';
alter type public.doc_type add value if not exists 'appreciation';
alter type public.doc_type add value if not exists 'custom_certificate';
