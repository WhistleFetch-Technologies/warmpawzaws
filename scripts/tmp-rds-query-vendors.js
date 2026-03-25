// Temporary script to query vendors table schema via RDS Data API
const { query } = require('./rds-data-api-utils-dev');

(async () => {
	try {
		const sql =
			"select column_name, data_type, is_nullable from information_schema.columns where table_schema='public' and table_name='vendors' order by ordinal_position;";
		const rows = await query(sql);
		console.log(JSON.stringify(rows, null, 2));
	} catch (e) {
		console.error(e);
		process.exit(1);
	}
})();

