import type { Hono } from 'hono';
import { registerCustomerBannersGetRoute } from './routes/customer_banners_get.route';
import { registerMarketingBannersGetRoute } from './routes/marketing_banners_get.route';
import { registerCustomerBannersResolvectaGetRoute } from './routes/customer_banners_resolvecta_get.route';
import { registerCustomerArticlesGetRoute } from './routes/customer_articles_get.route';
import { registerCustomerArticlesSlugGetRoute } from './routes/customer_articles_slug_get.route';
import { registerMarketingArticlesGetRoute } from './routes/marketing_articles_get.route';
import { registerCustomerAnnouncementsGetRoute } from './routes/customer_announcements_get.route';
import { registerMarketingAnnouncementsGetRoute } from './routes/marketing_announcements_get.route';
import { registerCustomerFeaturedvendorsGetRoute } from './routes/customer_featuredvendors_get.route';
import { registerCustomerFeaturedpackagesGetRoute } from './routes/customer_featuredpackages_get.route';
import { registerCustomerAdoptionstatsGetRoute } from './routes/customer_adoptionstats_get.route';
import { registerCustomerContentPagesSlugGetRoute } from './routes/customer_content_pages_slug_get.route';
import { registerCustomerContentPagesGetRoute } from './routes/customer_content_pages_get.route';

export function registerCustomerContentEndpoints(app: Hono) {
  registerCustomerBannersGetRoute(app);
  registerMarketingBannersGetRoute(app);
  registerCustomerBannersResolvectaGetRoute(app);
  registerCustomerArticlesGetRoute(app);
  registerCustomerArticlesSlugGetRoute(app);
  registerMarketingArticlesGetRoute(app);
  registerCustomerAnnouncementsGetRoute(app);
  registerMarketingAnnouncementsGetRoute(app);
  registerCustomerFeaturedvendorsGetRoute(app);
  registerCustomerFeaturedpackagesGetRoute(app);
  registerCustomerAdoptionstatsGetRoute(app);
  registerCustomerContentPagesSlugGetRoute(app);
  registerCustomerContentPagesGetRoute(app);
}
