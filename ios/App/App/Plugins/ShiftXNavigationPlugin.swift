/**
 * Phase 4B: iOS Mapbox Navigation Plugin
 * 
 * Capacitor plugin that launches Mapbox Navigation SDK turn-by-turn navigation.
 * 
 * Setup:
 * 1. Add Mapbox Navigation SDK via SPM:
 *    - Xcode → File → Add Package Dependencies
 *    - Enter: https://github.com/mapbox/mapbox-navigation-ios
 *    - Version: 3.x (latest stable)
 * 
 * 2. Add to Info.plist:
 *    <key>MBXAccessToken</key>
 *    <string>$(MAPBOX_ACCESS_TOKEN)</string>
 *    
 *    <key>NSLocationWhenInUseUsageDescription</key>
 *    <string>ShiftX needs your location for navigation</string>
 *    
 *    <key>NSLocationAlwaysAndWhenInUseUsageDescription</key>
 *    <string>ShiftX needs your location for navigation</string>
 * 
 * 3. Add to Xcode build settings (User-Defined):
 *    - Debug: MAPBOX_ACCESS_TOKEN = pk.your_dev_token
 *    - Release: MAPBOX_ACCESS_TOKEN = pk.your_prod_token
 */

import Foundation
import Capacitor
import MapboxNavigationCore
import MapboxNavigationUIKit
import MapboxDirections

@objc(ShiftXNavigationPlugin)
public class ShiftXNavigationPlugin: CAPPlugin {
    private var navigationViewController: NavigationViewController?
    private var navigationMapView: NavigationMapView?
    
    @objc func start(_ call: CAPPluginCall) {
        guard let lat = call.getDouble("lat"),
              let lng = call.getDouble("lng") else {
            call.reject("Missing lat/lng parameters")
            return
        }
        
        let label = call.getString("label") ?? "Destination"
        let mode = call.getString("mode") ?? "driving"
        
        // Check Mapbox token
        guard let token = Bundle.main.object(forInfoDictionaryKey: "MBXAccessToken") as? String,
              !token.isEmpty else {
            call.reject("Mapbox access token not configured")
            notifyListeners("navError", data: [
                "error": "Mapbox token missing",
                "code": "NO_TOKEN",
                "timestamp": Date().timeIntervalSince1970 * 1000
            ])
            return
        }
        
        DispatchQueue.main.async {
            self.startNavigation(lat: lat, lng: lng, label: label, mode: mode, call: call)
        }
    }
    
    private func startNavigation(lat: Double, lng: Double, label: String, mode: String, call: CAPPluginCall) {
        // Create destination coordinate
        let destination = CLLocationCoordinate2D(latitude: lat, longitude: lng)
        
        // Get user's current location
        guard let userLocation = navigationMapView?.mapView.location.latestLocation?.coordinate else {
            call.reject("User location not available")
            notifyListeners("navError", data: [
                "error": "User location not available",
                "code": "NO_LOCATION",
                "timestamp": Date().timeIntervalSince1970 * 1000
            ])
            return
        }
        
        // Create route options
        let origin = Waypoint(coordinate: userLocation, name: "Current Location")
        let destinationWaypoint = Waypoint(coordinate: destination, name: label)
        
        let profileIdentifier: ProfileIdentifier = mode == "walking" ? .walking : .automobileAvoidingTraffic
        let routeOptions = NavigationRouteOptions(waypoints: [origin, destinationWaypoint], profileIdentifier: profileIdentifier)
        
        // Request route
        Directions.shared.calculate(routeOptions) { [weak self] (session, result) in
            guard let self = self else { return }
            
            switch result {
            case .success(let response):
                guard let route = response.routes?.first else {
                    call.reject("No route found")
                    self.notifyListeners("navError", data: [
                        "error": "No route found",
                        "code": "NO_ROUTE",
                        "timestamp": Date().timeIntervalSince1970 * 1000
                    ])
                    return
                }
                
                // Create navigation options
                let navigationOptions = NavigationOptions(navigationRoutes: response)
                
                // Create and present navigation view controller
                let navViewController = NavigationViewController(navigationOptions: navigationOptions)
                navViewController.delegate = self
                navViewController.modalPresentationStyle = .fullScreen
                
                self.navigationViewController = navViewController
                
                DispatchQueue.main.async {
                    self.bridge?.viewController?.present(navViewController, animated: true) {
                        call.resolve(["started": true])
                        self.notifyListeners("navStarted", data: [
                            "timestamp": Date().timeIntervalSince1970 * 1000,
                            "message": "Navigation started to \(label)"
                        ])
                    }
                }
                
            case .failure(let error):
                call.reject("Route calculation failed: \(error.localizedDescription)")
                self.notifyListeners("navError", data: [
                    "error": error.localizedDescription,
                    "code": "ROUTE_FAILED",
                    "timestamp": Date().timeIntervalSince1970 * 1000
                ])
            }
        }
    }
    
    @objc func stop(_ call: CAPPluginCall) {
        DispatchQueue.main.async {
            if let navVC = self.navigationViewController {
                navVC.dismiss(animated: true) {
                    self.navigationViewController = nil
                    call.resolve(["stopped": true])
                    self.notifyListeners("navEnded", data: [
                        "timestamp": Date().timeIntervalSince1970 * 1000,
                        "message": "Navigation stopped by user"
                    ])
                }
            } else {
                call.resolve(["stopped": false])
            }
        }
    }
    
    @objc func setDestination(_ call: CAPPluginCall) {
        // For simplicity, stop current navigation and start new one
        // More sophisticated implementation could update route in-place
        DispatchQueue.main.async {
            if self.navigationViewController != nil {
                self.navigationViewController?.dismiss(animated: false) {
                    self.navigationViewController = nil
                    // Now start new navigation
                    self.start(call)
                }
            } else {
                // No active navigation, just start
                self.start(call)
            }
        }
    }
    
    @objc func isAvailable(_ call: CAPPluginCall) {
        let token = Bundle.main.object(forInfoDictionaryKey: "MBXAccessToken") as? String
        let available = token != nil && !token!.isEmpty
        let reason = available ? nil : "Mapbox token not configured"
        
        call.resolve([
            "available": available,
            "reason": reason as Any
        ])
    }
}

// MARK: - NavigationViewControllerDelegate
extension ShiftXNavigationPlugin: NavigationViewControllerDelegate {
    public func navigationViewControllerDidDismiss(_ navigationViewController: NavigationViewController, byCanceling canceled: Bool) {
        self.navigationViewController = nil
        
        notifyListeners("navEnded", data: [
            "timestamp": Date().timeIntervalSince1970 * 1000,
            "message": canceled ? "Navigation cancelled" : "Navigation ended"
        ])
    }
    
    public func navigationViewController(_ navigationViewController: NavigationViewController, didArriveAt waypoint: Waypoint) {
        // User arrived at destination
        notifyListeners("navEnded", data: [
            "timestamp": Date().timeIntervalSince1970 * 1000,
            "message": "Arrived at destination"
        ])
    }
}
