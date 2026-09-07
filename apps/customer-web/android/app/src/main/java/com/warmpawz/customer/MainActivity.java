package com.warmpawz.customer;

import android.content.ActivityNotFoundException;
import android.content.Intent;
import android.net.Uri;
import android.os.Bundle;
import android.os.Message;
import android.util.Log;
import android.view.View;
import android.view.ViewGroup;
import android.webkit.PermissionRequest;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceRequest;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;

import androidx.core.view.WindowCompat;
import com.getcapacitor.BridgeWebChromeClient;
import com.getcapacitor.BridgeWebViewClient;
import androidx.core.view.WindowInsetsCompat;
import androidx.core.view.WindowInsetsControllerCompat;

import com.getcapacitor.BridgeActivity;

/**
 * Three responsibilities:
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
 *
 * 3. **Razorpay Net Banking HTTPS.** checkout.js opens the bank page with
 *    `window.open` / `target=_blank`, or a top-level redirect when Pay Bill
 *    uses `redirect:true`. Capacitor's default `launchIntent` sends any
 *    off-host https URL to Chrome, and `BridgeWebChromeClient` does not
 *    implement `onCreateWindow`, so the bank flow never returns to
 *    `/warmpawz-pay/success` inside the APK. We keep Razorpay / bank
 *    handoff in the WebView (or a Pay Bill popup WebView) and load the
 *    Warmpawz success URL back in the main WebView. Other https (maps)
 *    still uses Capacitor's external-browser handoff.
 */
public class MainActivity extends BridgeActivity {

