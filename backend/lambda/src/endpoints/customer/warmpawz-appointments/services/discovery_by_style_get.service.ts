import type { Context } from 'hono';
import { executeservicesByStyle } from '../../discovery/services/services-by-style/run';
import { WAPPT_BY_STYLE_DISCOVERY_OPTIONS } from '../constants';

export async function executeDiscoveryByStyleGet(c: Context) {
  return executeservicesByStyle(c, WAPPT_BY_STYLE_DISCOVERY_OPTIONS);
}
