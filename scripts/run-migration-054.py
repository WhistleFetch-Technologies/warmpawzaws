#!/usr/bin/env python3
"""
Run Migration 054: Add last_login_at columns to vendors and admins tables
Uses AWS RDS Data API or direct PostgreSQL connection
"""

import boto3
import json
import sys
import os

# Get credentials from AWS Secrets Manager
def get_db_credentials():
    secret_arn = "arn:aws:secretsmanager:ap-south-1:057442119249:secret:warmpawz-dev-rds-master-20260106164510791100000002-WqZcjI"
    
    secrets_client = boto3.client('secretsmanager', region_name='ap-south-1')
    response = secrets_client.get_secret_value(SecretId=secret_arn)
    secret = json.loads(response['SecretString'])
    
    return {
        'host': secret['host'],
        'port': secret['port'],
        'database': secret['dbname'],
        'user': secret['username'],
        'password': secret['password']
    }

# Try using RDS Data API first (no VPC/network access needed)
def run_migration_with_data_api(creds):
    try:
        rds_data = boto3.client('rds-data', region_name='ap-south-1')
        cluster_arn = "arn:aws:rds:ap-south-1:057442119249:cluster:warmpawz-dev-cluster"
        secret_arn = "arn:aws:secretsmanager:ap-south-1:057442119249:secret:warmpawz-dev-rds-master-20260106164510791100000002-WqZcjI"
        
        # Read migration SQL
        migration_file = os.path.join(os.path.dirname(__file__), '..', 'db', 'migrations', '054_add_last_login_at_columns.sql')
        with open(migration_file, 'r') as f:
            sql = f.read()
        
        # Execute migration
        print("🔄 Running migration using RDS Data API...")
        response = rds_data.execute_statement(
            resourceArn=cluster_arn,
            secretArn=secret_arn,
            database=creds['database'],
            sql=sql
        )
        
        print("✅ Migration completed successfully!")
        return True
    except Exception as e:
        print(f"❌ RDS Data API failed: {e}")
        return False

# Fallback: Use psycopg2 for direct connection
def run_migration_with_psycopg2(creds):
    try:
        import psycopg2
        from psycopg2.extensions import ISOLATION_LEVEL_AUTOCOMMIT
        
        print("🔄 Connecting to database...")
        conn = psycopg2.connect(
            host=creds['host'],
            port=creds['port'],
            database=creds['database'],
            user=creds['user'],
            password=creds['password'],
            sslmode='require'
        )
        conn.set_isolation_level(ISOLATION_LEVEL_AUTOCOMMIT)
        
        cursor = conn.cursor()
        
        # Read migration SQL
        migration_file = os.path.join(os.path.dirname(__file__), '..', 'db', 'migrations', '054_add_last_login_at_columns.sql')
        with open(migration_file, 'r') as f:
            sql = f.read()
        
        print("🔄 Executing migration SQL...")
        cursor.execute(sql)
        
        cursor.close()
        conn.close()
        
        print("✅ Migration completed successfully!")
        return True
    except ImportError:
        print("❌ psycopg2 not installed. Install with: pip install psycopg2-binary")
        return False
    except Exception as e:
        print(f"❌ psycopg2 connection failed: {e}")
        return False

if __name__ == '__main__':
    print("=" * 60)
    print("Migration 054: Add last_login_at columns")
    print("=" * 60)
    
    creds = get_db_credentials()
    print(f"📊 Database: {creds['database']} @ {creds['host']}")
    
    # Try RDS Data API first
    if not run_migration_with_data_api(creds):
        # Fallback to psycopg2
        print("\n🔄 Trying direct PostgreSQL connection...")
        if not run_migration_with_psycopg2(creds):
            print("\n❌ All connection methods failed!")
            sys.exit(1)
    
    print("\n✅ Migration 054 completed successfully!")