  private static final String TAG = "WarmpawzRazorpay";
  private static final int STATUS_BAR_COLOR = 0xFFFF8C42; // brand orange
  private boolean webViewInsetsInstalled;
  private boolean paymentHandoffActive;
  private WebView paymentPopupWebView;

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
    // Bridge may not be ready in onStart — retry so WebView geolocation can prompt.
    installBridgeWebChromeClient();
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
      int imeBottom = insets.getInsets(WindowInsetsCompat.Type.ime()).bottom;
      int navBottom = insets.getInsets(WindowInsetsCompat.Type.systemBars()).bottom;
      int bottomInset = Math.max(imeBottom, navBottom);
      if (v instanceof ViewGroup) {
        ViewGroup vg = (ViewGroup) v;
        for (int i = 0; i < vg.getChildCount(); i++) {
          View child = vg.getChildAt(i);
          child.setPadding(
              child.getPaddingLeft(), topInset,
              child.getPaddingRight(), bottomInset
          );
        }
      } else {
        v.setPadding(v.getPaddingLeft(), topInset, v.getPaddingRight(), bottomInset);
      }
      return WindowInsetsCompat.CONSUMED;
    });
    androidx.core.view.ViewCompat.requestApplyInsets(content);
  }

  @Override
  public void onStart() {
    super.onStart();
    installBridgeWebChromeClient();
    installRazorpayWebViewClient();
  }

  @Override
  public void onDestroy() {
    closePaymentPopup();
    super.onDestroy();
  }

  @Override
  public void onBackPressed() {
    if (handlePaymentPopupBack()) {
      return;
    }
    super.onBackPressed();
  }

  /**
   * Capacitor's BridgeWebChromeClient handles WebView geolocation (runtime permission +
   * onGeolocationPermissionsShowPrompt). Without this, navigator.geolocation often returns
   * PERMISSION_DENIED on Android even when manifest declares location.
   *
   * Razorpay Net Banking also needs `onCreateWindow` — checkout.js opens the bank
   * page in a new window, which Capacitor otherwise drops.
   */
  private void installBridgeWebChromeClient() {
    if (getBridge() == null || getBridge().getWebView() == null) {
      return;
    }
    WebView webView = getBridge().getWebView();
    WebSettings settings = webView.getSettings();
    settings.setSupportMultipleWindows(true);
    settings.setJavaScriptCanOpenWindowsAutomatically(true);
    webView.setWebChromeClient(new BridgeWebChromeClient(getBridge()) {
      @Override
      public void onPermissionRequest(final PermissionRequest request) {
        runOnUiThread(() -> request.grant(request.getResources()));
      }

      @Override
      public boolean onCreateWindow(WebView view, boolean isDialog, boolean isUserGesture, Message resultMsg) {
        if (shouldCaptureRazorpayPaymentWindow(view)) {
          return openPaymentPopup(view, resultMsg);
        }
        return false;
      }

      @Override
      public void onCloseWindow(WebView window) {
        if (paymentPopupWebView == window) {
          closePaymentPopup();
          return;
        }
        super.onCloseWindow(window);
      }
    });
  }

  private void installRazorpayWebViewClient() {
    if (getBridge() == null || getBridge().getWebView() == null) return;
    WebView webView = getBridge().getWebView();
    webView.setWebViewClient(new BridgeWebViewClient(getBridge()) {
      @Override
      public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
        if (request != null && request.getUrl() != null
            && handleMainWebViewUrl(view, request.getUrl().toString())) {
          return true;
        }
        if (shouldKeepPaymentHttpsInWebView(request != null && request.getUrl() != null
            ? request.getUrl().toString() : null)) {
          return false;
        }
        return super.shouldOverrideUrlLoading(view, request);
      }

      @Override
      public boolean shouldOverrideUrlLoading(WebView view, String url) {
        if (handleMainWebViewUrl(view, url)) {
          return true;
        }
        if (shouldKeepPaymentHttpsInWebView(url)) {
          return false;
        }
        return super.shouldOverrideUrlLoading(view, url);
      }
    });
  }

  /**
   * @return true when the URL was consumed and the WebView must not load it.
   */
  private boolean handleMainWebViewUrl(WebView view, String url) {
    return handleExternalScheme(url);
  }

  /**
   * Keep Razorpay / bank HTTPS inside the APK WebView so callback_url can
   * return to /warmpawz-pay/success. Do not intercept unrelated https.
   */
  private boolean shouldKeepPaymentHttpsInWebView(String url) {
    if (url == null) return false;
    Uri uri = Uri.parse(url);
    String scheme = uri.getScheme();
    if (scheme == null) return false;
    scheme = scheme.toLowerCase();
    if (!scheme.equals("http") && !scheme.equals("https")) {
      return false;
    }
    if (isWarmpawzAppHost(uri)) {
      paymentHandoffActive = false;
      return false;
    }
    if (isRazorpayHost(uri) || paymentHandoffActive || isWarmpawzPayBillContext()) {
      paymentHandoffActive = true;
      Log.i(TAG, "Keeping Razorpay/bank HTTPS in WebView: " + uri.getHost());
      return true;
    }
    return false;
  }

  private boolean shouldCaptureRazorpayPaymentWindow(WebView view) {
    if (isWarmpawzPayBillContext()) {
      return true;
    }
    String current = view != null ? view.getUrl() : null;
    if (current == null) return paymentHandoffActive;
    Uri uri = Uri.parse(current);
    return isRazorpayHost(uri) || paymentHandoffActive;
  }

  private boolean openPaymentPopup(WebView parent, Message resultMsg) {
    if (resultMsg == null || !(resultMsg.obj instanceof WebView.WebViewTransport)) {
      return false;
    }
    closePaymentPopup();

    WebView popup = new WebView(this);
    WebSettings settings = popup.getSettings();
    settings.setJavaScriptEnabled(true);
    settings.setDomStorageEnabled(true);
    settings.setJavaScriptCanOpenWindowsAutomatically(true);
    String ua = parent.getSettings().getUserAgentString();
    if (ua != null) {
      settings.setUserAgentString(ua);
    }

    popup.setWebViewClient(new WebViewClient() {
      @Override
      public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
        return handlePaymentPopupUrl(parent, request != null && request.getUrl() != null
            ? request.getUrl().toString() : null);
      }

      @Override
      public boolean shouldOverrideUrlLoading(WebView view, String url) {
        return handlePaymentPopupUrl(parent, url);
      }
    });
    popup.setWebChromeClient(new WebChromeClient() {
      @Override
      public void onCloseWindow(WebView window) {
        closePaymentPopup();
      }
    });

    ViewGroup content = findViewById(android.R.id.content);
    if (content == null) {
      popup.destroy();
      return false;
    }
    content.addView(popup, new ViewGroup.LayoutParams(
        ViewGroup.LayoutParams.MATCH_PARENT,
        ViewGroup.LayoutParams.MATCH_PARENT
    ));
    paymentPopupWebView = popup;
    paymentHandoffActive = true;

    WebView.WebViewTransport transport = (WebView.WebViewTransport) resultMsg.obj;
    transport.setWebView(popup);
    resultMsg.sendToTarget();
    Log.i(TAG, "Opened Razorpay payment popup WebView");
    return true;
  }

  private boolean handlePaymentPopupUrl(WebView main, String url) {
    if (url == null) return false;
    if (handleExternalScheme(url)) {
      return true;
    }
    if (isWpaySuccessUrl(url)) {
      Log.i(TAG, "Returning Razorpay callback to main WebView");
      if (main != null) {
        main.loadUrl(url);
      }
      closePaymentPopup();
      return true;
    }
    Uri uri = Uri.parse(url);
    String scheme = uri.getScheme() != null ? uri.getScheme().toLowerCase() : "";
    if (scheme.equals("http") || scheme.equals("https") || scheme.equals("about")) {
      paymentHandoffActive = !isWarmpawzAppHost(uri);
      return false;
    }
    return handleExternalScheme(url);
  }

  private boolean handlePaymentPopupBack() {
    if (paymentPopupWebView == null) {
      return false;
    }
    if (paymentPopupWebView.canGoBack()) {
      paymentPopupWebView.goBack();
      return true;
    }
    closePaymentPopup();
    return true;
  }

  private void closePaymentPopup() {
    if (paymentPopupWebView == null) {
      return;
    }
    View parent = (View) paymentPopupWebView.getParent();
    if (parent instanceof ViewGroup) {
      ((ViewGroup) parent).removeView(paymentPopupWebView);
    }
    paymentPopupWebView.destroy();
    paymentPopupWebView = null;
  }

  private boolean isWarmpawzPayBillContext() {
    if (paymentHandoffActive) return true;
    WebView wv = getBridge() != null ? getBridge().getWebView() : null;
    String current = wv != null ? wv.getUrl() : null;
    return current != null && current.toLowerCase().contains("/warmpawz-pay");
  }

  private boolean isWpaySuccessUrl(String url) {
    if (url == null) return false;
    Uri uri = Uri.parse(url);
    if (!isWarmpawzAppHost(uri)) return false;
    String path = uri.getPath();
    return path != null && path.contains("/warmpawz-pay/success");
  }

  private boolean isRazorpayHost(Uri uri) {
    if (uri == null) return false;
    String host = uri.getHost();
    if (host == null) return false;
    host = host.toLowerCase();
    return host.equals("razorpay.com")
        || host.endsWith(".razorpay.com")
        || host.equals("razorpay.in")
        || host.endsWith(".razorpay.in");
  }

  private boolean isWarmpawzAppHost(Uri uri) {
    if (uri == null) return false;
    String host = uri.getHost();
    if (host == null) return false;
    host = host.toLowerCase();
    if (host.equals("customer.warmpawz.com")) {
      return true;
    }
    WebView wv = getBridge() != null ? getBridge().getWebView() : null;
    String current = wv != null ? wv.getUrl() : null;
    if (current == null) return false;
    String appHost = Uri.parse(current).getHost();
    return appHost != null && appHost.equalsIgnoreCase(host);
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
