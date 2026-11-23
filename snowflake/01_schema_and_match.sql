-- SharkWatch: Snowflake setup and verification queries
-- Run in a Snowsight worksheet after starting the trial.

CREATE WAREHOUSE IF NOT EXISTS SHARKWATCH_WH
  WAREHOUSE_SIZE = XSMALL AUTO_SUSPEND = 60 AUTO_RESUME = TRUE INITIALLY_SUSPENDED = TRUE;
CREATE DATABASE IF NOT EXISTS SHARKWATCH;
CREATE SCHEMA IF NOT EXISTS SHARKWATCH.ROSTER;
USE SCHEMA SHARKWATCH.ROSTER;

CREATE OR REPLACE TABLE ATTORNEYS     (last_name STRING, first_name STRING, date_accredited STRING, registration_num STRING, poa_code STRING, city STRING, state STRING, zip STRING, phone STRING, snapshot_date DATE);
CREATE OR REPLACE TABLE CLAIMS_AGENTS LIKE ATTORNEYS;
CREATE OR REPLACE TABLE VSO_REPS      (last_name STRING, first_name STRING, registration_num STRING, city STRING, state STRING, zip STRING, phone STRING, snapshot_date DATE);
CREATE OR REPLACE TABLE VSO_ORG_REPS  (organization_name STRING, poa STRING, org_phone STRING, org_city STRING, org_state STRING, representative STRING, rep_city STRING, rep_state STRING, rep_zip STRING, registration_num STRING, snapshot_date DATE);
-- Load the four CSVs with:  cd web && npx tsx scripts/load-snowflake.ts ../data_snapshot_2026-11-23
-- (or Snowsight "Load data", header row: skip 1).

-- One view of every accredited person, with normalised names
CREATE OR REPLACE VIEW PEOPLE AS
SELECT 'attorney' AS kind, registration_num, first_name, last_name, city, state, zip, phone, snapshot_date,
       TRIM(REGEXP_REPLACE(REGEXP_REPLACE(LOWER(TRANSLATE(first_name || ' ' || last_name, 'áàâäãéèêëíìîïóòôöõúùûüñçÁÀÂÄÃÉÈÊËÍÌÎÏÓÒÔÖÕÚÙÛÜÑÇ', 'aaaaaeeeeiiiiooooouuuuncAAAAAEEEEIIIIOOOOOUUUUNC')), '[^a-z ]', ''), ' +', ' ')) AS full_norm FROM ATTORNEYS
UNION ALL
SELECT 'claims_agent', registration_num, first_name, last_name, city, state, zip, phone, snapshot_date,
       TRIM(REGEXP_REPLACE(REGEXP_REPLACE(LOWER(TRANSLATE(first_name || ' ' || last_name, 'áàâäãéèêëíìîïóòôöõúùûüñçÁÀÂÄÃÉÈÊËÍÌÎÏÓÒÔÖÕÚÙÛÜÑÇ', 'aaaaaeeeeiiiiooooouuuuncAAAAAEEEEIIIIOOOOOUUUUNC')), '[^a-z ]', ''), ' +', ' ')) FROM CLAIMS_AGENTS
UNION ALL
SELECT 'vso_rep', registration_num, first_name, last_name, city, state, zip, phone, snapshot_date,
       TRIM(REGEXP_REPLACE(REGEXP_REPLACE(LOWER(TRANSLATE(first_name || ' ' || last_name, 'áàâäãéèêëíìîïóòôöõúùûüñçÁÀÂÄÃÉÈÊËÍÌÎÏÓÒÔÖÕÚÙÛÜÑÇ', 'aaaaaeeeeiiiiooooouuuuncAAAAAEEEEIIIIOOOOOUUUUNC')), '[^a-z ]', ''), ' +', ' ')) FROM VSO_REPS;

-- Tier 1: verified by registration number (unique across all 14,654 people in the 2026-11-23 snapshot)
-- :reg bound by the app
SELECT kind, first_name, last_name, city, state, snapshot_date FROM PEOPLE WHERE registration_num = :reg;

-- Tier 2: exact normalised name (+ state if known). Returns candidates; app shows count.
SELECT kind, registration_num, first_name, last_name, city, state FROM PEOPLE
WHERE full_norm = :full_norm AND (:state IS NULL OR state = :state);

-- Tier 3: suggestions only, never "verified" (Day-1 test: fuzzy >= 94 matched 12% of made-up names)
SELECT kind, registration_num, first_name, last_name, city, state,
       JAROWINKLER_SIMILARITY(full_norm, :full_norm) AS score
FROM PEOPLE
WHERE JAROWINKLER_SIMILARITY(full_norm, :full_norm) >= 90
ORDER BY score DESC LIMIT 5;

-- Free help nearby: accredited VSO reps by state, grouped by organisation
SELECT organization_name, COUNT(*) AS reps, ANY_VALUE(org_phone) AS phone
FROM VSO_ORG_REPS WHERE COALESCE(rep_state, org_state) = :state
GROUP BY organization_name ORDER BY reps DESC LIMIT 10;
