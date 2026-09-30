package com.zfound.mobile

import android.util.Base64
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody.Companion.toRequestBody
import org.json.JSONObject
import java.io.File
import java.io.FileInputStream
import java.util.concurrent.TimeUnit

/**
 * Handles fast, non-blocking local Wi-Fi HTTP communication with the ZFound PC Desktop server.
 */
class NetworkClient {
    private val client: OkHttpClient = OkHttpClient.Builder()
        .connectTimeout(5, TimeUnit.SECONDS)
        .readTimeout(20, TimeUnit.SECONDS)
        .writeTimeout(20, TimeUnit.SECONDS)
        .retryOnConnectionFailure(true)
        .build()

    private val jsonMediaType = "application/json; charset=utf-8".toMediaType()

    /**
     * Checks if the PC sync server is reachable and if the pairing PIN matches.
     */
    suspend fun checkStatus(config: ConnectionConfig): Result<ServerStatus> = withContext(Dispatchers.IO) {
        try {
            if (!config.isValid) {
                return@withContext Result.failure(IllegalArgumentException("Invalid IP or Port"))
            }

            val request = Request.Builder()
                .url(config.statusUrl)
                .get()
                .build()

            client.newCall(request).execute().use { response ->
                if (!response.isSuccessful) {
                    val code = response.code
                    val msg = if (code == 401) "Incorrect PIN" else "HTTP error $code"
                    return@withContext Result.failure(Exception(msg))
                }

                val body = response.body?.string() ?: ""
                val json = JSONObject(body)
                val status = json.optString("status", "")
                val pcName = json.optString("pc_name", "PC")
                val pinValid = json.optBoolean("pin_valid", false)

                if (status == "online") {
                    Result.success(
                        ServerStatus(
                            isOnline = true,
                            pcName = pcName,
                            message = if (pinValid) "Connected" else "PIN mismatch"
                        )
                    )
                } else {
                    Result.failure(Exception("Server returned status: $status"))
                }
            }
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    /**
     * Encodes and uploads a photo file to the desktop ZFound session.
     */
    suspend fun uploadPhoto(
        config: ConnectionConfig,
        photoFile: File,
        deviceName: String
    ): Result<UploadResult> = withContext(Dispatchers.IO) {
        try {
            val bytes = FileInputStream(photoFile).use { it.readBytes() }
            val b64String = Base64.encodeToString(bytes, Base64.NO_WRAP)
            val dataUrl = "data:image/jpeg;base64,$b64String"

            val jsonBody = JSONObject().apply {
                put("image", dataUrl)
                put("pin", config.pin)
                put("device", deviceName)
                put("filename", photoFile.name)
            }

            val requestBody = jsonBody.toString().toRequestBody(jsonMediaType)
            val request = Request.Builder()
                .url(config.uploadUrl)
                .post(requestBody)
                .build()

            client.newCall(request).execute().use { response ->
                val body = response.body?.string() ?: ""
                if (!response.isSuccessful) {
                    val errMsg = try {
                        JSONObject(body).optString("message", "HTTP ${response.code}")
                    } catch (e: Exception) {
                        "Server error ${response.code}"
                    }
                    return@withContext Result.failure(Exception(errMsg))
                }

                val json = JSONObject(body)
                val status = json.optString("status", "error")
                val message = json.optString("message", "Uploaded successfully")
                val productCount = json.optInt("product_count", 0)

                if (status == "success") {
                    Result.success(
                        UploadResult(
                            success = true,
                            message = message,
                            productCount = productCount
                        )
                    )
                } else {
                    Result.failure(Exception(message))
                }
            }
        } catch (e: Exception) {
            Result.failure(e)
        }
    }
}
