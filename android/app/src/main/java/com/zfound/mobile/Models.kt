package com.zfound.mobile

/**
 * Data models for ZFound Local Wi-Fi Sync.
 */
data class ConnectionConfig(
    val ip: String,
    val port: Int = 7890,
    val pin: String = ""
) {
    val baseUrl: String
        get() = "http://$ip:$port"

    val statusUrl: String
        get() = "$baseUrl/api/status?pin=$pin"

    val uploadUrl: String
        get() = "$baseUrl/api/upload"

    val isValid: Boolean
        get() = ip.isNotBlank() && port in 1..65535
}

data class ServerStatus(
    val isOnline: Boolean,
    val pcName: String? = null,
    val message: String? = null
)

data class UploadResult(
    val success: Boolean,
    val message: String,
    val productCount: Int = 0
)
