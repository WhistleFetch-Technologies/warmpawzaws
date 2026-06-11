/**
 * Shared campaign targeting loader for campaign processor + scheduled drain.
 */

import { query } from '../database/rds-connection';

export async function loadCampaignTargeting(campaignId: string) {
  const [regions, cities, users, segments] = await Promise.all([
    query('SELECT region_id FROM notification_campaign_regions WHERE campaign_id = $1', [campaignId]),
    query('SELECT city_name FROM notification_campaign_cities WHERE campaign_id = $1', [campaignId]),
    query('SELECT user_id FROM notification_campaign_users WHERE campaign_id = $1', [campaignId]),
    query('SELECT segment_id FROM notification_segment_targets WHERE campaign_id = $1', [campaignId]),
  ]);
  return {
    region_ids: (regions.rows || []).map((r: { region_id: string }) => r.region_id),
    city_names: (cities.rows || []).map((r: { city_name: string }) => r.city_name),
    user_ids: (users.rows || []).map((r: { user_id: string }) => r.user_id),
    segment_ids: (segments.rows || []).map((r: { segment_id: string }) => r.segment_id),
  };
}
