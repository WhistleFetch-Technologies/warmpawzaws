BEGIN
    SELECT account_type INTO v_account_type
    FROM chart_of_accounts
    WHERE id = p_account_id;