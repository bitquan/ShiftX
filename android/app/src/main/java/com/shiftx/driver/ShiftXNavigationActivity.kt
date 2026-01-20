/**
 * Phase 4B: Android Navigation Activity
 * 
 * Full-screen activity that hosts Mapbox Navigation UI.
 * Launched from ShiftXNavigationPlugin, returns to main app when dismissed.
 */

package com.shiftx.driver

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import android.os.Bundle
import androidx.appcompat.app.AppCompatActivity
import com.mapbox.geojson.Point
import com.mapbox.navigation.base.ExperimentalPreviewMapboxNavigationAPI
import com.mapbox.navigation.base.options.NavigationOptions
import com.mapbox.navigation.core.lifecycle.MapboxNavigationApp
import com.mapbox.navigation.dropin.NavigationView

@OptIn(ExperimentalPreviewMapboxNavigationAPI::class)
class ShiftXNavigationActivity : AppCompatActivity() {
    
    private lateinit var navigationView: NavigationView
    private val stopReceiver = object : BroadcastReceiver() {
        override fun onReceive(context: Context?, intent: Intent?) {
            finish()
        }
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        
        // Get destination from intent
        val lat = intent.getDoubleExtra("lat", 0.0)
        val lng = intent.getDoubleExtra("lng", 0.0)
        val label = intent.getStringExtra("label") ?: "Destination"
        val mode = intent.getStringExtra("mode") ?: "driving"
        
        if (lat == 0.0 && lng == 0.0) {
            finish()
            return
        }
        
        // Register stop receiver
        registerReceiver(stopReceiver, IntentFilter("com.shiftx.driver.STOP_NAVIGATION"))
        
        // Setup Mapbox Navigation
        val destination = Point.fromLngLat(lng, lat)
        
        // Initialize MapboxNavigationApp if not already
        if (!MapboxNavigationApp.isSetup()) {
            MapboxNavigationApp.setup {
                NavigationOptions.Builder(this)
                    .build()
            }
        }
        
        // Create navigation view
        navigationView = NavigationView(this).apply {
            // Set destination
            api.startActiveGuidance(destination)
            
            // Listen for navigation events
            api.addNavigationListener(object : NavigationView.NavigationListener {
                override fun onArrival() {
                    notifyNavEnded("Arrived at destination")
                    finish()
                }
                
                override fun onCanceled() {
                    notifyNavEnded("Navigation cancelled")
                    finish()
                }
                
                override fun onError(error: String) {
                    notifyError(error, "NAV_ERROR")
                    finish()
                }
            })
        }
        
        setContentView(navigationView)
        
        // Notify started
        notifyNavStarted("Navigation started to $label")
    }

    override fun onDestroy() {
        super.onDestroy()
        unregisterReceiver(stopReceiver)
        MapboxNavigationApp.current()?.onDestroy()
    }
    
    private fun notifyNavStarted(message: String) {
        // Notify plugin via static reference
        val plugin = ShiftXNavigationPlugin.activeNavigationCall?.plugin as? ShiftXNavigationPlugin
        plugin?.notifyNavStarted(message)
        
        // Resolve the start() call
        ShiftXNavigationPlugin.activeNavigationCall?.resolve(
            org.json.JSONObject().put("started", true)
        )
    }
    
    private fun notifyNavEnded(message: String) {
        val plugin = ShiftXNavigationPlugin.activeNavigationCall?.plugin as? ShiftXNavigationPlugin
        plugin?.notifyNavEnded(message)
        ShiftXNavigationPlugin.activeNavigationCall = null
    }
    
    private fun notifyError(error: String, code: String) {
        val plugin = ShiftXNavigationPlugin.activeNavigationCall?.plugin as? ShiftXNavigationPlugin
        plugin?.notifyError(error, code)
        ShiftXNavigationPlugin.activeNavigationCall = null
    }
}
