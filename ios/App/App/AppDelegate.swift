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

    func application(
        _ app: UIApplication,
        open url: URL,
        options: [UIApplication.OpenURLOptionsKey: Any] = [:]
    ) -> Bool {
        // Deep links / custom URL schemes
        return ApplicationDelegateProxy.shared.application(app, open: url, options: options)
    }

    // NOTE:
    // Capacitor 8 projects may not include an ApplicationDelegateProxy handler for:
    // application(_:continue:restorationHandler:)
    // If you need Universal Links later, we can add it back in the Capacitor 8-compatible way.
}
