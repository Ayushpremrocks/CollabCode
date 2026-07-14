-- ============================================
-- Collaborative Code Editor — Database Schema
-- ============================================

CREATE TABLE IF NOT EXISTS users (
    id              BIGSERIAL PRIMARY KEY,
    username        VARCHAR(50) UNIQUE NOT NULL,
    email           VARCHAR(100) UNIQUE NOT NULL,
    password_hash   VARCHAR(255) NOT NULL,
    created_at      TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS rooms (
    id              BIGSERIAL PRIMARY KEY,
    room_code       VARCHAR(20) UNIQUE NOT NULL,
    name            VARCHAR(100) NOT NULL,
    owner_id        BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at      TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    last_active_at  TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    expires_at      TIMESTAMP WITH TIME ZONE DEFAULT (NOW() + INTERVAL '48 hours')
);

CREATE TABLE IF NOT EXISTS room_participants (
    id              BIGSERIAL PRIMARY KEY,
    room_id         BIGINT NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
    user_id         BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    joined_at       TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(room_id, user_id)
);

-- Multi-snapshot table
CREATE TABLE IF NOT EXISTS document_snapshots (
    id              BIGSERIAL PRIMARY KEY,
    room_id         BIGINT NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
    document_data   BYTEA,
    language        VARCHAR(30) DEFAULT 'javascript',
    snapshot_label  VARCHAR(100),
    updated_at      TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Safe migrations for existing databases
ALTER TABLE rooms ADD COLUMN IF NOT EXISTS last_active_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();
ALTER TABLE rooms ADD COLUMN IF NOT EXISTS expires_at TIMESTAMP WITH TIME ZONE DEFAULT (NOW() + INTERVAL '48 hours');
ALTER TABLE document_snapshots ADD COLUMN IF NOT EXISTS snapshot_label VARCHAR(100);
ALTER TABLE document_snapshots ALTER COLUMN language TYPE VARCHAR(30);
ALTER TABLE document_snapshots DROP CONSTRAINT IF EXISTS document_snapshots_room_id_key;

-- Clerk auth migration: add clerk_user_id, relax password_hash constraint
ALTER TABLE users ADD COLUMN IF NOT EXISTS clerk_user_id VARCHAR(255);
CREATE UNIQUE INDEX IF NOT EXISTS idx_users_clerk_user_id ON users(clerk_user_id);
ALTER TABLE users ALTER COLUMN password_hash DROP NOT NULL;

-- Indexes for common queries
CREATE INDEX IF NOT EXISTS idx_rooms_room_code ON rooms(room_code);
CREATE INDEX IF NOT EXISTS idx_rooms_owner_id ON rooms(owner_id);
CREATE INDEX IF NOT EXISTS idx_rooms_expires_at ON rooms(expires_at);
CREATE INDEX IF NOT EXISTS idx_room_participants_room_id ON room_participants(room_id);
CREATE INDEX IF NOT EXISTS idx_room_participants_user_id ON room_participants(user_id);
CREATE INDEX IF NOT EXISTS idx_document_snapshots_room_id ON document_snapshots(room_id);
CREATE INDEX IF NOT EXISTS idx_document_snapshots_updated_at ON document_snapshots(room_id, updated_at DESC);
