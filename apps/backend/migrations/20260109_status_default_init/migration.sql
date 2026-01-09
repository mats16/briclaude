-- Change default value of status column from 'idle' to 'init'
ALTER TABLE "sessions" ALTER COLUMN "status" SET DEFAULT 'init';
