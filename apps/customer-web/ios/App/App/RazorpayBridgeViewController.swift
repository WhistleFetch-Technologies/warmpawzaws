import UIKit
import Capacitor
import WebKit

/// Opens non-http(s) URLs (UPI intents) in the native UPI app instead of loading them in WKWebView.
/// Also keeps Razorpay Net Banking HTTPS (`window.open` / bank redirect) inside WKWebView so
/// `callback_url` can return to `/warmpawz-pay/success` instead of Safari.
final class RazorpayBridgeViewController: CAPBridgeViewController, WKNavigationDelegate, WKUIDelegate {

  private static let brandOrange = UIColor(red: 1, green: 0.549, blue: 0.26, alpha: 1)

  private static let externalSchemes: Set<String> = [
    "upi", "tez", "gpay", "phonepe", "paytmmp", "bhim",
    "credpay", "amazonpay", "whatsapp", "mailto", "tel", "sms"
  ]

  private weak var capacitorUIDelegate: WKUIDelegate?
  private var paymentPopupWebView: WKWebView?
  private var paymentPopupCloseButton: UIButton?

  override func viewDidLoad() {
    super.viewDidLoad()
    view.backgroundColor = Self.brandOrange
  }

  override var preferredStatusBarStyle: UIStatusBarStyle {
    .lightContent
  }

  override func capacitorDidLoad() {
    super.capacitorDidLoad()
    if let webView = bridge?.webView {
      capacitorUIDelegate = webView.uiDelegate
      webView.navigationDelegate = self
      webView.uiDelegate = self
    }
    configureEdgeToEdgeWebView()
  }

  private func configureEdgeToEdgeWebView() {
    guard let webView = bridge?.webView else { return }
    webView.backgroundColor = Self.brandOrange
    webView.isOpaque = true
    webView.scrollView.backgroundColor = Self.brandOrange
    webView.scrollView.contentInsetAdjustmentBehavior = .never
  }

  func webView(
    _ webView: WKWebView,
    decidePolicyFor navigationAction: WKNavigationAction,
    decisionHandler: @escaping (WKNavigationActionPolicy) -> Void
  ) {
    guard let url = navigationAction.request.url,
          let scheme = url.scheme?.lowercased() else {
      decisionHandler(.allow)
      return
    }

    if webView === paymentPopupWebView, isWpaySuccessURL(url) {
      NSLog("[Razorpay] Returning callback to main WKWebView")
      bridge?.webView?.load(URLRequest(url: url))
      dismissPaymentPopup()
      decisionHandler(.cancel)
      return
    }

    if scheme == "http" || scheme == "https" || scheme == "about" || scheme == "file" {
      decisionHandler(.allow)
      return
    }

    if Self.externalSchemes.contains(scheme) {
      UIApplication.shared.open(url, options: [:]) { opened in
        if !opened {
          NSLog("[Razorpay] Could not open external URL: \(url.absoluteString)")
        }
      }
      decisionHandler(.cancel)
      return
    }

    if UIApplication.shared.canOpenURL(url) {
      UIApplication.shared.open(url, options: [:], completionHandler: nil)
      decisionHandler(.cancel)
      return
    }

    decisionHandler(.allow)
  }

  func webView(
    _ webView: WKWebView,
    createWebViewWith configuration: WKWebViewConfiguration,
    for navigationAction: WKNavigationAction,
    windowFeatures: WKWindowFeatures
  ) -> WKWebView? {
    if shouldCapturePaymentPopup(from: webView, navigationAction: navigationAction) {
      return presentPaymentPopup(from: webView, configuration: configuration)
    }
    return capacitorUIDelegate?.webView?(
      webView,
      createWebViewWith: configuration,
      for: navigationAction,
      windowFeatures: windowFeatures
    )
  }

  func webViewDidClose(_ webView: WKWebView) {
    if webView === paymentPopupWebView {
      dismissPaymentPopup()
      return
    }
    capacitorUIDelegate?.webViewDidClose?(webView)
  }

  func webView(
    _ webView: WKWebView,
    runJavaScriptAlertPanelWithMessage message: String,
    initiatedByFrame frame: WKFrameInfo,
    completionHandler: @escaping () -> Void
  ) {
    if capacitorUIDelegate?.responds(
      to: #selector(WKUIDelegate.webView(_:runJavaScriptAlertPanelWithMessage:initiatedByFrame:completionHandler:))
    ) == true {
      capacitorUIDelegate?.webView?(
        webView,
        runJavaScriptAlertPanelWithMessage: message,
        initiatedByFrame: frame,
        completionHandler: completionHandler
      )
      return
    }
    completionHandler()
  }

  func webView(
    _ webView: WKWebView,
    runJavaScriptConfirmPanelWithMessage message: String,
    initiatedByFrame frame: WKFrameInfo,
    completionHandler: @escaping (Bool) -> Void
  ) {
    if capacitorUIDelegate?.responds(
      to: #selector(WKUIDelegate.webView(_:runJavaScriptConfirmPanelWithMessage:initiatedByFrame:completionHandler:))
    ) == true {
      capacitorUIDelegate?.webView?(
        webView,
        runJavaScriptConfirmPanelWithMessage: message,
        initiatedByFrame: frame,
        completionHandler: completionHandler
      )
      return
    }
    completionHandler(false)
  }

