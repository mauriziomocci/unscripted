-- Runs once, when the db volume is first created. The main database
-- `unscripted` is made by POSTGRES_DB; this file adds the one the integration
-- tests use (research R-19). A session that runs tests in parallel points
-- DATABASE_URL_TEST at a database of its own instead.
CREATE DATABASE unscripted_test;
