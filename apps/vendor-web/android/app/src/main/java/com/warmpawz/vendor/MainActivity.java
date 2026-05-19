package com.warmpawz.vendor;

import android.os.Bundle;
import android.webkit.WebView;

import com.getcapacitor.BridgeActivity;

/**
 * Vendor Capacitor shell (loads https://vendor.warmpawz.com). After changing this file or
 * AndroidManifest.xml you must rebuild the APK — web deploy alone does not update the app.
 * See apps/vendor-web/ANDROID_BUILD.md and the keystore repo build docs.
 */
public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        if (BuildConfig.DEBUG) {
            WebView.setWebContentsDebuggingEnabled(true);
        }
    }
}
