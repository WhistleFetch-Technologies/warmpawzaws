import UIKit
import Capacitor
import WebKit

/// Opens non-http(s) URLs (UPI intents) in the native UPI app instead of loading them in WKWebView.
final class RazorpayBridgeViewController: CAPBridgeViewController, WKNavigationDelegate {

  private static let brandOrange = UIColor(red: 1, green: 0.549, blue: 0.26, alpha: 1)

  private static let externalSchemes: Set<String> = [
    "upi", "tez", "gpay", "phonepe", "paytmmp", "bhim",
    "credpay", "amazonpay", "whatsapp", "mailto", "tel", "sms"
  ]

  override func viewDidLoad() {
    super.viewDidLoad()
    view.backgroundColor = Self.brandOrange
  }

  override var preferredStatusBarStyle: UIStatusBarStyle {
    .lightContent
  }

  override func capacitorDidLoad() {
    super.capacitorDidLoad()
    bridge?.webView?.navigationDelegate = self
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
}