  func webView(
    _ webView: WKWebView,
    runJavaScriptTextInputPanelWithPrompt prompt: String,
    defaultText: String?,
    initiatedByFrame frame: WKFrameInfo,
    completionHandler: @escaping (String?) -> Void
  ) {
    if capacitorUIDelegate?.responds(
      to: #selector(WKUIDelegate.webView(_:runJavaScriptTextInputPanelWithPrompt:defaultText:initiatedByFrame:completionHandler:))
    ) == true {
      capacitorUIDelegate?.webView?(
        webView,
        runJavaScriptTextInputPanelWithPrompt: prompt,
        defaultText: defaultText,
        initiatedByFrame: frame,
        completionHandler: completionHandler
      )
      return
    }
    completionHandler(defaultText)
  }

  @available(iOS 15.0, *)
  func webView(
    _ webView: WKWebView,
    requestMediaCapturePermissionFor origin: WKSecurityOrigin,
    initiatedByFrame frame: WKFrameInfo,
    type: WKMediaCaptureType,
    decisionHandler: @escaping (WKPermissionDecision) -> Void
  ) {
    decisionHandler(.grant)
  }

  @available(iOS 15.0, *)
  func webView(
    _ webView: WKWebView,
    requestDeviceOrientationAndMotionPermissionFor origin: WKSecurityOrigin,
    initiatedByFrame frame: WKFrameInfo,
    decisionHandler: @escaping (WKPermissionDecision) -> Void
  ) {
    decisionHandler(.grant)
  }

  private func shouldCapturePaymentPopup(from webView: WKWebView, navigationAction: WKNavigationAction) -> Bool {
    let sourceHost = navigationAction.sourceFrame.request.url?.host?.lowercased() ?? ""
    if sourceHost.contains("razorpay") {
      return true
    }
    if let url = navigationAction.request.url, isRazorpayHost(url) {
      return true
    }
    let main = webView.url?.absoluteString.lowercased() ?? ""
    guard main.contains("/warmpawz-pay"), let url = navigationAction.request.url else {
      return false
    }
    let scheme = url.scheme?.lowercased() ?? ""
    if scheme == "about" {
      return true
    }
    if scheme == "http" || scheme == "https" {
      return !isWarmpawzAppHost(url)
    }
    return false
  }

  private func presentPaymentPopup(from parent: WKWebView, configuration: WKWebViewConfiguration) -> WKWebView {
    dismissPaymentPopup()

    let popup = WKWebView(frame: parent.bounds, configuration: configuration)
    popup.autoresizingMask = [.flexibleWidth, .flexibleHeight]
    popup.navigationDelegate = self
    popup.uiDelegate = self
    popup.customUserAgent = parent.customUserAgent
    popup.backgroundColor = .white
    popup.isOpaque = true

    let host = parent.superview ?? view
    popup.frame = host.bounds
    host.addSubview(popup)

    let close = UIButton(type: .system)
    close.setTitle("Close", for: .normal)
    close.setTitleColor(.white, for: .normal)
    close.backgroundColor = Self.brandOrange
    close.titleLabel?.font = .systemFont(ofSize: 16, weight: .semibold)
    close.addTarget(self, action: #selector(closePaymentPopupTapped), for: .touchUpInside)
    let top = host.safeAreaInsets.top
    close.frame = CGRect(x: host.bounds.width - 88, y: top + 8, width: 80, height: 36)
    close.autoresizingMask = [.flexibleLeftMargin]
    close.layer.cornerRadius = 8
    host.addSubview(close)

    paymentPopupWebView = popup
    paymentPopupCloseButton = close
    NSLog("[Razorpay] Opened Net Banking popup WKWebView")
    return popup
  }

  @objc private func closePaymentPopupTapped() {
    dismissPaymentPopup()
  }

  private func dismissPaymentPopup() {
    paymentPopupCloseButton?.removeFromSuperview()
    paymentPopupCloseButton = nil
    paymentPopupWebView?.navigationDelegate = nil
    paymentPopupWebView?.uiDelegate = nil
    paymentPopupWebView?.removeFromSuperview()
    paymentPopupWebView = nil
  }

  private func isWpaySuccessURL(_ url: URL) -> Bool {
    guard isWarmpawzAppHost(url) else { return false }
    return url.path.contains("/warmpawz-pay/success")
  }

  private func isRazorpayHost(_ url: URL) -> Bool {
    guard let host = url.host?.lowercased() else { return false }
    return host == "razorpay.com"
      || host.hasSuffix(".razorpay.com")
      || host == "razorpay.in"
      || host.hasSuffix(".razorpay.in")
  }

  private func isWarmpawzAppHost(_ url: URL) -> Bool {
    guard let host = url.host?.lowercased() else { return false }
    if host == "customer.warmpawz.com" {
      return true
    }
    if let currentHost = bridge?.webView?.url?.host?.lowercased() {
      return currentHost == host
    }
    return false
  }
}
