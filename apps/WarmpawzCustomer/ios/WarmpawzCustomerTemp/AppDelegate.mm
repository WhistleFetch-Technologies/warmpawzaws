#import "AppDelegate.h"

#import <React/RCTBundleURLProvider.h>
#import <objc/runtime.h>

#pragma mark - Razorpay iOS status-bar shim

/**
 * Razorpay iOS Standard Checkout (`RZPCheckoutViewController` inside its own
 * `UINavigationController`) lays its `theme.color` brand background across the *entire* presented
 * view, so the orange bleeds up under the system status bar — the back arrow / merchant logo end
 * up overlapping the system clock, signal, battery glyphs (see the design spec: same issue as
 * Android, but iOS Razorpay does not expose a knob to split status-bar from nav-bar color).
 *
 * Defensive native fix (kept entirely in `AppDelegate.mm` so we don't have to touch the iOS Xcode
 * `project.pbxproj`):
 *   1. A category on `UIViewController` swizzles `viewDidAppear:` / `viewWillDisappear:`.
 *   2. When the appearing controller (or its `topViewController` if it's a UINavigationController)
 *      has a class name starting with `RZP` or containing `Razorpay`, we:
 *        a. Show a dedicated `UIWindow` at `UIWindowLevelStatusBar - 1` that draws an opaque WHITE
 *           rectangle over the status-bar region of the active scene. The window sits ABOVE
 *           Razorpay's window but BELOW SpringBoard's status-bar icon glyphs.
 *        b. Force the global status-bar style to dark icons via
 *           `[UIApplication setStatusBarStyle:animated:]`. That setter is deprecated on iOS 13+
 *           but is still honored when `UIViewControllerBasedStatusBarAppearance` is `NO` (which
 *           is the case here per `Info.plist`); a `#pragma` silences the warning.
 *   3. On dismissal we hide the overlay window and restore the previous status-bar style so the
 *      rest of the RN app continues to render with its normal status-bar appearance.
 *
 * Net effect: orange Razorpay header now starts below a WHITE strip with dark system glyphs —
 * matching the BHIVE / Razorpay Trusted Business reference and the Android fix in
 * `apps/WarmpawzCustomer/android/app/src/main/java/com/warmpawz/customer/MainApplication.kt`.
 */

static UIWindow *_warmpawzRazorpayStatusBarOverlayWindow = nil;
static UIStatusBarStyle _warmpawzPreviousStatusBarStyle = UIStatusBarStyleDefault;
static BOOL _warmpawzStatusBarStyleSaved = NO;
static NSInteger _warmpawzActiveRazorpayCount = 0;

static UIWindow *warmpawz_activeKeyWindow(void) {
  if (@available(iOS 13.0, *)) {
    for (UIScene *scene in [UIApplication sharedApplication].connectedScenes) {
      if (scene.activationState != UISceneActivationStateForegroundActive) continue;
      if (![scene isKindOfClass:[UIWindowScene class]]) continue;
      UIWindowScene *ws = (UIWindowScene *)scene;
      for (UIWindow *w in ws.windows) {
        if (w.isKeyWindow) return w;
      }
      if (ws.windows.count > 0) return ws.windows.firstObject;
    }
  }
  for (UIWindow *w in [UIApplication sharedApplication].windows) {
    if (w.isKeyWindow) return w;
  }
  return [UIApplication sharedApplication].windows.firstObject;
}

static BOOL warmpawz_classNameLooksLikeRazorpay(NSString *clsName) {
  if (clsName.length == 0) return NO;
  if ([clsName hasPrefix:@"RZP"]) return YES;
  if ([clsName rangeOfString:@"Razorpay" options:NSCaseInsensitiveSearch].location != NSNotFound) {
    return YES;
  }
  return NO;
}

static BOOL warmpawz_isRazorpayController(UIViewController *vc) {
  if (!vc) return NO;
  if (warmpawz_classNameLooksLikeRazorpay(NSStringFromClass([vc class]))) return YES;
  if ([vc isKindOfClass:[UINavigationController class]]) {
    UINavigationController *nav = (UINavigationController *)vc;
    if (warmpawz_isRazorpayController(nav.topViewController)) return YES;
    if (warmpawz_isRazorpayController(nav.visibleViewController)) return YES;
  }
  return NO;
}

