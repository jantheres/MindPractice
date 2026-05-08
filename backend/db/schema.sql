-- MindPractice Database Schema

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Table for logging consent (MANDATORY before audio capture)
CREATE TABLE IF NOT EXISTS consent_log (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    appointment_id UUID NOT NULL,
    therapist_id UUID NOT NULL,
    therapist_consent_at TIMESTAMPTZ,
    client_consent_at TIMESTAMPTZ,
    withdrawn_at TIMESTAMPTZ,
    ip_address INET,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- Table for active/completed sessions
CREATE TABLE IF NOT EXISTS sessions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    appointment_id UUID NOT NULL,
    therapist_id UUID NOT NULL,
    client_id UUID NOT NULL,
    status VARCHAR(20) DEFAULT 'active', -- active, completed, cancelled
    started_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    ended_at TIMESTAMPTZ
);

-- Table for storing real-time transcript chunks
CREATE TABLE IF NOT EXISTS transcript_chunks (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    session_id UUID NOT NULL, -- Links to appointment_id
    chunk_text TEXT NOT NULL,
    chunk_index INTEGER NOT NULL,
    speaker_role VARCHAR(20), -- therapist or client
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- Table for SOAP notes
CREATE TABLE IF NOT EXISTS soap_notes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    appointment_id UUID NOT NULL,
    session_id UUID,
    therapist_id UUID NOT NULL,
    subjective TEXT,
    objective TEXT,
    assessment TEXT,
    plan TEXT,
    raw_transcript TEXT,
    ai_generated BOOLEAN DEFAULT TRUE,
    status VARCHAR(20) DEFAULT 'pending',
    visible_to_client BOOLEAN DEFAULT FALSE,
    reviewed_at TIMESTAMPTZ,
    approved_at TIMESTAMPTZ,
    updated_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- Index for performance
CREATE INDEX IF NOT EXISTS idx_transcript_session ON transcript_chunks(session_id);
CREATE INDEX IF NOT EXISTS idx_soap_appointment ON soap_notes(appointment_id);
CREATE INDEX IF NOT EXISTS idx_consent_appointment ON consent_log(appointment_id);

-- Migration: Add note_type to soap_notes if it doesn't exist
ALTER TABLE soap_notes ADD COLUMN IF NOT EXISTS note_type VARCHAR(20) DEFAULT 'soap';

