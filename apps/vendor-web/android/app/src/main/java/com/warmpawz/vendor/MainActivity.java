package com.warmpawz.vendor;

import android.os.Bundle;
import android.webkit.PermissionRequest;
import android.webkit.WebView;

import com.getcapacitor.BridgeActivity;
import com.getcapacitor.BridgeWebChromeClient;

/**
 * Vendor Capacitor shell (loads https://vendor.warmpawz.com). After changing this file or
 * AndroidManifest.xml you must rebuild the APK — web deploy alone does not update the app.
 * See apps/vendor-web/ANDROID_BUILD.md and the keystore repo build docs.
 */
public class MainActivity extends BridgeActivity {
    private boolean webChromeClientInstalled;

    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        if (BuildConfig.DEBUG) {
            WebView.setWebContentsDebuggingEnabled(true);
        }
    }

    @Override
    public void onStart() {
        super.onStart();
        installBridgeWebChromeClient();
    }

    @Override
    public void onResume() {
        super.onResume();
        installBridgeWebChromeClient();
    }

    /**
     * BridgeWebChromeClient wires WebView geolocation to Android runtime permissions.
     * Without this, navigator.geolocation returns PERMISSION_DENIED in the APK shell.
     */
    private void installBridgeWebChromeClient() {
        if (getBridge() == null || getBridge().getWebView() == null) {
            return;
        }
        if (webChromeClientInstalled) {
            return;
        }
        WebView webView = getBridge().getWebView();
        webView.setWebChromeClient(new BridgeWebChromeClient(getBridge()) {
            @Override
            public void onPermissionRequest(final PermissionRequest request) {
                runOnUiThread(() -> request.grant(request.getResources()));
            }
        });
        webChromeClientInstalled = true;
    }
}
