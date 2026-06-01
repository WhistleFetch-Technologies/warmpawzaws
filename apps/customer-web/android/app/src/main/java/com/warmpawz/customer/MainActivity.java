package com.warmpawz.customer;

import android.content.ActivityNotFoundException;
import android.content.Intent;
import android.net.Uri;
import android.os.Bundle;
import android.view.View;
import android.view.ViewGroup;
import android.webkit.WebView;
import android.webkit.WebViewClient;

import androidx.core.view.WindowCompat;
import androidx.core.view.WindowInsetsCompat;
import androidx.core.view.WindowInsetsControllerCompat;

import com.getcapacitor.BridgeActivity;

/**
 * Two responsibilities:
 *
 * 1. **Status-bar layout (header fix).** Razorpay Standard Checkout opens its
 *    payment sheet inside a cross-origin iframe at `checkout.razorpay.com`,
 *    which we cannot style from our domain. The orange "Warmpawz" merchant
 *    toolbar at the top of that iframe was overlapping the system status bar
 *    / camera punch-hole because the Capacitor WebView is laid out edge-to-
 *    edge by default and Android does NOT propagate
 *    `safe-area-inset-top` to CSS env() inside the WebView. We push the
 *    WebView container down by the actual measured system-bar + display-
 *    cutout inset using `OnApplyWindowInsetsListener`, then **consume** the
 *    inset so child views (including the iframe) do not double-pad.
 *    Status-bar background is painted brand orange (#FF8C42) so the system
 *    strip flows visually into the page header below it.
 *
 * 2. **External UPI / mailto / tel scheme handoff.** Razorpay fires
 *    `intent://...#Intent;scheme=upi;...;end` and `upi://` URLs to launch
 *    the user's UPI app (PhonePe / GPay / Paytm / BHIM). The default
 *    Capacitor WebViewClient treats those as page navigations and silently
 *    fails. We override `shouldOverrideUrlLoading` to hand any non-http
 *    scheme to the OS via `Intent.parseUri` + `startActivity`.
 */
public class MainActivity extends BridgeActivity {

  private static final int STATUS_BAR_COLOR = 0xFFFF8C42; // brand orange
  private boolean webViewInsetsInstalled;

  @Override
  public void onCreate(Bundle savedInstanceState) {
    super.onCreate(savedInstanceState);
    applyBrandSystemBars();
    installWebViewTopInsets();
  }

  @Override
  public void onResume() {
    super.onResume();
    // Razorpay / payment sheets and some OEM skins reset the status bar after onCreate.
    applyBrandSystemBars();
  }

  @Override
  public void onWindowFocusChanged(boolean hasFocus) {
    super.onWindowFocusChanged(hasFocus);
    if (hasFocus) {
      applyBrandSystemBars();
    }
  }

  /**
   * Brand orange under the clock/battery. Theme styles.xml sets this too; we re-apply at
   * runtime because Capacitor splash → postSplashScreenTheme and payment WebViews can reset it.
   */
  private void applyBrandSystemBars() {
    WindowCompat.setDecorFitsSystemWindows(getWindow(), false);
    getWindow().setStatusBarColor(STATUS_BAR_COLOR);
    getWindow().setNavigationBarColor(STATUS_BAR_COLOR);

    final View decor = getWindow().getDecorView();
    if (decor != null) {
      // Light status-bar icons (dark icons on bright orange).
      new WindowInsetsControllerCompat(getWindow(), decor)
          .setAppearanceLightStatusBars(true);
    }

    // Padding band above the WebView must not show default black window background.
    final View content = findViewById(android.R.id.content);
    if (content != null) {
      content.setBackgroundColor(STATUS_BAR_COLOR);
    }
  }

  /**
   * Push WebView below status bar / punch-hole; consume insets so CSS env(safe-area-inset-top)
   * stays 0 and we do not double-pad with ServiceDashboardHeader.
   */
  private void installWebViewTopInsets() {
    if (webViewInsetsInstalled) {
      return;
    }
    final View content = findViewById(android.R.id.content);
    if (content == null) {
      return;
    }
    webViewInsetsInstalled = true;
    androidx.core.view.ViewCompat.setOnApplyWindowInsetsListener(content, (v, insets) -> {
      int topInset = insets.getInsets(
          WindowInsetsCompat.Type.systemBars()
              | WindowInsetsCompat.Type.displayCutout()
      ).top;
      if (v instanceof ViewGroup) {
        ViewGroup vg = (ViewGroup) v;
        for (int i = 0; i < vg.getChildCount(); i++) {
          View child = vg.getChildAt(i);
          child.setPadding(
              child.getPaddingLeft(), topInset,
              child.getPaddingRight(), child.getPaddingBottom()
          );
        }
      } else {
        v.setPadding(v.getPaddingLeft(), topInset, v.getPaddingRight(), v.getPaddingBottom());
      }
      return WindowInsetsCompat.CONSUMED;
    });
    androidx.core.view.ViewCompat.requestApplyInsets(content);
  }

  @Override
  public void onStart() {
    super.onStart();
    installRazorpayWebViewClient();
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
