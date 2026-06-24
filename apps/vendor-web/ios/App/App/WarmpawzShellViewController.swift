import UIKit
import Capacitor

/// Vendor shell: edge-to-edge WebView; web CSS handles safe-area via env(safe-area-inset-*).
final class WarmpawzShellViewController: CAPBridgeViewController {

  override func viewDidLoad() {
    super.viewDidLoad()
    view.backgroundColor = .white
  }

  override var preferredStatusBarStyle: UIStatusBarStyle {
    .darkContent
  }

  override func capacitorDidLoad() {
    super.capacitorDidLoad()
    configureEdgeToEdgeWebView()
  }

  private func configureEdgeToEdgeWebView() {
    guard let webView = bridge?.webView else { return }
    webView.backgroundColor = .white
    webView.isOpaque = true
    webView.scrollView.backgroundColor = .white
    webView.scrollView.contentInsetAdjustmentBehavior = .never
  }
}
