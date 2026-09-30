package com.zfound.mobile

import android.content.Context
import android.content.SharedPreferences

/**
 * Manages persisted connection configuration (PC IP address, port, pairing PIN).
 */
class PreferencesManager(context: Context) {
    private val prefs: SharedPreferences =
        context.getSharedPreferences("zfound_prefs", Context.MODE_PRIVATE)

    companion object {
        private const val KEY_IP = "server_ip"
        private const val KEY_PORT = "server_port"
        private const val KEY_PIN = "server_pin"
        private const val KEY_DEVICE_NAME = "device_name"
    }

    var ip: String
        get() = prefs.getString(KEY_IP, "") ?: ""
        set(value) = prefs.edit().putString(KEY_IP, value.trim()).apply()

    var port: Int
        get() = prefs.getInt(KEY_PORT, 7890)
        set(value) = prefs.edit().putInt(KEY_PORT, value).apply()

    var pin: String
        get() = prefs.getString(KEY_PIN, "") ?: ""
        set(value) = prefs.edit().putString(KEY_PIN, value.trim()).apply()

    var deviceName: String
        get() {
            val defaultName = "${android.os.Build.MANUFACTURER} ${android.os.Build.MODEL}".trim()
            return prefs.getString(KEY_DEVICE_NAME, defaultName) ?: defaultName
        }
        set(value) = prefs.edit().putString(KEY_DEVICE_NAME, value.trim()).apply()

    fun getConnectionConfig(): ConnectionConfig {
        return ConnectionConfig(ip = ip, port = port, pin = pin)
    }

    fun saveConnection(config: ConnectionConfig) {
        prefs.edit()
            .putString(KEY_IP, config.ip.trim())
            .putInt(KEY_PORT, config.port)
            .putString(KEY_PIN, config.pin.trim())
            .apply()
    }

    fun clearConnection() {
        prefs.edit().remove(KEY_IP).remove(KEY_PIN).apply()
    }

    val isConfigured: Boolean
        get() = ip.isNotBlank() && port > 0
}
