/**
 * Phase 4B: Android Mapbox Navigation Plugin
 * 
 * Capacitor plugin that launches Mapbox Navigation SDK turn-by-turn navigation.
 * 
 * Setup:
 * 1. Add to android/app/build.gradle dependencies:
 *    implementation 'com.mapbox.navigation:android:3.0.0' // or latest 3.x
 *    implementation 'com.mapbox.navigation:ui-dropin:3.0.0'
 * 
 * 2. Add to android/app/src/main/AndroidManifest.xml:
 *    <uses-permission android:name="android.permission.ACCESS_FINE_LOCATION" />
 *    <uses-permission android:name="android.permission.ACCESS_COARSE_LOCATION" />
 *    
 *    <application>
 *      <meta-data
 *        android:name="MAPBOX_ACCESS_TOKEN"
 *        android:value="${MAPBOX_ACCESS_TOKEN}" />
 *    </application>
 * 
 * 3. Add to android/gradle.properties:
 *    MAPBOX_ACCESS_TOKEN_DEV=pk.your_dev_token
 *    MAPBOX_ACCESS_TOKEN_PROD=pk.your_prod_token
 * 
 * 4. Add to android/app/build.gradle:
 *    android {
 *      buildTypes {
 *        debug {
 *          manifestPlaceholders = [MAPBOX_ACCESS_TOKEN: project.properties['MAPBOX_ACCESS_TOKEN_DEV']]
 *        }
 *        release {
 *          manifestPlaceholders = [MAPBOX_ACCESS_TOKEN: project.properties['MAPBOX_ACCESS_TOKEN_PROD']]
 *        }
 *      }
 *    }
 */

package com.shiftx.driver

import android.content.Intent
import com.getcapacitor.Plugin
import com.getcapacitor.PluginCall
import com.getcapacitor.PluginMethod
import com.getcapacitor.annotation.CapacitorPlugin
import com.mapbox.geojson.Point
import com.mapbox.navigation.base.options.NavigationOptions
import com.mapbox.navigation.core.MapboxNavigation
import com.mapbox.navigation.core.lifecycle.MapboxNavigationApp
import com.mapbox.navigation.dropin.NavigationView
import org.json.JSONObject

@CapacitorPlugin(name = "ShiftXNavigation")
class ShiftXNavigationPlugin : Plugin() {
    
    companion object {
        const val NAV_REQUEST_CODE = 1001
        var activeNavigationCall: PluginCall? = null
    }

    @PluginMethod
    fun start(call: PluginCall) {
        val lat = call.getDouble("lat")
        val lng = call.getDouble("lng")
        
        if (lat == null || lng == null) {
            call.reject("Missing lat/lng parameters")
            return
        }
        
        val label = call.getString("label") ?: "Destination"
        val mode = call.getString("mode") ?: "driving"
        
        // Check Mapbox token
        val token = getMapboxToken()
        if (token.isNullOrEmpty()) {
            call.reject("Mapbox access token not configured")
            notifyError("Mapbox token missing", "NO_TOKEN")
            return
        }
        
        // Store call for later resolution
        activeNavigationCall = call
        
        // Launch navigation activity
        val intent = Intent(context, ShiftXNavigationActivity::class.java).apply {
            putExtra("lat", lat)
            putExtra("lng", lng)
            putExtra("label", label)
            putExtra("mode", mode)
        }
        
        activity.startActivityForResult(intent, NAV_REQUEST_CODE)
    }

    @PluginMethod
    fun stop(call: PluginCall) {
        // Send broadcast to navigation activity to finish
        val intent = Intent("com.shiftx.driver.STOP_NAVIGATION")
        context.sendBroadcast(intent)
        
        call.resolve(JSONObject().put("stopped", true))
    }

    @PluginMethod
    fun setDestination(call: PluginCall) {
        // For simplicity, stop current navigation and start new one
        // Send stop broadcast, then start new navigation
        val intent = Intent("com.shiftx.driver.STOP_NAVIGATION")
        context.sendBroadcast(intent)
        
        // Small delay to allow current nav to stop
        activity.runOnUiThread {
            android.os.Handler(android.os.Looper.getMainLooper()).postDelayed({
                start(call)
            }, 300)
        }
    }

    @PluginMethod
    fun isAvailable(call: PluginCall) {
        val token = getMapboxToken()
        val available = !token.isNullOrEmpty()
        val reason = if (available) null else "Mapbox token not configured"
        
        call.resolve(JSONObject().apply {
            put("available", available)
            if (reason != null) put("reason", reason)
        })
    }
    
    private fun getMapboxToken(): String? {
        return try {
            val appInfo = context.packageManager.getApplicationInfo(
                context.packageName,
                android.content.pm.PackageManager.GET_META_DATA
            )
            appInfo.metaData?.getString("MAPBOX_ACCESS_TOKEN")
        } catch (e: Exception) {
            null
        }
    }
    
    fun notifyNavStarted(message: String) {
        notifyListeners("navStarted", JSONObject().apply {
            put("timestamp", System.currentTimeMillis())
            put("message", message)
        })
    }
    
    fun notifyNavEnded(message: String) {
        notifyListeners("navEnded", JSONObject().apply {
            put("timestamp", System.currentTimeMillis())
            put("message", message)
        })
    }
    
    fun notifyError(error: String, code: String) {
        notifyListeners("navError", JSONObject().apply {
            put("timestamp", System.currentTimeMillis())
            put("error", error)
            put("code", code)
        })
    }
}
