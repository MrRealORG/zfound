package com.zfound.mobile

import android.Manifest
import android.annotation.SuppressLint
import android.content.Intent
import android.content.pm.PackageManager
import android.net.Uri
import android.os.Bundle
import android.view.LayoutInflater
import android.widget.EditText
import android.widget.Toast
import androidx.activity.result.contract.ActivityResultContracts
import androidx.annotation.OptIn
import androidx.appcompat.app.AlertDialog
import androidx.appcompat.app.AppCompatActivity
import androidx.camera.core.*
import androidx.camera.lifecycle.ProcessCameraProvider
import androidx.core.content.ContextCompat
import androidx.lifecycle.lifecycleScope
import com.google.mlkit.vision.barcode.BarcodeScanner
import com.google.mlkit.vision.barcode.BarcodeScannerOptions
import com.google.mlkit.vision.barcode.BarcodeScanning
import com.google.mlkit.vision.barcode.common.Barcode
import com.google.mlkit.vision.common.InputImage
import com.zfound.mobile.databinding.ActivityQrScannerBinding
import kotlinx.coroutines.launch
import org.json.JSONObject
import java.util.concurrent.ExecutorService
import java.util.concurrent.Executors

/**
 * High-speed QR Code Scanner powered by Google ML Kit and CameraX.
 * Automatically parses PC sync server IP, port, and pairing PIN.
 */
class QrScannerActivity : AppCompatActivity() {

    private lateinit var binding: ActivityQrScannerBinding
    private lateinit var cameraExecutor: ExecutorService
    private lateinit var prefs: PreferencesManager
    private val networkClient = NetworkClient()

    private var isProcessingQr = false
    private var barcodeScanner: BarcodeScanner? = null

    private val cameraPermissionLauncher = registerForActivityResult(
        ActivityResultContracts.RequestPermission()
    ) { isGranted ->
        if (isGranted) {
            startCamera()
        } else {
            Toast.makeText(this, R.string.camera_permission_required, Toast.LENGTH_LONG).show()
            finish()
        }
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        binding = ActivityQrScannerBinding.inflate(layoutInflater)
        setContentView(binding.root)

        prefs = PreferencesManager(this)
        cameraExecutor = Executors.newSingleThreadExecutor()

        val options = BarcodeScannerOptions.Builder()
            .setBarcodeFormats(Barcode.FORMAT_QR_CODE)
            .build()
        barcodeScanner = BarcodeScanning.getClient(options)

        binding.btnBack.setOnClickListener { finish() }
        binding.btnManualConnect.setOnClickListener { showManualEntryDialog() }

        if (allPermissionsGranted()) {
            startCamera()
        } else {
            cameraPermissionLauncher.launch(Manifest.permission.CAMERA)
        }
    }

    private fun allPermissionsGranted(): Boolean {
        return ContextCompat.checkSelfPermission(
            this,
            Manifest.permission.CAMERA
        ) == PackageManager.PERMISSION_GRANTED
    }

    private fun startCamera() {
        val cameraProviderFuture = ProcessCameraProvider.getInstance(this)
        cameraProviderFuture.addListener({
            val cameraProvider = cameraProviderFuture.get()

            val preview = Preview.Builder()
                .build()
                .also {
                    it.setSurfaceProvider(binding.qrViewFinder.surfaceProvider)
                }

            val imageAnalysis = ImageAnalysis.Builder()
                .setBackpressureStrategy(ImageAnalysis.STRATEGY_KEEP_ONLY_LATEST)
                .build()

            imageAnalysis.setAnalyzer(cameraExecutor) { imageProxy ->
                processImageProxy(imageProxy)
            }

            val cameraSelector = CameraSelector.DEFAULT_BACK_CAMERA

            try {
                cameraProvider.unbindAll()
                cameraProvider.bindToLifecycle(
                    this,
                    cameraSelector,
                    preview,
                    imageAnalysis
                )
            } catch (exc: Exception) {
                Toast.makeText(this, "Failed to initialize camera: ${exc.message}", Toast.LENGTH_SHORT).show()
            }
        }, ContextCompat.getMainExecutor(this))
    }

