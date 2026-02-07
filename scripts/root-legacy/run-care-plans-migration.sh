#!/bin/bash
# Quick migration runner - set your RDS details and run

export DATABASE_URL="postgresql://USER:PASSWORD@RDS_ENDPOINT.rds.amazonaws.com:5432/DB_NAME"

node db/run-migration.js db/migrations/059_create_care_plans_tables.sql
