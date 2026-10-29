import type { Hono } from 'hono';
import {
  registerConvenienceSettingsRoutes,
  type ConvenienceSettingsRouteDeps,
} from './routes/convenience-settings.routes';
import {
  registerVendorExportSettingsRoutes,
  type VendorExportSettingsRouteDeps,
} from './routes/vendor-export-settings.routes';
import { WpayConvenienceSettingsService } from './services/wpay-convenience-settings.service';
import { WpayVendorExportSettingsService } from './services/wpay-vendor-export-settings.service';

export type { ConvenienceSettingsRouteDeps, VendorExportSettingsRouteDeps };

export interface RegisterWarmpawzPayConvenienceSettingsRoutesOptions {
  readonly deps?: ConvenienceSettingsRouteDeps;
  readonly vendorExportDeps?: VendorExportSettingsRouteDeps;
}

function createDefaultConvenienceSettingsDeps(): ConvenienceSettingsRouteDeps {
  return {
    convenienceSettingsService: new WpayConvenienceSettingsService(),
  };
}

function createDefaultVendorExportSettingsDeps(): VendorExportSettingsRouteDeps {
  return {
    vendorExportSettingsService: new WpayVendorExportSettingsService(),
  };
}

export function registerWarmpawzPayConvenienceSettingsRoutes(
  app: Hono,
  options: RegisterWarmpawzPayConvenienceSettingsRoutesOptions = {},
): void {
  registerConvenienceSettingsRoutes(app, options.deps ?? createDefaultConvenienceSettingsDeps());
  registerVendorExportSettingsRoutes(
    app,
    options.vendorExportDeps ?? createDefaultVendorExportSettingsDeps(),
  );
}