    @OptIn(ExperimentalGetImage::class)
    @SuppressLint("UnsafeOptInUsageError")
    private fun processImageProxy(imageProxy: ImageProxy) {
        if (isProcessingQr) {
            imageProxy.close()
            return
        }

        val mediaImage = imageProxy.image
        if (mediaImage != null) {
            val image = InputImage.fromMediaImage(mediaImage, imageProxy.imageInfo.rotationDegrees)
            barcodeScanner?.process(image)
                ?.addOnSuccessListener { barcodes ->
                    for (barcode in barcodes) {
                        val rawValue = barcode.rawValue ?: continue
                        val config = parseQrCode(rawValue)
                        if (config != null) {
                            isProcessingQr = true
                            runOnUiThread {
                                verifyAndSaveConnection(config)
                            }
                            break
                        }
                    }
                }
                ?.addOnCompleteListener {
                    imageProxy.close()
                }
        } else {
            imageProxy.close()
        }
    }

    /**
     * Parses QR code content formatted as a URL, JSON, or plain host:port.
     */
    private fun parseQrCode(raw: String): ConnectionConfig? {
        try {
            val trimmed = raw.trim()
            if (trimmed.startsWith("http://") || trimmed.startsWith("https://")) {
                val uri = Uri.parse(trimmed)
                val host = uri.host ?: return null
                val port = if (uri.port != -1) uri.port else 7890
                val pin = uri.getQueryParameter("pin") ?: ""
                return ConnectionConfig(ip = host, port = port, pin = pin)
            }

            if (trimmed.startsWith("{") && trimmed.endsWith("}")) {
                val json = JSONObject(trimmed)
                val ip = json.optString("ip", "")
                val port = json.optInt("port", 7890)
                val pin = json.optString("pin", "")
                if (ip.isNotEmpty()) {
                    return ConnectionConfig(ip = ip, port = port, pin = pin)
                }
            }

            if (trimmed.contains(":") && !trimmed.contains(" ")) {
                val parts = trimmed.split(":")
                val ip = parts[0]
                val port = parts[1].toIntOrNull() ?: 7890
                return ConnectionConfig(ip = ip, port = port)
            }
        } catch (e: Exception) {
            // Ignore parse failures
        }
        return null
    }

    private fun verifyAndSaveConnection(config: ConnectionConfig) {
        Toast.makeText(this, "Connecting to ${config.ip}...", Toast.LENGTH_SHORT).show()

        lifecycleScope.launch {
            val result = networkClient.checkStatus(config)
            result.onSuccess { status ->
                prefs.saveConnection(config)
                Toast.makeText(
                    this@QrScannerActivity,
                    "Connected to ${status.pcName ?: "PC"}!",
                    Toast.LENGTH_LONG
                ).show()
                setResult(RESULT_OK, Intent().apply {
                    putExtra("ip", config.ip)
                    putExtra("pin", config.pin)
                })
                finish()
            }.onFailure { err ->
                isProcessingQr = false
                Toast.makeText(
                    this@QrScannerActivity,
                    "Could not connect to ${config.ip}: ${err.message}. Ensure same Wi-Fi!",
                    Toast.LENGTH_LONG
                ).show()
            }
        }
    }

    private fun showManualEntryDialog() {
        val view = LayoutInflater.from(this).inflate(android.R.layout.simple_list_item_2, null)
        val editIp = EditText(this).apply {
            hint = "PC Local IP (e.g. 192.168.0.106)"
            setText(prefs.ip.ifEmpty { "192.168." })
        }
        val editPin = EditText(this).apply {
            hint = "6-digit PIN (shown on PC)"
            setText(prefs.pin)
        }

        val layout = android.widget.LinearLayout(this).apply {
            orientation = android.widget.LinearLayout.VERTICAL
            setPadding(50, 20, 50, 10)
            addView(editIp)
            addView(editPin)
        }

        AlertDialog.Builder(this)
            .setTitle("Manual PC Connection")
            .setMessage("Check the IP and PIN displayed in ZFound on your PC:")
            .setView(layout)
            .setPositiveButton("Connect") { _, _ ->
                val ip = editIp.text.toString().trim()
                val pin = editPin.text.toString().trim()
                if (ip.isNotEmpty()) {
                    val config = ConnectionConfig(ip = ip, port = 7890, pin = pin)
                    verifyAndSaveConnection(config)
                }
            }
            .setNegativeButton("Cancel", null)
            .show()
    }

    override fun onDestroy() {
        super.onDestroy()
        cameraExecutor.shutdown()
        barcodeScanner?.close()
    }
}
