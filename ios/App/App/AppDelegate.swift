import UIKit
import Capacitor

@UIApplicationMain
class AppDelegate: UIResponder, UIApplicationDelegate {

  var window: UIWindow?

  func application(
    _ application: UIApplication,
    didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]?
  ) -> Bool {
    return true
  }

  // Handle custom URL schemes (and some deep link flows)
  func application(
    _ app: UIApplication,
    open url: URL,
    options: [UIApplication.OpenURLOptionsKey: Any] = [:]
  ) -> Bool {
    return ApplicationDelegateProxy.shared.application(app, open: url, options: options)
  }

  // Handle Universal Links (NSUserActivity -> webpageURL -> URL open handler)
  func application(
    _ application: UIApplication,
    continue userActivity: NSUserActivity,
    restorationHandler: @escaping ([UIUserActivityRestoring]?) -> Void
  ) -> Bool {
    guard let url = userActivity.webpageURL else {
      return false
    }

    // Capacitor v8: route universal links through the URL open handler
    return ApplicationDelegateProxy.shared.application(application, open: url, options: [:])
  }
}