static void warmpawz_showRazorpayStatusBarOverlay(void) {
  UIWindow *keyWindow = warmpawz_activeKeyWindow();
  if (!keyWindow) return;

  CGFloat statusBarHeight = keyWindow.safeAreaInsets.top;
  if (statusBarHeight <= 0) {
    if (@available(iOS 13.0, *)) {
      UIWindowScene *scene = keyWindow.windowScene;
      statusBarHeight = scene.statusBarManager.statusBarFrame.size.height;
    }
  }
  if (statusBarHeight <= 0) statusBarHeight = 44.0; // sensible fallback for notched devices

  if (!_warmpawzRazorpayStatusBarOverlayWindow) {
    if (@available(iOS 13.0, *)) {
      UIWindowScene *scene = keyWindow.windowScene;
      if (scene) {
        _warmpawzRazorpayStatusBarOverlayWindow = [[UIWindow alloc] initWithWindowScene:scene];
      }
    }
    if (!_warmpawzRazorpayStatusBarOverlayWindow) {
      _warmpawzRazorpayStatusBarOverlayWindow = [[UIWindow alloc] initWithFrame:keyWindow.bounds];
    }
    // One step below the system status-bar level so SpringBoard's glyphs still draw on top of us.
    _warmpawzRazorpayStatusBarOverlayWindow.windowLevel = UIWindowLevelStatusBar - 1;
    _warmpawzRazorpayStatusBarOverlayWindow.userInteractionEnabled = NO;
    _warmpawzRazorpayStatusBarOverlayWindow.backgroundColor = [UIColor whiteColor];
    UIViewController *rootVC = [[UIViewController alloc] init];
    rootVC.view.backgroundColor = [UIColor whiteColor];
    _warmpawzRazorpayStatusBarOverlayWindow.rootViewController = rootVC;
  }

  _warmpawzRazorpayStatusBarOverlayWindow.frame =
      CGRectMake(0, 0, keyWindow.bounds.size.width, statusBarHeight);
  _warmpawzRazorpayStatusBarOverlayWindow.hidden = NO;

  if (!_warmpawzStatusBarStyleSaved) {
    _warmpawzPreviousStatusBarStyle = [UIApplication sharedApplication].statusBarStyle;
    _warmpawzStatusBarStyleSaved = YES;
  }
#pragma clang diagnostic push
#pragma clang diagnostic ignored "-Wdeprecated-declarations"
  UIStatusBarStyle darkStyle = UIStatusBarStyleDefault;
  if (@available(iOS 13.0, *)) {
    darkStyle = UIStatusBarStyleDarkContent;
  }
  [[UIApplication sharedApplication] setStatusBarStyle:darkStyle animated:NO];
#pragma clang diagnostic pop
}

static void warmpawz_hideRazorpayStatusBarOverlay(void) {
  if (_warmpawzRazorpayStatusBarOverlayWindow) {
    _warmpawzRazorpayStatusBarOverlayWindow.hidden = YES;
  }
  if (_warmpawzStatusBarStyleSaved) {
#pragma clang diagnostic push
#pragma clang diagnostic ignored "-Wdeprecated-declarations"
    [[UIApplication sharedApplication] setStatusBarStyle:_warmpawzPreviousStatusBarStyle animated:NO];
#pragma clang diagnostic pop
    _warmpawzStatusBarStyleSaved = NO;
  }
}

#pragma mark - UIViewController swizzle

@interface UIViewController (WarmpawzRazorpayStatusBarShim)
@end

@implementation UIViewController (WarmpawzRazorpayStatusBarShim)

+ (void)load {
  static dispatch_once_t onceToken;
  dispatch_once(&onceToken, ^{
    Class cls = [UIViewController class];

    Method origAppear = class_getInstanceMethod(cls, @selector(viewDidAppear:));
    Method swizAppear = class_getInstanceMethod(cls, @selector(warmpawz_rzpStatusBar_viewDidAppear:));
    if (origAppear && swizAppear) {
      method_exchangeImplementations(origAppear, swizAppear);
    }

    Method origDisappear = class_getInstanceMethod(cls, @selector(viewWillDisappear:));
    Method swizDisappear = class_getInstanceMethod(cls, @selector(warmpawz_rzpStatusBar_viewWillDisappear:));
    if (origDisappear && swizDisappear) {
      method_exchangeImplementations(origDisappear, swizDisappear);
    }
  });
}

// Names are intentionally prefixed to avoid clashing with anything React Native (or any third
// party library) might already have hooked on UIViewController.
- (void)warmpawz_rzpStatusBar_viewDidAppear:(BOOL)animated {
  [self warmpawz_rzpStatusBar_viewDidAppear:animated]; // calls the original (post-swizzle).
  if (warmpawz_isRazorpayController(self)) {
    _warmpawzActiveRazorpayCount += 1;
    warmpawz_showRazorpayStatusBarOverlay();
  }
}

- (void)warmpawz_rzpStatusBar_viewWillDisappear:(BOOL)animated {
  [self warmpawz_rzpStatusBar_viewWillDisappear:animated]; // calls the original (post-swizzle).
  if (warmpawz_isRazorpayController(self)) {
    _warmpawzActiveRazorpayCount = MAX(0, _warmpawzActiveRazorpayCount - 1);
    if (_warmpawzActiveRazorpayCount == 0) {
      warmpawz_hideRazorpayStatusBarOverlay();
    }
  }
}

@end

#pragma mark - AppDelegate

@implementation AppDelegate

- (BOOL)application:(UIApplication *)application didFinishLaunchingWithOptions:(NSDictionary *)launchOptions
{
  self.moduleName = @"WarmpawzCustomerTemp";
  // You can add your custom initial props in the dictionary below.
  // They will be passed down to the ViewController used by React Native.
  self.initialProps = @{};

  return [super application:application didFinishLaunchingWithOptions:launchOptions];
}

- (NSURL *)sourceURLForBridge:(RCTBridge *)bridge
{
  return [self getBundleURL];
}

- (NSURL *)getBundleURL
{
#if DEBUG
  return [[RCTBundleURLProvider sharedSettings] jsBundleURLForBundleRoot:@"index"];
#else
  return [[NSBundle mainBundle] URLForResource:@"main" withExtension:@"jsbundle"];
#endif
}

@end
