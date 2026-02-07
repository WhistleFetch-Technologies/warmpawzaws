#!/usr/bin/env python3
"""
Fix JSONB quotes in migration 140
"""

import re

with open('db/migrations/140_role_consolidation_20_to_21.sql', 'r') as f:
    content = f.read()

# Fix: '{customer_service}', 'value'::jsonb -> '{customer_service}', '"value"'::jsonb
content = re.sub(
    r"('\{customer_service\}',\s*)'([a-z_]+)'::jsonb",
    r"\1'\2'::jsonb",
    content
)
# Actually need to add quotes around the value
content = re.sub(
    r"('\{customer_service\}',\s*)'([a-z_]+)'::jsonb",
    r"\1'\"\2\"'::jsonb",
    content
)

# Fix: '{vendorConfiguration}', 'value'::jsonb -> '{vendorConfiguration}', '"value"'::jsonb
content = re.sub(
    r"('\{vendorConfiguration\}',\s*)'([a-z_]+)'::jsonb",
    r"\1'\"\2\"'::jsonb",
    content
)

# Fix broken double quotes: ""value""'::jsonb -> '"value"'::jsonb
content = re.sub(r'""([^"]+)""\'::jsonb', r"'\1'::jsonb", content)
# Then fix back to proper JSON strings
content = re.sub(
    r"('\{customer_service\}',\s*)'([a-z_]+)'::jsonb",
    r"\1'\"\2\"'::jsonb",
    content
)
content = re.sub(
    r"('\{vendorConfiguration\}',\s*)'([a-z_]+)'::jsonb",
    r"\1'\"\2\"'::jsonb",
    content
)

# Fix: ''value'::jsonb -> '"value"'::jsonb (double single quotes)
content = re.sub(r"''([a-z_]+)'::jsonb", r"'\1'::jsonb", content)
# Then add JSON quotes
content = re.sub(
    r"('\{customer_service\}',\s*)'([a-z_]+)'::jsonb",
    r"\1'\"\2\"'::jsonb",
    content
)
content = re.sub(
    r"('\{vendorConfiguration\}',\s*)'([a-z_]+)'::jsonb",
    r"\1'\"\2\"'::jsonb",
    content
)

with open('db/migrations/140_role_consolidation_20_to_21.sql', 'w') as f:
    f.write(content)

print('Fixed all JSONB quotes in migration 140')
