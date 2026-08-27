import type { Hono } from 'hono';
import {
  registerConvenienceSettingsRoutes,
  type ConvenienceSettingsRouteDeps,
} from './routes/convenience-settings.routes';
import { WpayConvenienceSettingsService } from './services/wpay-convenience-settings.service';

export type { ConvenienceSettingsRouteDeps };

export interface RegisterWarmpawzPayConvenienceSettingsRoutesOptions {
  readonly deps?: ConvenienceSettingsRouteDeps;
}

function createDefaultConvenienceSettingsDeps(): ConvenienceSettingsRouteDeps {
  return {
    convenienceSettingsService: new WpayConvenienceSettingsService(),
  };
}

export function registerWarmpawzPayConvenienceSettingsRoutes(
  app: Hono,
  options: RegisterWarmpawzPayConvenienceSettingsRoutesOptions = {},
): void {
  registerConvenienceSettingsRoutes(app, options.deps ?? createDefaultConvenienceSettingsDeps());
}
