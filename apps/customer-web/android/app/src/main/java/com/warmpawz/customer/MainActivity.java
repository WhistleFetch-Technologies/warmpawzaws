package com.warmpawz.customer;

import android.content.ActivityNotFoundException;
import android.content.Intent;
import android.graphics.Color;
import android.net.Uri;
import android.os.Bundle;
import android.webkit.WebView;
import android.webkit.WebViewClient;

import androidx.core.view.WindowCompat;
import androidx.core.view.WindowInsetsControllerCompat;

import com.getcapacitor.BridgeActivity;

/**
 * Two responsibilities:
 *
 * 1. **Status-bar layout (header fix).** Capacitor Android by default sets
 *    `WindowCompat.setDecorFitsSystemWindows(window, false)` — the WebView
 *    extends under the status bar / camera punch-hole. Unlike iOS, Android
 *    does NOT propagate the system bar inset to CSS `env(safe-area-inset-top)`,
 *    so a CSS-only top padding can never clear the status bar. We re-enable
 *    `setDecorFitsSystemWindows(true)` so the system status bar is rendered
 *    as its own opaque strip ABOVE the WebView, matching the BHIVE / "trusted
 *    business" reference look. We tint the status bar to the brand orange
 *    (#FF8C42) and force light status-bar icons so it visually flows into the
 *    Warmpawz header.
 *
 * 2. **External UPI / mailto / tel scheme handoff.** Razorpay Standard
 *    Checkout fires `intent://...#Intent;scheme=upi;...;end` and `upi://`
 *    URLs to launch the user's UPI app (PhonePe / GPay / Paytm / BHIM). The
 *    default Capacitor WebViewClient treats those as page navigations and
 *    silently fails. We override `shouldOverrideUrlLoading` to hand any
 *    non-http scheme to the OS via `Intent.parseUri` + `startActivity`.
 *    Pairs with the {@code <queries>} block in AndroidManifest (Android 11+
 *    package visibility) and the {@code overrideUserAgent} in
 *    capacitor.config.json (Razorpay's UA sniffer drops UPI on
 *    `Android …; wv)` UAs).
 */
public class MainActivity extends BridgeActivity {

  private static final int STATUS_BAR_COLOR = 0xFFFF8C42; // brand orange
  private static final boolean LIGHT_STATUS_BAR_ICONS = true; // dark icons over orange

  @Override
  public void onCreate(Bundle savedInstanceState) {
    super.onCreate(savedInstanceState);
    applyStatusBarLayout();
  }

  @Override
  public void onStart() {
    super.onStart();
    applyStatusBarLayout();
    installRazorpayWebViewClient();
  }

  /**
   * Make the system status bar its own strip above the WebView (no overlay) and
   * paint it with the brand orange so the in-page header continues seamlessly
   * into the system area.
   */
  private void applyStatusBarLayout() {
    if (getWindow() == null) return;
    // false = WebView does NOT extend under the system bars; status bar is a
    // separate strip. This is the inverse of Capacitor's default and is what
    // we want here because Android does not propagate inset to CSS env().
    WindowCompat.setDecorFitsSystemWindows(getWindow(), false);
    getWindow().setStatusBarColor(STATUS_BAR_COLOR);
    if (getWindow().getDecorView() != null) {
      WindowInsetsControllerCompat controller =
          new WindowInsetsControllerCompat(getWindow(), getWindow().getDecorView());
      // setAppearanceLightStatusBars(true)  -> dark icons (for light status bar bg)
      // setAppearanceLightStatusBars(false) -> light icons (for dark status bar bg)
      controller.setAppearanceLightStatusBars(LIGHT_STATUS_BAR_ICONS);
    }
    // Apply a top inset listener on the WebView container so the WebView
    // starts BELOW the status bar even though the window itself is still
    // edge-to-edge (cleaner than `setDecorFitsSystemWindows(true)`, which
    // breaks Razorpay CheckoutActivity on some OEMs).
    if (getBridge() != null && getBridge().getWebView() != null) {
      WebView webView = getBridge().getWebView();
      androidx.core.view.ViewCompat.setOnApplyWindowInsetsListener(webView, (v, insets) -> {
        int topInset = insets.getInsets(
            androidx.core.view.WindowInsetsCompat.Type.systemBars()
                | androidx.core.view.WindowInsetsCompat.Type.displayCutout()
        ).top;
        v.setPadding(v.getPaddingLeft(), topInset, v.getPaddingRight(), v.getPaddingBottom());
        return insets;
      });
      androidx.core.view.ViewCompat.requestApplyInsets(webView);
    }
  }

  private void installRazorpayWebViewClient() {
    if (getBridge() == null || getBridge().getWebView() == null) return;
    WebView webView = getBridge().getWebView();
    final WebViewClient existing = webView.getWebViewClient();
    webView.setWebViewClient(new WebViewClient() {
      @Override
      public boolean shouldOverrideUrlLoading(WebView view, String url) {
        if (handleExternalScheme(url)) {
          return true;
        }
        return existing != null && existing.shouldOverrideUrlLoading(view, url);
      }
    });
  }

  /**
   * Launch UPI / mailto / tel / custom-scheme URLs through the OS. Returns true
   * if the URL was consumed (and the WebView should NOT load it as a page).
   */
  private boolean handleExternalScheme(String url) {
    if (url == null) return false;
    String lower = url.toLowerCase();
    boolean isIntent = lower.startsWith("intent:");
    boolean isUpi = lower.startsWith("upi:")
        || lower.startsWith("phonepe:") || lower.startsWith("gpay:")
        || lower.startsWith("tez:") || lower.startsWith("paytmmp:")
        || lower.startsWith("bhim:") || lower.startsWith("credpay:")
        || lower.startsWith("amazonpay:");
    boolean isMailtoOrTel = lower.startsWith("mailto:") || lower.startsWith("tel:")
        || lower.startsWith("sms:");

    if (!(isIntent || isUpi || isMailtoOrTel)) {
      return false;
    }

    try {
      Intent intent;
      if (isIntent) {
        intent = Intent.parseUri(url, Intent.URI_INTENT_SCHEME);
      } else {
        intent = new Intent(Intent.ACTION_VIEW, Uri.parse(url));
      }
      intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
      startActivity(intent);
      return true;
    } catch (ActivityNotFoundException notFound) {
      if (isIntent) {
        try {
          Intent fallback = Intent.parseUri(url, Intent.URI_INTENT_SCHEME);
          String pkg = fallback.getPackage();
          if (pkg != null) {
            Intent market = new Intent(Intent.ACTION_VIEW,
                Uri.parse("https://play.google.com/store/apps/details?id=" + pkg));
            market.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            startActivity(market);
            return true;
          }
        } catch (Exception ignored) {
          // best-effort fallback
        }
      }
      return true;
    } catch (Exception other) {
      return false;
    }
  }
}
